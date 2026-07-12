import 'dart:io';

import 'package:excel/excel.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/mobile_repository.dart';

final zobazeImportServiceProvider = Provider<ZobazeImportService>((ref) {
  return ZobazeImportService(
    ref.watch(inventoryRepositoryProvider),
    ref.watch(customerRepositoryProvider),
  );
});

class ZobazeImportResult {
  const ZobazeImportResult({
    required this.inventory,
    required this.customers,
    required this.warnings,
  });

  final int inventory;
  final int customers;
  final List<String> warnings;
}

/// Import Zobaze `.xlsx` export files (inventory + customers) into the local
/// store. Sheet formats decoded from the legacy migrationEngine:
///   inventory : CATEGORY, ITEM_TYPE, ITEM_NAME, VARIANT_NAME, PRICE,
///               COST_PRICE, STOCK, SKU, BARCODE
///   customers : Name, Phone, Email, AmountDue, AmountHeld (Advance)
class ZobazeImportService {
  ZobazeImportService(this._inventory, this._customers);

  final InventoryRepository _inventory;
  final CustomerRepository _customers;

  Future<File?> pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: <String>['xlsx', 'xls'],
    );
    final path = result?.files.single.path;
    return path == null ? null : File(path);
  }

  static String _cellString(Data? cell) {
    final value = cell?.value;
    if (value == null) return '';
    if (value is TextCellValue) return value.value.toString().trim();
    if (value is IntCellValue) return value.value.toString();
    if (value is DoubleCellValue) return value.value.toString();
    return value.toString().trim();
  }

  static double _num(String s) => double.tryParse(s.replaceAll(',', '')) ?? 0;
  static int _int(String s) =>
      int.tryParse(s.split('.').first.replaceAll(',', '')) ?? 0;

  Future<ZobazeImportResult> importFile(File file) async {
    final excel = Excel.decodeBytes(await file.readAsBytes());
    var inventoryCount = 0;
    var customerCount = 0;
    final warnings = <String>[];
    final now = DateTime.now().millisecondsSinceEpoch;
    final iso = DateTime.now().toIso8601String();

    for (final sheetName in excel.tables.keys) {
      final table = excel.tables[sheetName];
      if (table == null || table.rows.length < 2) continue;

      final headers =
          table.rows.first.map(_cellString).toList(growable: false);
      int col(String h) => headers.indexOf(h);
      String cell(List<Data?> row, String h) {
        final i = col(h);
        return (i < 0 || i >= row.length) ? '' : _cellString(row[i]);
      }

      final isInventory = const <String>['CATEGORY', 'ITEM_NAME', 'PRICE', 'STOCK']
          .every(headers.contains);
      final isCustomer =
          headers.contains('Name') && headers.contains('AmountDue');

      if (isInventory) {
        for (final row in table.rows.skip(1)) {
          final name = cell(row, 'ITEM_NAME');
          if (name.isEmpty) continue;
          final variant = cell(row, 'VARIANT_NAME');
          final category = cell(row, 'CATEGORY');
          final sku = cell(row, 'SKU');
          final barcode = cell(row, 'BARCODE');
          final id =
              'zobaze-inv-${name.hashCode}-${variant.hashCode}-${category.hashCode}';
          await _inventory.mergeInventoryDocument(
            id,
            <String, dynamic>{
              'name': name,
              'price': _num(cell(row, 'PRICE')),
              'sku': sku.isNotEmpty ? sku : barcode,
              'category': category.isEmpty ? 'General' : category,
              'subcategory': cell(row, 'ITEM_TYPE'),
              'size': variant,
              'stock': _int(cell(row, 'STOCK')),
              'status': 'active',
              'tombstone': false,
              'createdAt': iso,
              'updatedAt': iso,
            },
            updatedAt: now,
          );
          final cost = _num(cell(row, 'COST_PRICE'));
          if (cost > 0) {
            await _inventory.mergeInventoryPrivateDocument(
              id,
              <String, dynamic>{
                'costPrice': cost,
                'updatedAt': iso,
                'tombstone': false,
              },
              updatedAt: now,
            );
          }
          inventoryCount++;
        }
      } else if (isCustomer) {
        for (final row in table.rows.skip(1)) {
          final name = cell(row, 'Name');
          if (name.isEmpty) continue;
          final phone = cell(row, 'Phone');
          final due = _num(cell(row, 'AmountDue'));
          final advance = _num(cell(row, 'AmountHeld (Advance)'));
          final id = 'zobaze-cust-${phone.hashCode}-${name.hashCode}';
          await _customers.mergeRemoteCustomerDocument(
            id,
            <String, dynamic>{
              'name': name,
              'phone': phone,
              'email': cell(row, 'Email'),
              'status': 'active',
              'balance': due - advance,
              'total_spent': 0,
              'tombstone': false,
              'updatedAt': iso,
            },
            updatedAt: now,
          );
          customerCount++;
        }
      }
    }

    if (inventoryCount == 0 && customerCount == 0) {
      warnings.add(
        'No Zobaze inventory or customer sheet was found in this file. '
        'Export "Items" or "Customers" from Zobaze as Excel and try again.',
      );
    } else {
      warnings.add(
        'Zobaze exports do not include lifetime spend, so customer "total '
        'spent" starts at zero and rebuilds from new sales.',
      );
    }
    return ZobazeImportResult(
      inventory: inventoryCount,
      customers: customerCount,
      warnings: warnings,
    );
  }
}
