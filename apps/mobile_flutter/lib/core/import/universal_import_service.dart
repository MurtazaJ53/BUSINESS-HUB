import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/mobile_repository.dart';
import 'universal_import.dart';

final universalImportServiceProvider = Provider<UniversalImportService>((ref) {
  return UniversalImportService(
    ref.watch(inventoryRepositoryProvider),
    ref.watch(customerRepositoryProvider),
    ref.watch(salesRepositoryProvider),
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
  UniversalImportService(this._inventory, this._customers, this._sales);

  final InventoryRepository _inventory;
  final CustomerRepository _customers;
  final SalesRepository _sales;

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

  /// Import flat sales rows (one row per bill) as historical sales — they show
  /// in History/Reports but do not change current stock or balances.
  Future<ImportOutcome> importSales(MappedImport mapped) async {
    var imported = 0;
    for (final row in mapped.rows) {
      final total = parseNum(row['total']);
      if (total <= 0) continue;
      final rawDate = (row['date'] ?? '').trim();
      final dt = DateTime.tryParse(rawDate) ?? DateTime.now();
      final date = dt.toIso8601String().split('T').first;
      final pay = _normalizePayment(row['payment'] ?? 'CASH');
      final id = 'import-sale-${row.hashCode}-${dt.millisecondsSinceEpoch}';
      await _sales.importHistoricalSale(
        id: id,
        date: date,
        createdAtMillis: dt.millisecondsSinceEpoch,
        total: total,
        discount: parseNum(row['discount']),
        paymentMode: pay,
        customerName: (row['customerName'] ?? '').isEmpty ? null : row['customerName'],
        customerPhone: (row['customerPhone'] ?? '').isEmpty ? null : row['customerPhone'],
        footerNote: 'Imported sale',
        items: const <Map<String, dynamic>>[],
        payments: <Map<String, dynamic>>[
          <String, dynamic>{'mode': pay, 'amount': total},
        ],
      );
      imported++;
    }
    return ImportOutcome(imported: imported, skipped: mapped.rows.length - imported);
  }

  /// Export all products as CSV (round-trips with the products importer).
  Future<String> exportProductsCsv() async {
    final items =
        await _inventory.watchCatalogPage(pageSize: 100000, includeCost: true).first;
    final rows = items
        .map((i) => <String, String>{
              'name': i.name,
              'price': _n(i.price),
              'costPrice': i.costPrice == null ? '' : _n(i.costPrice!),
              'stock': _n(i.stock),
              'sku': i.sku ?? '',
              'category': i.category,
              'hsnCode': i.hsnCode ?? '',
              'gstRate': _n(i.gstRate),
            })
        .toList();
    return exportCsvFor(ImportKind.products, rows);
  }

  /// Export all customers as CSV (round-trips with the customers importer).
  Future<String> exportCustomersCsv() async {
    final custs = await _customers.watchLegacyCustomers().first;
    final rows = custs
        .map((c) => <String, String>{
              'name': c.name,
              'phone': c.phone ?? '',
              'email': c.email ?? '',
              'amountDue': c.balance > 0 ? _n(c.balance) : '0',
              'advance': c.balance < 0 ? _n(-c.balance) : '0',
            })
        .toList();
    return exportCsvFor(ImportKind.customers, rows);
  }

  static String _n(num v) =>
      v == v.roundToDouble() ? v.toInt().toString() : v.toString();

  static String _normalizePayment(String raw) {
    final v = raw.toLowerCase();
    if (v.contains('upi')) return 'UPI';
    if (v.contains('card')) return 'CARD';
    if (v.contains('credit') || v.contains('due')) return 'CREDIT';
    if (v.contains('bank') || v.contains('online')) return 'BANK';
    if (v.contains('cash')) return 'CASH';
    return raw.trim().isEmpty ? 'CASH' : raw.trim().toUpperCase();
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
