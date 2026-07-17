import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/mobile_repository.dart';
import 'universal_import.dart';

final universalImportServiceProvider = Provider<UniversalImportService>((ref) {
  return UniversalImportService(
    ref.watch(inventoryRepositoryProvider),
    ref.watch(customerRepositoryProvider),
  );
});

class ImportOutcome {
  const ImportOutcome({required this.imported, required this.skipped});
  final int imported;
  final int skipped;
}

/// Writes canonical rows produced by [mapRows] into the local store. Products
/// and customers are supported (both have repository merge methods); an entry
/// with the same key is updated, not duplicated.
class UniversalImportService {
  UniversalImportService(this._inventory, this._customers);

  final InventoryRepository _inventory;
  final CustomerRepository _customers;

  Future<ImportOutcome> importProducts(MappedImport mapped) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    final iso = DateTime.now().toIso8601String();
    var imported = 0;
    for (final row in mapped.rows) {
      final name = row['name'] ?? '';
      if (name.isEmpty) continue;
      final sku = row['sku'] ?? row['barcode'] ?? '';
      final id = 'import-inv-${name.hashCode}-${sku.hashCode}';
      await _inventory.mergeInventoryDocument(
        id,
        <String, dynamic>{
          'name': name,
          'price': parseNum(row['price']),
          'sku': sku,
          'category': (row['category'] ?? '').isEmpty ? 'General' : row['category'],
          'stock': parseNum(row['stock']),
          'hsnCode': row['hsnCode'] ?? '',
          'gstRate': parseNum(row['gstRate']),
          'status': 'active',
          'tombstone': false,
          'createdAt': iso,
          'updatedAt': iso,
        },
        updatedAt: now,
      );
      final cost = parseNum(row['costPrice']);
      if (cost > 0) {
        await _inventory.mergeInventoryPrivateDocument(
          id,
          <String, dynamic>{'costPrice': cost, 'updatedAt': iso, 'tombstone': false},
          updatedAt: now,
        );
      }
      imported++;
    }
    return ImportOutcome(imported: imported, skipped: mapped.rows.length - imported);
  }

  Future<ImportOutcome> importCustomers(MappedImport mapped) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    final iso = DateTime.now().toIso8601String();
    var imported = 0;
    for (final row in mapped.rows) {
      final name = row['name'] ?? '';
      if (name.isEmpty) continue;
      final phone = row['phone'] ?? '';
      final balance = parseNum(row['amountDue']) - parseNum(row['advance']);
      final id = 'import-cust-${phone.hashCode}-${name.hashCode}';
      await _customers.mergeRemoteCustomerDocument(
        id,
        <String, dynamic>{
          'name': name,
          'phone': phone,
          'email': row['email'] ?? '',
          'status': 'active',
          'balance': balance,
          'total_spent': 0,
          'tombstone': false,
          'updatedAt': iso,
        },
        updatedAt: now,
      );
      imported++;
    }
    return ImportOutcome(imported: imported, skipped: mapped.rows.length - imported);
  }
}
