import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/mobile_models.dart';
import 'local_database.dart';

final shopRepositoryProvider = Provider<ShopRepository>((ref) {
  return ShopRepository(ref.watch(localDatabaseProvider));
});

final inventoryRepositoryProvider = Provider<InventoryRepository>((ref) {
  return InventoryRepository(ref.watch(localDatabaseProvider));
});

final salesRepositoryProvider = Provider<SalesRepository>((ref) {
  return SalesRepository(ref.watch(localDatabaseProvider));
});

class ShopRepository {
  ShopRepository(this._db);

  final BusinessHubDatabase _db;

  Stream<ShopInfo> watchShopInfo() {
    final query = (_db.select(_db.shopSettingsEntries)
          ..where((tbl) => tbl.key.equals('settings')))
        .watchSingleOrNull();

    return query.map((row) {
      if (row == null) {
        return ShopInfo.fallback();
      }

      try {
        final decoded = jsonDecode(row.value) as Map<String, dynamic>;
        return ShopInfo(
          name: (decoded['name'] ?? 'Business Hub Pro').toString(),
          tagline: (decoded['tagline'] ?? 'Flutter mobile beta').toString(),
          footer: (decoded['footer'] ?? 'Thank you for your business!')
              .toString(),
          currency: (decoded['currency'] ?? 'INR').toString(),
          phone: (decoded['phone'] ?? '').toString(),
        );
      } catch (_) {
        return ShopInfo.fallback();
      }
    });
  }

  Future<void> saveShopDocument(Map<String, dynamic> rawData) async {
    final settings = Map<String, dynamic>.from(
      rawData['settings'] is Map ? rawData['settings'] as Map : const {},
    );
    settings['name'] = rawData['name'] ?? settings['name'] ?? 'Business Hub Pro';

    await _db.into(_db.shopSettingsEntries).insertOnConflictUpdate(
          ShopSettingsEntriesCompanion.insert(
            key: 'settings',
            value: jsonEncode(settings),
            updatedAt: DateTime.now().millisecondsSinceEpoch,
          ),
        );
  }
}

class InventoryRepository {
  InventoryRepository(this._db);

  final BusinessHubDatabase _db;

  Stream<DashboardOverview> watchDashboardOverview({
    required bool includeCost,
  }) {
    final today = DateTime.now().toIso8601String().split('T').first;
    final sql = '''
      SELECT
        COUNT(i.id) AS total_items,
        COALESCE(SUM(i.stock), 0) AS total_stock,
        COALESCE(SUM(i.price * i.stock), 0) AS inventory_value,
        COALESCE(SUM((i.price - ${includeCost ? 'COALESCE(ip.cost_price, 0)' : '0'}) * i.stock), 0) AS potential_profit,
        COALESCE(SUM(CASE WHEN i.stock <= 5 THEN 1 ELSE 0 END), 0) AS low_stock,
        COALESCE((SELECT COUNT(*) FROM sales s WHERE s.tombstone = 0 AND s.date = ?), 0) AS today_sales,
        COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.tombstone = 0 AND s.date = ?), 0) AS today_revenue
      FROM inventory i
      LEFT JOIN inventory_private ip ON ip.id = i.id AND ip.tombstone = 0
      WHERE i.tombstone = 0;
    ''';

    return _db
        .customSelect(
          sql,
          variables: [Variable<String>(today), Variable<String>(today)],
          readsFrom: {
            _db.inventoryEntries,
            _db.inventoryPrivateEntries,
            _db.salesEntries,
          },
        )
        .watchSingle()
        .map((row) {
      final metrics = InventoryMetrics(
        totalItems: row.read<int>('total_items'),
        totalStock: row.read<int>('total_stock'),
        inventoryValue: row.read<double>('inventory_value'),
        potentialProfit: row.read<double>('potential_profit'),
        lowStock: row.read<int>('low_stock'),
      );

      return DashboardOverview(
        metrics: metrics,
        todaySalesCount: row.read<int>('today_sales'),
        todayRevenue: row.read<double>('today_revenue'),
      );
    });
  }

  Stream<List<LowStockItem>> watchLowStockPreview({int limit = 8}) {
    return _db
        .customSelect(
          '''
            SELECT id, name, COALESCE(category, 'General') AS category, stock, size
            FROM inventory
            WHERE tombstone = 0 AND stock <= 5
            ORDER BY stock ASC, LOWER(name) ASC
            LIMIT ?;
          ''',
          variables: [Variable<int>(limit)],
          readsFrom: {_db.inventoryEntries},
        )
        .watch()
        .map(
          (rows) => rows
              .map(
                (row) => LowStockItem(
                  id: row.read<String>('id'),
                  name: row.read<String>('name'),
                  category: row.read<String>('category'),
                  stock: row.read<int>('stock'),
                  size: row.readNullable<String>('size'),
                ),
              )
              .toList(growable: false),
        );
  }

  Stream<List<InventoryCategorySummary>> watchCategories() {
    return _db
        .customSelect(
          '''
            SELECT COALESCE(category, 'General') AS category, COUNT(*) AS product_count
            FROM inventory
            WHERE tombstone = 0
            GROUP BY COALESCE(category, 'General')
            ORDER BY LOWER(COALESCE(category, 'General')) ASC;
          ''',
          readsFrom: {_db.inventoryEntries},
        )
        .watch()
        .map(
          (rows) => rows
              .map(
                (row) => InventoryCategorySummary(
                  category: row.read<String>('category'),
                  productCount: row.read<int>('product_count'),
                ),
              )
              .toList(growable: false),
        );
  }

  Stream<int> watchCatalogCount({
    String search = '',
    String? category,
    bool lowStockOnly = false,
  }) {
    final normalized = search.trim().toLowerCase();
    final where = <String>['tombstone = 0'];
    final variables = <Variable<Object>>[];

    if (category != null && category.isNotEmpty) {
      where.add("COALESCE(category, 'General') = ?");
      variables.add(Variable<String>(category));
    }
    if (lowStockOnly) {
      where.add('stock <= 5');
    }
    if (normalized.isNotEmpty) {
      where.add(
        "(LOWER(name) LIKE ? OR LOWER(COALESCE(sku, '')) LIKE ? OR LOWER(COALESCE(size, '')) LIKE ?)",
      );
      final like = '%$normalized%';
      variables
        ..add(Variable<String>(like))
        ..add(Variable<String>(like))
        ..add(Variable<String>(like));
    }

    return _db
        .customSelect(
          'SELECT COUNT(*) AS total FROM inventory WHERE ${where.join(' AND ')};',
          variables: variables,
          readsFrom: {_db.inventoryEntries},
        )
        .watchSingle()
        .map((row) => row.read<int>('total'));
  }

  Stream<List<InventoryCatalogItem>> watchCatalogPage({
    String search = '',
    String? category,
    int page = 1,
    int pageSize = 40,
    bool includeCost = false,
    bool lowStockOnly = false,
  }) {
    final normalized = search.trim().toLowerCase();
    final safePage = page < 1 ? 1 : page;
    final offset = (safePage - 1) * pageSize;
    final where = <String>['i.tombstone = 0'];
    final variables = <Variable<Object>>[];

    if (category != null && category.isNotEmpty) {
      where.add("COALESCE(i.category, 'General') = ?");
      variables.add(Variable<String>(category));
    }
    if (lowStockOnly) {
      where.add('i.stock <= 5');
    }
    if (normalized.isNotEmpty) {
      where.add(
        "(LOWER(i.name) LIKE ? OR LOWER(COALESCE(i.sku, '')) LIKE ? OR LOWER(COALESCE(i.size, '')) LIKE ?)",
      );
      final like = '%$normalized%';
      variables
        ..add(Variable<String>(like))
        ..add(Variable<String>(like))
        ..add(Variable<String>(like));
    }

    final sql = '''
      SELECT
        i.id,
        i.name,
        i.price,
        i.sku,
        COALESCE(i.category, 'General') AS category,
        i.subcategory,
        i.size,
        i.description,
        i.stock,
        i.source_meta,
        i.created_at,
        ${includeCost ? 'COALESCE(ip.cost_price, 0)' : 'NULL'} AS cost_price
      FROM inventory i
      LEFT JOIN inventory_private ip ON ip.id = i.id AND ip.tombstone = 0
      WHERE ${where.join(' AND ')}
      ORDER BY LOWER(i.name) ASC, LOWER(COALESCE(i.size, '')) ASC
      LIMIT ? OFFSET ?;
    ''';

    variables
      ..add(Variable<int>(pageSize))
      ..add(Variable<int>(offset));

    return _db
        .customSelect(
          sql,
          variables: variables,
          readsFrom: {_db.inventoryEntries, _db.inventoryPrivateEntries},
        )
        .watch()
        .map((rows) => rows.map(_mapCatalogRow).toList(growable: false));
  }

  Future<InventoryCatalogItem?> findByExactLookup(
    String lookup, {
    required bool includeCost,
  }) async {
    final value = lookup.trim().toLowerCase();
    if (value.isEmpty) return null;

    final rows = await _db.customSelect(
      '''
        SELECT
          i.id,
          i.name,
          i.price,
          i.sku,
          COALESCE(i.category, 'General') AS category,
          i.subcategory,
          i.size,
          i.description,
          i.stock,
          i.source_meta,
          i.created_at,
          ${includeCost ? 'COALESCE(ip.cost_price, 0)' : 'NULL'} AS cost_price
        FROM inventory i
        LEFT JOIN inventory_private ip ON ip.id = i.id AND ip.tombstone = 0
        WHERE i.tombstone = 0
          AND (
            LOWER(i.id) = ?
            OR LOWER(COALESCE(i.sku, '')) = ?
          )
        LIMIT 1;
      ''',
      variables: [Variable<String>(value), Variable<String>(value)],
      readsFrom: {_db.inventoryEntries, _db.inventoryPrivateEntries},
    ).get();

    if (rows.isEmpty) return null;
    return _mapCatalogRow(rows.first);
  }

  Future<void> mergeInventoryDocument(
    String id,
    Map<String, dynamic> data, {
    required int updatedAt,
  }) async {
    final createdAt = _asEpoch(data['createdAt']) ?? updatedAt;
    await _db.into(_db.inventoryEntries).insertOnConflictUpdate(
          InventoryEntriesCompanion.insert(
            id: id,
            name: (data['name'] ?? 'Unnamed item').toString(),
            price: _asDouble(data['price']),
            sku: Value(_asStringOrNull(data['sku'])),
            category: Value(
              _asStringOrNull(data['category'])?.trim().isNotEmpty == true
                  ? _asStringOrNull(data['category'])!
                  : 'General',
            ),
            subcategory: Value(_asStringOrNull(data['subcategory'])),
            size: Value(_asStringOrNull(data['size'])),
            description: Value(_asStringOrNull(data['description'])),
            stock: Value(_asInt(data['stock'])),
            sourceMeta: Value(_encodeNullableJson(data['sourceMeta'])),
            createdAt: createdAt,
            updatedAt: Value(updatedAt),
            tombstone: Value(data['tombstone'] == true),
          ),
        );
  }

  Future<void> mergeInventoryPrivateDocument(
    String id,
    Map<String, dynamic> data, {
    required int updatedAt,
  }) async {
    await _db
        .into(_db.inventoryPrivateEntries)
        .insertOnConflictUpdate(
          InventoryPrivateEntriesCompanion.insert(
            id: id,
            costPrice: Value(_asDouble(data['costPrice'])),
            supplierId: Value(_asStringOrNull(data['supplierId'])),
            lastPurchaseDate: Value(_asStringOrNull(data['lastPurchaseDate'])),
            updatedAt: Value(updatedAt),
            tombstone: Value(data['tombstone'] == true),
          ),
        );
  }

  InventoryCatalogItem _mapCatalogRow(QueryRow row) {
    return InventoryCatalogItem(
      id: row.read<String>('id'),
      name: row.read<String>('name'),
      price: row.read<double>('price'),
      sku: row.readNullable<String>('sku'),
      category: row.read<String>('category'),
      subcategory: row.readNullable<String>('subcategory'),
      size: row.readNullable<String>('size'),
      description: row.readNullable<String>('description'),
      stock: row.read<int>('stock'),
      sourceMeta: row.readNullable<String>('source_meta'),
      createdAt: DateTime.fromMillisecondsSinceEpoch(row.read<int>('created_at')),
      costPrice: row.readNullable<double>('cost_price'),
    );
  }
}

class SalesRepository {
  SalesRepository(this._db);

  final BusinessHubDatabase _db;

  Stream<List<RecentSaleSummary>> watchRecentSales({int limit = 8}) {
    return (_db.select(_db.salesEntries)
          ..where((tbl) => tbl.tombstone.equals(false))
          ..orderBy([(tbl) => OrderingTerm.desc(tbl.createdAt)])
          ..limit(limit))
        .watch()
        .map(
          (rows) => rows
              .map(
                (row) => RecentSaleSummary(
                  id: row.id,
                  total: row.total,
                  date: row.date,
                  paymentMode: row.paymentMode,
                  customerName: row.customerName,
                ),
              )
              .toList(growable: false),
        );
  }

  Future<void> mergeRemoteSaleDocument(
    String id,
    Map<String, dynamic> data, {
    required int updatedAt,
  }) async {
    final createdAt = _asEpoch(data['createdAt']) ?? updatedAt;
    final payments = data['payments'] is List
        ? jsonEncode(data['payments'])
        : jsonEncode(const []);
    final items = data['items'] is List ? jsonEncode(data['items']) : jsonEncode(const []);

    await _db.into(_db.salesEntries).insertOnConflictUpdate(
          SalesEntriesCompanion.insert(
            id: id,
            total: _asDouble(data['total']),
            discount: Value(_asDouble(data['discount'])),
            discountType: Value((data['discountType'] ?? 'fixed').toString()),
            paymentMode: Value((data['paymentMode'] ?? 'CASH').toString()),
            date: (data['date'] ?? DateTime.now().toIso8601String().split('T').first)
                .toString(),
            createdAt: createdAt,
            updatedAt: Value(updatedAt),
            customerName: Value(_asStringOrNull(data['customerName'])),
            customerPhone: Value(_asStringOrNull(data['customerPhone'])),
            customerId: Value(_asStringOrNull(data['customerId'])),
            footerNote: Value(_asStringOrNull(data['footerNote'])),
            itemsJson: items,
            paymentsJson: payments,
            tombstone: Value(data['tombstone'] == true),
          ),
        );
  }

  Future<LocalSaleCommit> recordLocalSale({
    required List<PosCartItem> items,
    required List<PosPayment> payments,
    required String paymentMode,
    required String footerNote,
    String? customerName,
    String? customerPhone,
    double discount = 0,
  }) async {
    final saleId = 'sale-${DateTime.now().millisecondsSinceEpoch}';
    final now = DateTime.now();
    final createdAt = now.toIso8601String();
    final date = createdAt.split('T').first;
    final inventoryDeltas = <String, int>{};
    final totalBeforeDiscount =
        items.fold<double>(0, (sum, item) => sum + item.lineTotal);
    final total = totalBeforeDiscount - discount;
    final encodedItems = items.map((item) => item.toSaleJson()).toList(growable: false);
    final encodedPayments =
        payments.map((payment) => payment.toJson()).toList(growable: false);

    for (final item in items) {
      inventoryDeltas[item.id] = (inventoryDeltas[item.id] ?? 0) - item.quantity;
    }

    await _db.transaction(() async {
      await _db.into(_db.salesEntries).insert(
            SalesEntriesCompanion.insert(
              id: saleId,
              total: total,
              discount: Value(discount),
              discountType: const Value('fixed'),
              paymentMode: Value(paymentMode),
              date: date,
              createdAt: now.millisecondsSinceEpoch,
              updatedAt: Value(now.millisecondsSinceEpoch),
              customerName: Value(customerName),
              customerPhone: Value(customerPhone),
              footerNote: Value(footerNote),
              itemsJson: jsonEncode(encodedItems),
              paymentsJson: jsonEncode(encodedPayments),
            ),
          );

      for (final item in items) {
        await (_db.update(_db.inventoryEntries)..where((tbl) => tbl.id.equals(item.id))).write(
          InventoryEntriesCompanion(
            stock: Value(item.stock - item.quantity),
            updatedAt: Value(now.millisecondsSinceEpoch),
          ),
        );
      }
    });

    return LocalSaleCommit(
      saleId: saleId,
      date: date,
      createdAt: createdAt,
      total: total,
      discount: discount,
      discountType: 'fixed',
      paymentMode: paymentMode,
      items: encodedItems,
      payments: encodedPayments,
      customerName: customerName,
      customerPhone: customerPhone,
      footerNote: footerNote,
      inventoryDeltas: inventoryDeltas,
    );
  }
}

double _asDouble(Object? value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? 0;
  return 0;
}

int _asInt(Object? value) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}

int? _asEpoch(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) {
    final parsedDate = DateTime.tryParse(value);
    if (parsedDate != null) return parsedDate.millisecondsSinceEpoch;
    return int.tryParse(value);
  }
  return null;
}

String? _asStringOrNull(Object? value) {
  if (value == null) return null;
  final next = value.toString().trim();
  return next.isEmpty ? null : next;
}

String? _encodeNullableJson(Object? value) {
  if (value == null) return null;
  try {
    return jsonEncode(value);
  } catch (_) {
    return null;
  }
}
