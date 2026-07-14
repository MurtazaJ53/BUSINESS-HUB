import 'dart:convert';
import 'dart:math';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/mobile_models.dart';
import '../runtime/pilot_evidence_tracker.dart';
import 'local_database.dart';

final shopRepositoryProvider = Provider<ShopRepository>((ref) {
  return ShopRepository(ref.watch(localDatabaseProvider));
});

final inventoryRepositoryProvider = Provider<InventoryRepository>((ref) {
  return InventoryRepository(ref.watch(localDatabaseProvider));
});

final customerRepositoryProvider = Provider<CustomerRepository>((ref) {
  return CustomerRepository(ref.watch(localDatabaseProvider));
});

final salesRepositoryProvider = Provider<SalesRepository>((ref) {
  return SalesRepository(ref.watch(localDatabaseProvider));
});

class ShopRepository {
  ShopRepository(this._db);

  final BusinessHubDatabase _db;
  static const String _pilotEvidenceTrackerKey = 'pilot_evidence_tracker';
  static const String _appInstanceIdKey = 'app_instance_id';
  static const String _mfaVerifiedUntilKey = 'mfa_verified_until';

  Stream<ShopInfo> watchShopInfo() {
    final query = (_db.select(
      _db.shopSettingsEntries,
    )..where((tbl) => tbl.key.equals('settings'))).watchSingleOrNull();

    return query.map((row) {
      if (row == null) {
        return ShopInfo.fallback();
      }

      try {
        final decoded = jsonDecode(row.value) as Map<String, dynamic>;
        return ShopInfo(
          name: (decoded['name'] ?? 'Business Hub Pro').toString(),
          tagline: (decoded['tagline'] ?? 'ZARRA ECOSYSTEM').toString(),
          footer: (decoded['footer'] ?? 'Thank you for your business!')
              .toString(),
          currency: (decoded['currency'] ?? 'INR').toString(),
          phone: (decoded['phone'] ?? '').toString(),
          gstin: (decoded['gstin'] ?? '').toString(),
          planTier: (decoded['plan_tier'] ?? 'growth').toString(),
          enabledFeatures: _coerceEnabledFeatures(
            decoded['enabled_features'],
            fallbackPlanTier: (decoded['plan_tier'] ?? 'growth').toString(),
          ),
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
    settings['name'] =
        rawData['name'] ?? settings['name'] ?? 'Business Hub Pro';
    settings['tagline'] =
        settings['tagline'] ??
        rawData['tagline'] ??
        rawData['ecosystem'] ??
        'ZARRA ECOSYSTEM';
    settings['footer'] =
        settings['footer'] ??
        rawData['footer'] ??
        'Thank you for your business!';
    settings['currency'] = settings['currency'] ?? rawData['currency'] ?? 'INR';
    settings['phone'] = settings['phone'] ?? rawData['phone'] ?? '';
    settings['gstin'] = rawData['gstin'] ?? settings['gstin'] ?? '';
    settings['plan_tier'] =
        rawData['plan_tier'] ?? settings['plan_tier'] ?? 'growth';
    settings['enabled_features'] = _coerceEnabledFeatures(
      rawData['enabled_features'] ?? settings['enabled_features'],
      fallbackPlanTier: settings['plan_tier'].toString(),
    );

    await _db
        .into(_db.shopSettingsEntries)
        .insertOnConflictUpdate(
          ShopSettingsEntriesCompanion.insert(
            key: 'settings',
            value: jsonEncode(settings),
            updatedAt: DateTime.now().millisecondsSinceEpoch,
          ),
        );
  }

  Future<String?> readSetting(String key) async {
    final row = await (_db.select(
      _db.shopSettingsEntries,
    )..where((tbl) => tbl.key.equals(key))).getSingleOrNull();
    return row?.value;
  }

  Future<void> writeSetting(String key, String value) async {
    await _db
        .into(_db.shopSettingsEntries)
        .insertOnConflictUpdate(
          ShopSettingsEntriesCompanion.insert(
            key: key,
            value: value,
            updatedAt: DateTime.now().millisecondsSinceEpoch,
          ),
        );
  }

  Future<void> saveDomainState({required DomainControlState state}) async {
    await _db
        .into(_db.shopSettingsEntries)
        .insertOnConflictUpdate(
          ShopSettingsEntriesCompanion.insert(
            key: 'domain_state_${state.domain}',
            value: jsonEncode(state.toJson()),
            updatedAt: DateTime.now().millisecondsSinceEpoch,
          ),
        );
  }

  Stream<DomainControlState> watchDomainState(String domain) {
    final query =
        (_db.select(_db.shopSettingsEntries)
              ..where((tbl) => tbl.key.equals('domain_state_$domain')))
            .watchSingleOrNull();

    return query.map((row) {
      if (row == null) {
        return DomainControlState.legacy(domain);
      }

      try {
        final decoded = jsonDecode(row.value) as Map<String, dynamic>;
        return DomainControlState.fromJson(decoded, fallbackDomain: domain);
      } catch (_) {
        return DomainControlState.legacy(domain);
      }
    });
  }

  Stream<List<DomainControlState>> watchTrackedDomainStates(
    List<String> domains,
  ) {
    if (domains.isEmpty) {
      return Stream.value(const <DomainControlState>[]);
    }

    final keys = domains.map((domain) => 'domain_state_$domain').toList();
    return (_db.select(
      _db.shopSettingsEntries,
    )..where((tbl) => tbl.key.isIn(keys))).watch().map((rows) {
      final decodedByDomain = <String, DomainControlState>{};
      for (final row in rows) {
        try {
          final decoded = jsonDecode(row.value) as Map<String, dynamic>;
          final domain =
              (decoded['domain'] ?? row.key.replaceFirst('domain_state_', ''))
                  .toString();
          decodedByDomain[domain] = DomainControlState.fromJson(
            decoded,
            fallbackDomain: domain,
          );
        } catch (_) {
          continue;
        }
      }

      return domains
          .map(
            (domain) =>
                decodedByDomain[domain] ?? DomainControlState.legacy(domain),
          )
          .toList(growable: false);
    });
  }

  Future<int> getDomainEpoch(String domain) async {
    final row =
        await (_db.select(_db.shopSettingsEntries)
              ..where((tbl) => tbl.key.equals('domain_state_$domain')))
            .getSingleOrNull();

    if (row == null) {
      return 1;
    }

    try {
      final decoded = jsonDecode(row.value) as Map<String, dynamic>;
      final epoch = decoded['current_epoch'];
      if (epoch is int) {
        return epoch;
      }
      if (epoch is num) {
        return epoch.toInt();
      }
      if (epoch is String) {
        return int.tryParse(epoch) ?? 1;
      }
      return 1;
    } catch (_) {
      return 1;
    }
  }

  Stream<PilotEvidenceTrackerState> watchPilotEvidenceTracker() {
    final query =
        (_db.select(_db.shopSettingsEntries)
              ..where((tbl) => tbl.key.equals(_pilotEvidenceTrackerKey)))
            .watchSingleOrNull();

    return query.map((row) {
      if (row == null) {
        return const PilotEvidenceTrackerState();
      }
      return _decodePilotEvidenceTracker(row.value);
    });
  }

  Future<PilotEvidenceTrackerState> getPilotEvidenceTracker() async {
    final row =
        await (_db.select(_db.shopSettingsEntries)
              ..where((tbl) => tbl.key.equals(_pilotEvidenceTrackerKey)))
            .getSingleOrNull();

    if (row == null) {
      return const PilotEvidenceTrackerState();
    }
    return _decodePilotEvidenceTracker(row.value);
  }

  Future<void> savePilotEvidenceTracker(PilotEvidenceTrackerState state) async {
    if (!state.hasStoredState) {
      await (_db.delete(
        _db.shopSettingsEntries,
      )..where((tbl) => tbl.key.equals(_pilotEvidenceTrackerKey))).go();
      return;
    }

    await _db
        .into(_db.shopSettingsEntries)
        .insertOnConflictUpdate(
          ShopSettingsEntriesCompanion.insert(
            key: _pilotEvidenceTrackerKey,
            value: jsonEncode(state.toJson()),
            updatedAt: DateTime.now().millisecondsSinceEpoch,
          ),
        );
  }

  Future<void> markPilotEvidenceCaptured(
    String artifactId, {
    DateTime? capturedAt,
  }) async {
    final current = await getPilotEvidenceTracker();
    final next = current.markCaptured(artifactId, capturedAt: capturedAt);
    await savePilotEvidenceTracker(next);
  }

  Future<void> ensurePilotEvidenceSession(String defaultLabel) async {
    final current = await getPilotEvidenceTracker();
    final next = current.ensureSession(defaultLabel: defaultLabel);
    if (identical(next, current)) {
      return;
    }
    await savePilotEvidenceTracker(next);
  }

  Future<void> startFreshPilotEvidenceSession(String sessionLabel) async {
    final next = const PilotEvidenceTrackerState().startFreshSession(
      sessionLabel: sessionLabel,
    );
    await savePilotEvidenceTracker(next);
  }

  Future<void> resetPilotEvidenceTracker() async {
    await savePilotEvidenceTracker(const PilotEvidenceTrackerState());
  }

  Future<void> clearPilotEvidenceArchive() async {
    final current = await getPilotEvidenceTracker();
    final next = current.withoutArchivedSessions();
    await savePilotEvidenceTracker(next);
  }

  Stream<DateTime?> watchMfaVerifiedUntil() {
    final query =
        (_db.select(_db.shopSettingsEntries)
              ..where((tbl) => tbl.key.equals(_mfaVerifiedUntilKey)))
            .watchSingleOrNull();
    return query.map((row) => _decodeStoredDateTime(row?.value));
  }

  Future<void> saveMfaVerifiedUntil(DateTime? value) async {
    if (value == null) {
      await (_db.delete(
        _db.shopSettingsEntries,
      )..where((tbl) => tbl.key.equals(_mfaVerifiedUntilKey))).go();
      return;
    }

    await _saveShopSetting(_mfaVerifiedUntilKey, value.toIso8601String());
  }

  Future<String> ensureAppInstanceId() async {
    final existing = await _readShopSetting(_appInstanceIdKey);
    if (existing != null && existing.trim().isNotEmpty) {
      return existing.trim();
    }

    final random = Random.secure();
    final next =
        'mobile-${DateTime.now().microsecondsSinceEpoch.toRadixString(16)}-'
        '${List<String>.generate(6, (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0')).join()}';
    await _saveShopSetting(_appInstanceIdKey, next);
    return next;
  }

  Future<void> clearWorkspace({bool preserveAppInstanceId = true}) async {
    final preservedAppInstanceId = preserveAppInstanceId
        ? await _readShopSetting(_appInstanceIdKey)
        : null;

    await _db.delete(_db.shopSettingsEntries).go();

    if (preservedAppInstanceId != null &&
        preservedAppInstanceId.trim().isNotEmpty) {
      await _saveShopSetting(_appInstanceIdKey, preservedAppInstanceId.trim());
    }
  }

  PilotEvidenceTrackerState _decodePilotEvidenceTracker(String rawValue) {
    try {
      final decoded = jsonDecode(rawValue) as Map<String, dynamic>;
      return PilotEvidenceTrackerState.fromJson(decoded);
    } catch (_) {
      return const PilotEvidenceTrackerState();
    }
  }

  Future<String?> _readShopSetting(String key) async {
    final row = await (_db.select(
      _db.shopSettingsEntries,
    )..where((tbl) => tbl.key.equals(key))).getSingleOrNull();
    return row?.value;
  }

  Future<void> _saveShopSetting(String key, String value) async {
    await _db
        .into(_db.shopSettingsEntries)
        .insertOnConflictUpdate(
          ShopSettingsEntriesCompanion.insert(
            key: key,
            value: value,
            updatedAt: DateTime.now().millisecondsSinceEpoch,
          ),
        );
  }

  DateTime? _decodeStoredDateTime(String? rawValue) {
    if (rawValue == null || rawValue.trim().isEmpty) {
      return null;
    }
    return DateTime.tryParse(rawValue.trim())?.toLocal();
  }
}

Map<String, bool> _coerceEnabledFeatures(
  dynamic rawValue, {
  required String fallbackPlanTier,
}) {
  final normalizedPlan = fallbackPlanTier.trim().toLowerCase();
  final features = <String, bool>{
    'expenses': normalizedPlan != 'starter',
    'attendance': normalizedPlan != 'starter',
    'supplier_directory': normalizedPlan != 'starter',
    'purchase_workflow': normalizedPlan == 'pro',
    'advanced_reports': normalizedPlan == 'pro',
    'finance_summary': normalizedPlan == 'pro',
    'advanced_ops': normalizedPlan == 'pro',
  };

  if (rawValue is Map) {
    for (final entry in rawValue.entries) {
      features[entry.key.toString()] = entry.value == true;
    }
  }

  return features;
}

class InventoryRepository {
  InventoryRepository(this._db);

  final BusinessHubDatabase _db;

  Stream<DashboardOverview> watchDashboardOverview({
    required bool includeCost,
  }) {
    final today = DateTime.now().toIso8601String().split('T').first;
    final sql =
        '''
      SELECT
        COUNT(i.id) AS total_items,
        COALESCE(SUM(i.stock), 0) AS total_stock,
        COALESCE(SUM(i.price * i.stock), 0) AS inventory_value,
        COALESCE(SUM((i.price - ${includeCost ? 'COALESCE(ip.cost_price, 0)' : '0'}) * i.stock), 0) AS potential_profit,
        COALESCE(SUM(CASE WHEN i.stock <= COALESCE(i.reorder_level, 5) THEN 1 ELSE 0 END), 0) AS low_stock,
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
            WHERE tombstone = 0 AND stock <= COALESCE(reorder_level, 5)
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
      where.add('stock <= COALESCE(reorder_level, 5)');
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
      where.add('i.stock <= COALESCE(i.reorder_level, 5)');
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

    final sql =
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
        i.hsn_code,
        COALESCE(i.gst_rate, 0) AS gst_rate,
        COALESCE(i.price_includes_tax, 1) AS price_includes_tax,
        i.stock,
        i.source_meta,
        i.image_path,
        i.unit,
        i.reorder_level,
        i.variant_group_id,
        i.variant_label,
        i.created_at,
        ${includeCost ? 'COALESCE(ip.cost_price, 0)' : 'NULL'} AS cost_price,
        ip.supplier_id,
        ip.last_purchase_date
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

    final rows = await _db
        .customSelect(
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
          i.hsn_code,
          COALESCE(i.gst_rate, 0) AS gst_rate,
          COALESCE(i.price_includes_tax, 1) AS price_includes_tax,
          i.stock,
          i.source_meta,
          i.image_path,
          i.unit,
          i.reorder_level,
          i.variant_group_id,
          i.variant_label,
          i.created_at,
          ${includeCost ? 'COALESCE(ip.cost_price, 0)' : 'NULL'} AS cost_price,
          ip.supplier_id,
          ip.last_purchase_date
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
        )
        .get();

    if (rows.isEmpty) return null;
    return _mapCatalogRow(rows.first);
  }

  /// Rename a category across every item that carries it. Returns the number
  /// of items updated.
  Future<int> renameCategory(String from, String to) async {
    final normalized = to.trim().isEmpty ? 'General' : to.trim();
    return (_db.update(
      _db.inventoryEntries,
    )..where((tbl) => tbl.category.equals(from))).write(
      InventoryEntriesCompanion(
        category: Value(normalized),
        updatedAt: Value(DateTime.now().millisecondsSinceEpoch),
      ),
    );
  }

  Future<void> mergeInventoryDocument(
    String id,
    Map<String, dynamic> data, {
    required int updatedAt,
  }) async {
    final createdAt = _asEpoch(data['createdAt']) ?? updatedAt;
    await _db
        .into(_db.inventoryEntries)
        .insertOnConflictUpdate(
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
            hsnCode: Value(
              _asStringOrNull(data['hsnCode'] ?? data['hsn_code']),
            ),
            gstRate: Value(_asDouble(data['gstRate'] ?? data['gst_rate'])),
            priceIncludesTax: Value(
              _asBool(
                data['priceIncludesTax'] ?? data['price_includes_tax'],
                fallback: true,
              ),
            ),
            stock: Value(_asInt(data['stock'])),
            sourceMeta: Value(_encodeNullableJson(data['sourceMeta'])),
            // Only touch the photo when the caller supplies one, so imports and
            // sync merges that don't carry an image never wipe an existing one.
            imagePath:
                (data.containsKey('imagePath') ||
                    data.containsKey('image_path'))
                ? Value(_asStringOrNull(data['imagePath'] ?? data['image_path']))
                : const Value.absent(),
            unit: (data.containsKey('unit'))
                ? Value(_asStringOrNull(data['unit']))
                : const Value.absent(),
            reorderLevel:
                (data.containsKey('reorderLevel') ||
                    data.containsKey('reorder_level'))
                ? Value(_asIntOrNull(data['reorderLevel'] ?? data['reorder_level']))
                : const Value.absent(),
            variantGroupId:
                (data.containsKey('variantGroupId') ||
                    data.containsKey('variant_group_id'))
                ? Value(
                    _asStringOrNull(
                      data['variantGroupId'] ?? data['variant_group_id'],
                    ),
                  )
                : const Value.absent(),
            variantLabel:
                (data.containsKey('variantLabel') ||
                    data.containsKey('variant_label'))
                ? Value(
                    _asStringOrNull(
                      data['variantLabel'] ?? data['variant_label'],
                    ),
                  )
                : const Value.absent(),
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

  Future<void> mergeBackendInventoryItem(
    Map<String, dynamic> row, {
    int? updatedAt,
  }) async {
    final id = _asStringOrNull(row['id']);
    if (id == null) {
      return;
    }
    final resolvedUpdatedAt =
        updatedAt ??
        _asEpoch(row['updated_at'] ?? row['created_at']) ??
        DateTime.now().millisecondsSinceEpoch;

    await mergeInventoryDocument(id, <String, dynamic>{
      'name': row['name'],
      'price': row['sell_price'] ?? row['price'],
      'sku': row['sku'],
      'category': row['category'],
      'subcategory': row['subcategory'],
      'size': row['size'],
      'description': row['description'],
      'hsn_code': row['hsn_code'],
      'gst_rate': row['gst_rate'],
      'price_includes_tax': row['price_includes_tax'],
      'stock': row['stock_on_hand'] ?? row['stock'],
      'sourceMeta': row['source_meta_json'] ?? row['sourceMeta'],
      'createdAt': row['created_at'] ?? resolvedUpdatedAt,
      'updatedAt': row['updated_at'] ?? resolvedUpdatedAt,
      'tombstone': row['tombstone'] == true || row['status'] == 'archived',
    }, updatedAt: resolvedUpdatedAt);

    if (row.containsKey('cost_price') ||
        row.containsKey('supplier_id') ||
        row.containsKey('last_purchase_date')) {
      await mergeInventoryPrivateDocument(id, <String, dynamic>{
        'costPrice': row['cost_price'],
        'supplierId': row['supplier_id'],
        'lastPurchaseDate': row['last_purchase_date'],
        'updatedAt': row['updated_at'] ?? resolvedUpdatedAt,
        'tombstone': row['tombstone'] == true,
      }, updatedAt: resolvedUpdatedAt);
    }
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
      hsnCode: row.readNullable<String>('hsn_code'),
      gstRate: row.read<double>('gst_rate'),
      priceIncludesTax: row.read<bool>('price_includes_tax'),
      stock: row.read<int>('stock'),
      sourceMeta: row.readNullable<String>('source_meta'),
      imagePath: row.readNullable<String>('image_path'),
      unit: row.readNullable<String>('unit'),
      reorderLevel: row.readNullable<int>('reorder_level'),
      variantGroupId: row.readNullable<String>('variant_group_id'),
      variantLabel: row.readNullable<String>('variant_label'),
      createdAt: DateTime.fromMillisecondsSinceEpoch(
        row.read<int>('created_at'),
      ),
      costPrice: row.readNullable<double>('cost_price'),
      supplierId: row.readNullable<String>('supplier_id'),
      lastPurchaseDate: row.readNullable<String>('last_purchase_date'),
    );
  }

  /// Receive stock into an item (used by purchases). Increments stock, updates
  /// the last cost when supplied, and logs a movement — all in one transaction.
  Future<void> applyStockIn({
    required String itemId,
    required int quantity,
    double? unitCost,
    bool updateCost = true,
    String reason = 'PURCHASE',
    String? refId,
    String? actorName,
    String note = '',
  }) async {
    if (quantity == 0) return;
    final nowMillis = DateTime.now().millisecondsSinceEpoch;
    await _db.transaction(() async {
      final row =
          await (_db.select(_db.inventoryEntries)
                ..where((t) => t.id.equals(itemId)))
              .getSingleOrNull();
      if (row == null) return;
      final newStock = row.stock + quantity;
      await (_db.update(
        _db.inventoryEntries,
      )..where((t) => t.id.equals(itemId))).write(
        InventoryEntriesCompanion(
          stock: Value(newStock),
          updatedAt: Value(nowMillis),
        ),
      );
      if (updateCost && unitCost != null && unitCost > 0) {
        await _db
            .into(_db.inventoryPrivateEntries)
            .insertOnConflictUpdate(
              InventoryPrivateEntriesCompanion.insert(
                id: itemId,
                costPrice: Value(unitCost),
                lastPurchaseDate: Value(
                  DateTime.now().toIso8601String().split('T').first,
                ),
                updatedAt: Value(nowMillis),
              ),
            );
      }
      await _writeStockMovement(
        _db,
        itemId: itemId,
        itemName: row.name,
        delta: quantity,
        reason: reason,
        balanceAfter: newStock,
        refId: refId,
        actorName: actorName,
        note: note,
      );
    });
  }

  /// Log a manual stock correction (the delta between the old and new counts)
  /// so the audit trail explains every change, not just automated ones.
  Future<void> logStockAdjustment({
    required String itemId,
    required String itemName,
    required int oldStock,
    required int newStock,
    String? actorName,
    String note = 'Manual adjustment',
  }) async {
    final delta = newStock - oldStock;
    if (delta == 0) return;
    await _writeStockMovement(
      _db,
      itemId: itemId,
      itemName: itemName,
      delta: delta,
      reason: 'ADJUST',
      balanceAfter: newStock,
      note: note,
      actorName: actorName,
    );
  }

  Stream<List<StockMovement>> watchStockMovements({
    String? itemId,
    int limit = 200,
  }) {
    final where = <String>[];
    final vars = <Variable<Object>>[];
    if (itemId != null && itemId.isNotEmpty) {
      where.add('item_id = ?');
      vars.add(Variable<String>(itemId));
    }
    final whereSql = where.isEmpty ? '' : 'WHERE ${where.join(' AND ')} ';
    return _db
        .customSelect(
          'SELECT * FROM stock_movements ${whereSql}ORDER BY created_at DESC '
          'LIMIT ?;',
          variables: [...vars, Variable<int>(limit)],
          readsFrom: {_db.stockMovementEntries},
        )
        .watch()
        .map(
          (rows) => rows
              .map(
                (row) => StockMovement(
                  id: row.read<String>('id'),
                  itemId: row.read<String>('item_id'),
                  itemName: row.read<String>('item_name'),
                  delta: row.read<int>('delta'),
                  balanceAfter: row.readNullable<int>('balance_after'),
                  reason: row.read<String>('reason'),
                  refId: row.readNullable<String>('ref_id'),
                  note: row.read<String>('note'),
                  actorName: _asStringOrNull(
                    row.readNullable<String>('actor_name'),
                  ),
                  createdAt: DateTime.fromMillisecondsSinceEpoch(
                    row.read<int>('created_at'),
                  ),
                ),
              )
              .toList(growable: false),
        );
  }

  Future<void> clearWorkspace() async {
    await _db.transaction(() async {
      await _db.delete(_db.inventoryPrivateEntries).go();
      await _db.delete(_db.inventoryEntries).go();
      await _db.delete(_db.stockMovementEntries).go();
    });
  }
}

class CustomerRepository {
  CustomerRepository(this._db);

  final BusinessHubDatabase _db;

  Stream<List<BackendCustomerSummary>> watchLegacyCustomers({
    String search = '',
  }) {
    final normalized = search.trim().toLowerCase();
    final where = <String>['tombstone = 0'];
    final variables = <Variable<Object>>[];

    if (normalized.isNotEmpty) {
      where.add(
        "(LOWER(name) LIKE ? OR LOWER(COALESCE(phone, '')) LIKE ? OR LOWER(COALESCE(email, '')) LIKE ?)",
      );
      final like = '%$normalized%';
      variables
        ..add(Variable<String>(like))
        ..add(Variable<String>(like))
        ..add(Variable<String>(like));
    }

    final sql =
        '''
      SELECT
        id,
        name,
        phone,
        email,
        notes,
        status,
        total_spent,
        balance
      FROM customers
      WHERE ${where.join(' AND ')}
      ORDER BY
        CASE WHEN balance > 0 THEN 0 ELSE 1 END,
        balance DESC,
        LOWER(name) ASC;
    ''';

    return _db
        .customSelect(
          sql,
          variables: variables,
          readsFrom: {_db.customerEntries},
        )
        .watch()
        .map(
          (rows) => rows
              .map(
                (row) => BackendCustomerSummary(
                  id: row.read<String>('id'),
                  name: row.read<String>('name'),
                  phone: _asStringOrNull(row.readNullable<String>('phone')),
                  email: _asStringOrNull(row.readNullable<String>('email')),
                  notes: _asStringOrNull(row.readNullable<String>('notes')),
                  status: row.read<String>('status'),
                  totalSpent: row.read<double>('total_spent'),
                  balance: row.read<double>('balance'),
                ),
              )
              .toList(growable: false),
        );
  }

  Future<void> mergeRemoteCustomerDocument(
    String id,
    Map<String, dynamic> data, {
    required int updatedAt,
  }) async {
    final createdAt =
        _asEpoch(data['createdAt'] ?? data['created_at']) ?? updatedAt;
    final lastSeenAt =
        _asEpoch(data['lastSeenAt'] ?? data['last_seen_at']) ??
        _asEpoch(data['updatedAt'] ?? data['updated_at']) ??
        updatedAt;

    await _db
        .into(_db.customerEntries)
        .insertOnConflictUpdate(
          CustomerEntriesCompanion.insert(
            id: id,
            name: (data['name'] ?? data['customerName'] ?? 'Unnamed customer')
                .toString(),
            phone: Value(
              _asStringOrNull(
                data['phone'] ?? data['mobile'] ?? data['mobileNumber'],
              ),
            ),
            email: Value(_asStringOrNull(data['email'])),
            notes: Value(
              _asStringOrNull(data['notes'] ?? data['note'] ?? data['remark']),
            ),
            status: Value(
              _asStringOrNull(data['status']) ??
                  (data['tombstone'] == true ? 'archived' : 'active'),
            ),
            totalSpent: Value(
              _asDouble(
                data['totalSpent'] ??
                    data['total_spent'] ??
                    data['lifetimeSpend'] ??
                    data['lifetime_spend'],
              ),
            ),
            balance: Value(
              _asDouble(
                data['balance'] ??
                    data['currentBalance'] ??
                    data['current_balance'] ??
                    data['dueAmount'] ??
                    data['due_amount'],
              ),
            ),
            createdAt: createdAt,
            updatedAt: Value(updatedAt),
            lastSeenAt: Value(lastSeenAt),
            tombstone: Value(data['tombstone'] == true),
          ),
        );
  }

  /// Record a payment against a customer's due: reduce the balance (never below
  /// zero) and append a PAYMENT entry to their khata — atomically.
  Future<double> recordPayment({
    required String customerId,
    required double amount,
    String? actorName,
    String note = 'Payment received',
  }) async {
    final nowMillis = DateTime.now().millisecondsSinceEpoch;
    var newBalance = 0.0;
    await _db.transaction(() async {
      final row =
          await (_db.select(_db.customerEntries)
                ..where((t) => t.id.equals(customerId)))
              .getSingleOrNull();
      if (row == null) return;
      final applied = amount < 0 ? 0.0 : amount;
      newBalance = (row.balance - applied).clamp(0, double.infinity).toDouble();
      await (_db.update(
        _db.customerEntries,
      )..where((t) => t.id.equals(customerId))).write(
        CustomerEntriesCompanion(
          balance: Value(newBalance),
          updatedAt: Value(nowMillis),
        ),
      );
      await _writeCustomerLedger(
        _db,
        customerId: customerId,
        type: 'PAYMENT',
        amount: -applied,
        balanceAfter: newBalance,
        note: note,
        actorName: actorName,
      );
    });
    return newBalance;
  }

  Stream<List<CustomerLedgerRecord>> watchLedger(String customerId) {
    return _db
        .customSelect(
          'SELECT * FROM customer_ledger WHERE customer_id = ? '
          'ORDER BY created_at DESC;',
          variables: [Variable<String>(customerId)],
          readsFrom: {_db.customerLedgerEntries},
        )
        .watch()
        .map(
          (rows) => rows
              .map(
                (row) => CustomerLedgerRecord(
                  id: row.read<String>('id'),
                  customerId: row.read<String>('customer_id'),
                  type: row.read<String>('type'),
                  amount: row.read<double>('amount'),
                  balanceAfter: row.read<double>('balance_after'),
                  refId: _asStringOrNull(row.readNullable<String>('ref_id')),
                  note: row.read<String>('note'),
                  actorName: _asStringOrNull(
                    row.readNullable<String>('actor_name'),
                  ),
                  createdAt: DateTime.fromMillisecondsSinceEpoch(
                    row.read<int>('created_at'),
                  ),
                ),
              )
              .toList(growable: false),
        );
  }

  Future<void> clearWorkspace() async {
    await _db.transaction(() async {
      await _db.delete(_db.customerEntries).go();
      await _db.delete(_db.customerLedgerEntries).go();
    });
  }
}

class SalesRepository {
  SalesRepository(this._db);

  final BusinessHubDatabase _db;

  Stream<HistoryOverview> watchHistoryOverview() {
    return _db
        .customSelect(
          '''
            SELECT
              COUNT(*) AS total_sales,
              COALESCE(SUM(total), 0.0) AS total_revenue,
              COALESCE(SUM(CASE WHEN sync_status IN ('synced_backend', 'synced') THEN 1 ELSE 0 END), 0) AS synced_sales,
              COALESCE(SUM(CASE WHEN sync_status IN ('queued', 'syncing') THEN 1 ELSE 0 END), 0) AS queued_sales,
              COALESCE(SUM(CASE WHEN sync_status IN ('queued', 'syncing') THEN total ELSE 0 END), 0.0) AS queued_revenue,
              COALESCE(SUM(CASE WHEN sync_status IN ('failed_backend', 'failed') THEN 1 ELSE 0 END), 0) AS failed_sales,
              MAX(last_synced_at) AS last_synced_at
            FROM sales
            WHERE tombstone = 0;
          ''',
          readsFrom: {_db.salesEntries},
        )
        .watchSingle()
        .map(
          (row) => HistoryOverview(
            totalSales: row.read<int>('total_sales'),
            syncedSales: row.read<int>('synced_sales'),
            queuedSales: row.read<int>('queued_sales'),
            failedSales: row.read<int>('failed_sales'),
            totalRevenue: row.read<double>('total_revenue'),
            queuedRevenue: row.read<double>('queued_revenue'),
            lastSyncedAt: row.readNullable<int>('last_synced_at') == null
                ? null
                : DateTime.fromMillisecondsSinceEpoch(
                    row.read<int>('last_synced_at'),
                  ),
          ),
        );
  }

  Stream<List<RecentSaleSummary>> watchRecentSales({
    int limit = 8,
    String search = '',
    String? paymentMode,
    CommerceSyncState? syncState,
    HistoryFilter? filter,
  }) {
    final effectiveLimit = filter?.limit ?? limit;
    final normalized = (filter?.search ?? search).trim().toLowerCase();
    final effectivePaymentMode = filter?.paymentMode ?? paymentMode;
    final effectiveSyncState = filter?.syncState ?? syncState;
    final query = _db.select(_db.salesEntries)
      ..where((tbl) => tbl.tombstone.equals(false));

    if (normalized.isNotEmpty) {
      query.where(
        (tbl) =>
            tbl.customerName.lower().like('%$normalized%') |
            tbl.customerPhone.lower().like('%$normalized%') |
            tbl.id.lower().like('%$normalized%'),
      );
    }

    if (effectivePaymentMode != null && effectivePaymentMode.isNotEmpty) {
      query.where((tbl) => tbl.paymentMode.equals(effectivePaymentMode));
    }

    if (effectiveSyncState != null) {
      final statuses = switch (effectiveSyncState) {
        CommerceSyncState.localOnly => const ['local_only'],
        CommerceSyncState.queued => const ['queued'],
        CommerceSyncState.syncing => const ['syncing'],
        CommerceSyncState.synced => const ['synced_backend', 'synced'],
        CommerceSyncState.failed => const ['failed_backend', 'failed'],
      };
      query.where((tbl) => tbl.syncStatus.isIn(statuses));
    }

    final dateWindow = filter?.dateWindow ?? HistoryDateWindow.all;
    final exactDate = _historyExactDate(dateWindow);
    final sinceDate = _historySinceDate(dateWindow);
    if (exactDate != null) {
      query.where((tbl) => tbl.date.equals(exactDate));
    } else if (sinceDate != null) {
      query.where((tbl) => tbl.date.isBiggerOrEqualValue(sinceDate));
    }

    query
      ..orderBy([(tbl) => OrderingTerm.desc(tbl.createdAt)])
      ..limit(effectiveLimit);

    return query.watch().map(
      (rows) => rows
          .map((row) {
            final payments = _parseSalePayments(row.paymentsJson);
            final amountReceived = payments.fold<double>(
              0,
              (sum, payment) => sum + payment.amount,
            );
            final amountDue = row.total - amountReceived;
            return RecentSaleSummary(
              id: row.id,
              total: row.total,
              amountReceived: amountReceived,
              amountDue: amountDue > 0 ? amountDue : 0,
              date: row.date,
              paymentMode: row.paymentMode,
              customerName: row.customerName,
              syncState: _parseSyncState(row.syncStatus),
            );
          })
          .where(
            (sale) =>
                !(filter?.onlyDueSales ?? false) || sale.hasOutstandingDue,
          )
          .toList(growable: false),
    );
  }

  /// Insert a historical sale (e.g. imported from another POS). Idempotent by
  /// [id]; does NOT touch inventory stock or the sync outbox — it is treated
  /// as settled past history.
  Future<void> importHistoricalSale({
    required String id,
    required String date,
    required int createdAtMillis,
    required double total,
    required double discount,
    required String paymentMode,
    required String? customerName,
    required String? customerPhone,
    required String footerNote,
    required List<Map<String, dynamic>> items,
    required List<Map<String, dynamic>> payments,
  }) async {
    await _db
        .into(_db.salesEntries)
        .insertOnConflictUpdate(
          SalesEntriesCompanion.insert(
            id: id,
            total: total,
            discount: Value(discount),
            discountType: const Value('fixed'),
            paymentMode: Value(paymentMode),
            date: date,
            createdAt: createdAtMillis,
            updatedAt: Value(DateTime.now().millisecondsSinceEpoch),
            customerName: Value(customerName),
            customerPhone: Value(customerPhone),
            footerNote: Value(footerNote),
            itemsJson: jsonEncode(items),
            paymentsJson: jsonEncode(payments),
            commandId: Value('zobaze-import-$id'),
            syncStatus: const Value('synced'),
            backendSaleId: const Value(null),
          ),
        );
  }

  Future<SaleRecordDetail?> getSaleDetail(String saleId) async {
    final row = await (_db.select(
      _db.salesEntries,
    )..where((tbl) => tbl.id.equals(saleId))).getSingleOrNull();
    if (row == null) {
      return null;
    }

    return SaleRecordDetail(
      id: row.id,
      total: row.total,
      discount: row.discount,
      discountType: row.discountType,
      paymentMode: row.paymentMode,
      date: row.date,
      syncState: _parseSyncState(row.syncStatus),
      items: _parseSaleItems(row.itemsJson),
      payments: _parseSalePayments(row.paymentsJson),
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      footerNote: row.footerNote,
      commandId: row.commandId,
      backendSaleId: row.backendSaleId,
      lastSyncError: row.lastSyncError,
    );
  }

  Stream<List<CustomerPulseSummary>> watchCustomerPulse({
    String search = '',
    int limit = 18,
  }) {
    final normalized = search.trim().toLowerCase();
    final variables = <Variable<Object>>[];
    final where = <String>[
      'tombstone = 0',
      "(TRIM(COALESCE(customer_name, '')) <> '' OR TRIM(COALESCE(customer_phone, '')) <> '')",
    ];

    if (normalized.isNotEmpty) {
      where.add(
        "(LOWER(COALESCE(customer_name, '')) LIKE ? OR LOWER(COALESCE(customer_phone, '')) LIKE ?)",
      );
      final like = '%$normalized%';
      variables
        ..add(Variable<String>(like))
        ..add(Variable<String>(like));
    }

    variables.add(Variable<int>(limit));

    return _db
        .customSelect(
          '''
            SELECT
              COALESCE(NULLIF(TRIM(customer_name), ''), 'Walk-in customer') AS customer_name,
              NULLIF(TRIM(customer_phone), '') AS customer_phone,
              COUNT(*) AS visit_count,
              COALESCE(SUM(total), 0.0) AS lifetime_spend,
              COALESCE(SUM(CASE WHEN sync_status IN ('queued', 'syncing', 'failed_backend', 'failed') THEN 1 ELSE 0 END), 0) AS pending_sales,
              MAX(created_at) AS last_seen_at
            FROM sales
            WHERE ${where.join(' AND ')}
            GROUP BY customer_name, customer_phone
            ORDER BY last_seen_at DESC, lifetime_spend DESC
            LIMIT ?;
          ''',
          variables: variables,
          readsFrom: {_db.salesEntries},
        )
        .watch()
        .map(
          (rows) => rows
              .map(
                (row) => CustomerPulseSummary(
                  name: row.read<String>('customer_name'),
                  phone: row.readNullable<String>('customer_phone'),
                  visitCount: row.read<int>('visit_count'),
                  lifetimeSpend: row.read<double>('lifetime_spend'),
                  pendingSales: row.read<int>('pending_sales'),
                  lastSeenAt: DateTime.fromMillisecondsSinceEpoch(
                    row.read<int>('last_seen_at'),
                  ),
                ),
              )
              .toList(growable: false),
        );
  }

  Stream<int> watchPendingOutboxCount() {
    return _db
        .customSelect(
          '''
            SELECT COUNT(*) AS total
            FROM commerce_outbox
            WHERE sync_status IN ('pending', 'failed', 'syncing');
          ''',
          readsFrom: {_db.commerceOutboxEntries},
        )
        .watchSingle()
        .map((row) => row.read<int>('total'));
  }

  Stream<List<CommerceOutboxAttentionEntry>> watchOutboxAttentionEntries({
    int limit = 6,
  }) {
    return _db
        .customSelect(
          '''
            SELECT
              o.command_id,
              o.command_type,
              o.sync_status,
              o.attempt_count,
              o.last_attempt_at,
              o.updated_at,
              o.last_error,
              s.id AS sale_id,
              COALESCE(s.customer_name, '') AS customer_name,
              COALESCE(s.total, 0.0) AS total,
              s.date AS sale_date
            FROM commerce_outbox o
            LEFT JOIN sales s ON s.command_id = o.command_id
            WHERE o.sync_status IN ('pending', 'failed', 'syncing')
            ORDER BY
              CASE o.sync_status
                WHEN 'failed' THEN 0
                WHEN 'syncing' THEN 1
                ELSE 2
              END,
              COALESCE(o.last_attempt_at, o.updated_at, o.created_at) DESC
            LIMIT ?;
          ''',
          variables: [Variable<int>(limit)],
          readsFrom: {_db.commerceOutboxEntries, _db.salesEntries},
        )
        .watch()
        .map(
          (rows) => rows
              .map(
                (row) => CommerceOutboxAttentionEntry(
                  commandId: row.read<String>('command_id'),
                  commandType: row.read<String>('command_type'),
                  syncStatus: row.read<String>('sync_status'),
                  attemptCount: row.read<int>('attempt_count'),
                  updatedAt: row.read<int>('updated_at'),
                  lastAttemptAt: row.readNullable<int>('last_attempt_at'),
                  lastError: _asStringOrNull(
                    row.readNullable<String>('last_error'),
                  ),
                  saleId: _asStringOrNull(row.readNullable<String>('sale_id')),
                  customerName: _asStringOrNull(
                    row.readNullable<String>('customer_name'),
                  ),
                  total: row.read<double>('total'),
                  saleDate: _asStringOrNull(
                    row.readNullable<String>('sale_date'),
                  ),
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
    final items = data['items'] is List
        ? jsonEncode(data['items'])
        : jsonEncode(const []);

    await _db
        .into(_db.salesEntries)
        .insertOnConflictUpdate(
          SalesEntriesCompanion.insert(
            id: id,
            total: _asDouble(data['total']),
            discount: Value(_asDouble(data['discount'])),
            discountType: Value((data['discountType'] ?? 'fixed').toString()),
            paymentMode: Value((data['paymentMode'] ?? 'CASH').toString()),
            date:
                (data['date'] ??
                        DateTime.now().toIso8601String().split('T').first)
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

  Future<void> mergeBackendSaleDocument(
    Map<String, dynamic> data, {
    required int updatedAt,
  }) async {
    final backendSaleId = (data['id'] ?? '').toString().trim();
    if (backendSaleId.isEmpty) {
      return;
    }

    final sourceMeta = data['source_meta_json'] is Map
        ? Map<String, dynamic>.from(data['source_meta_json'] as Map)
        : const <String, dynamic>{};
    final commandId = _asStringOrNull(sourceMeta['command_id']);
    final storageId = await _resolveSaleStorageId(
      backendSaleId: backendSaleId,
      commandId: commandId,
    );
    final createdAt =
        _asEpoch(
          data['occurred_at'] ?? data['created_at'] ?? data['createdAt'],
        ) ??
        updatedAt;
    final items = data['items'] is List
        ? jsonEncode(
            (data['items'] as List)
                .map(
                  (item) => {
                    'itemId': item['inventory_item_id'],
                    'name': item['name'],
                    'sku': item['sku'],
                    'size': item['size'],
                    'quantity': item['quantity'],
                    'price': _asDouble(item['unit_price']),
                    'costPrice': item['unit_cost'] == null
                        ? null
                        : _asDouble(item['unit_cost']),
                    'hsnCode': item['hsn_snapshot'],
                    'gstRate': _asDouble(item['gst_rate']),
                    'taxableAmount': _asDouble(item['taxable_amount']),
                    'taxAmount': _asDouble(item['tax_amount']),
                    'cgstAmount': _asDouble(item['cgst_amount']),
                    'sgstAmount': _asDouble(item['sgst_amount']),
                    'igstAmount': _asDouble(item['igst_amount']),
                  },
                )
                .toList(growable: false),
          )
        : jsonEncode(const []);
    final payments = data['payments'] is List
        ? jsonEncode(
            (data['payments'] as List)
                .map(
                  (payment) => {
                    'mode': payment['payment_method'],
                    'amount': _asDouble(payment['amount']),
                  },
                )
                .toList(growable: false),
          )
        : jsonEncode(const []);

    final combinedFooter = (data['buyer_gstin'] != null && data['buyer_gstin'].toString().trim().isNotEmpty)
        ? '${data['footer_note'] ?? ''}\n\nBuyer GSTIN: ${data['buyer_gstin']}'.trim()
        : _asStringOrNull(data['footer_note']);

    await _db
        .into(_db.salesEntries)
        .insertOnConflictUpdate(
          SalesEntriesCompanion.insert(
            id: storageId,
            total: _asDouble(data['total_amount'] ?? data['total']),
            discount: Value(
              _asDouble(data['discount_amount'] ?? data['discount']),
            ),
            discountType: Value((data['discount_type'] ?? 'fixed').toString()),
            paymentMode: Value((data['payment_mode'] ?? 'CASH').toString()),
            date:
                (data['sale_date'] ??
                        data['date'] ??
                        DateTime.now().toIso8601String().split('T').first)
                    .toString(),
            createdAt: createdAt,
            updatedAt: Value(updatedAt),
            customerName: Value(_asStringOrNull(data['customer_name'])),
            customerPhone: Value(_asStringOrNull(data['customer_phone'])),
            customerId: Value(_asStringOrNull(data['customer_id'])),
            footerNote: Value(combinedFooter),
            itemsJson: items,
            paymentsJson: payments,
            commandId: Value(commandId),
            syncStatus: const Value('synced_backend'),
            backendSaleId: Value(backendSaleId),
            lastSyncError: const Value(null),
            lastSyncedAt: Value(updatedAt),
            tombstone: Value(data['tombstone'] == true),
          ),
        );
  }

  Future<LocalSaleCommit> recordLocalSale({
    required String shopId,
    required List<PosCartItem> items,
    required List<PosPayment> payments,
    required String paymentMode,
    required String footerNote,
    String? customerId,
    String? customerName,
    String? customerPhone,
    String? buyerGstin,
    double discount = 0,
    DateTime? saleDate,
  }) async {
    if (shopId.trim().isEmpty) {
      throw ArgumentError('A valid shopId is required to queue a mobile sale.');
    }

    final saleId = 'sale-${DateTime.now().millisecondsSinceEpoch}';
    final commandId = 'sale-cmd-${DateTime.now().microsecondsSinceEpoch}';
    final now = DateTime.now();
    // Business timestamp for the sale (allows backdating); record ids and
    // updatedAt stay at the real current time.
    final effectiveAt = saleDate ?? now;
    final createdAt = effectiveAt.toIso8601String();
    final date = createdAt.split('T').first;
    final baseDomainEpoch = await _readDomainEpoch('sales');
    final inventoryDeltas = <String, int>{};
    final totalBeforeDiscount = items.fold<double>(
      0,
      (sum, item) => sum + item.lineTotal,
    );
    final total = totalBeforeDiscount - discount;
    final encodedItems = items
        .map((item) => item.toSaleJson())
        .toList(growable: false);
    final encodedPayments = payments
        .map((payment) => payment.toJson())
        .toList(growable: false);

    for (final item in items) {
      inventoryDeltas[item.id] =
          (inventoryDeltas[item.id] ?? 0) - item.quantity;
    }

    await _db.transaction(() async {
      await _db
          .into(_db.salesEntries)
          .insert(
            SalesEntriesCompanion.insert(
              id: saleId,
              total: total,
              discount: Value(discount),
              discountType: const Value('fixed'),
              paymentMode: Value(paymentMode),
              date: date,
              createdAt: effectiveAt.millisecondsSinceEpoch,
              updatedAt: Value(now.millisecondsSinceEpoch),
              customerName: Value(customerName),
              customerPhone: Value(customerPhone),
              customerId: Value(customerId),
              footerNote: Value(
                (buyerGstin != null && buyerGstin.trim().isNotEmpty)
                    ? '$footerNote\n\nBuyer GSTIN: $buyerGstin'.trim()
                    : footerNote
              ),
              itemsJson: jsonEncode(encodedItems),
              paymentsJson: jsonEncode(encodedPayments),
              commandId: Value(commandId),
              syncStatus: const Value('queued'),
              backendSaleId: const Value(null),
            ),
          );

      await _db
          .into(_db.commerceOutboxEntries)
          .insert(
            CommerceOutboxEntriesCompanion.insert(
              commandId: commandId,
              shopId: shopId,
              commandType: 'sale_create',
              domain: 'sales',
              baseDomainEpoch: Value(baseDomainEpoch),
              payloadJson: jsonEncode(
                LocalSaleCommit(
                  commandId: commandId,
                  saleId: saleId,
                  shopId: shopId,
                  baseDomainEpoch: baseDomainEpoch,
                  date: date,
                  createdAt: createdAt,
                  total: total,
                  discount: discount,
                  discountType: 'fixed',
                  paymentMode: paymentMode,
                  items: encodedItems,
                  payments: encodedPayments,
                  customerId: customerId,
                  customerName: customerName,
                  customerPhone: customerPhone,
                  footerNote: footerNote,
                  buyerGstin: buyerGstin,
                  inventoryDeltas: inventoryDeltas,
                ).toBackendCommandPayload(),
              ),
              createdAt: now.millisecondsSinceEpoch,
              updatedAt: Value(now.millisecondsSinceEpoch),
            ),
          );

      for (final item in items) {
        await (_db.update(
          _db.inventoryEntries,
        )..where((tbl) => tbl.id.equals(item.id))).write(
          InventoryEntriesCompanion(
            stock: Value(item.stock - item.quantity),
            updatedAt: Value(now.millisecondsSinceEpoch),
          ),
        );
        // Skip custom/weighed lines — they aren't inventory rows, so there is
        // no real stock to move.
        if (!item.id.startsWith('custom-') && !item.id.startsWith('weigh-')) {
          await _writeStockMovement(
            _db,
            itemId: item.id,
            itemName: item.name,
            delta: -item.quantity,
            reason: 'SALE',
            balanceAfter: item.stock - item.quantity,
            refId: saleId,
          );
        }
      }

      // Credit sale: push the unpaid balance onto the customer's khata so the
      // due shows up in the Clients list. Done inside the sale transaction so
      // the ledger stays consistent with the recorded sale.
      if (customerId != null && customerId.isNotEmpty) {
        final received = payments.fold<double>(
          0,
          (sum, payment) => sum + payment.amount,
        );
        final saleDue = total - received;
        if (saleDue > 0.009) {
          final customerRow =
              await (_db.select(_db.customerEntries)
                    ..where((tbl) => tbl.id.equals(customerId)))
                  .getSingleOrNull();
          if (customerRow != null) {
            final newBalance = customerRow.balance + saleDue;
            await (_db.update(
              _db.customerEntries,
            )..where((tbl) => tbl.id.equals(customerId))).write(
              CustomerEntriesCompanion(
                balance: Value(newBalance),
                updatedAt: Value(now.millisecondsSinceEpoch),
              ),
            );
            await _writeCustomerLedger(
              _db,
              customerId: customerId,
              type: 'SALE_CREDIT',
              amount: saleDue,
              balanceAfter: newBalance,
              refId: saleId,
              note: 'Credit sale',
            );
          }
        }
      }
    });

    return LocalSaleCommit(
      commandId: commandId,
      saleId: saleId,
      shopId: shopId,
      baseDomainEpoch: baseDomainEpoch,
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
      customerId: customerId,
      footerNote: footerNote,
      inventoryDeltas: inventoryDeltas,
    );
  }

  /// Record a full return/refund of a past sale: a reversing (negative) sale
  /// for history + reporting, and — if [restock] — put the items back on the
  /// shelf (matched by SKU, else name). All in one transaction.
  Future<void> recordReturn({
    required String shopId,
    required SaleRecordDetail original,
    required bool restock,
  }) async {
    final now = DateTime.now();
    final saleId = 'return-${now.millisecondsSinceEpoch}';
    final commandId = 'return-cmd-${now.microsecondsSinceEpoch}';

    final encodedItems = original.items
        .map(
          (it) => <String, dynamic>{
            'name': it.name,
            'quantity': -it.quantity,
            'unitPrice': it.unitPrice,
            'lineTotal': -(it.unitPrice * it.quantity),
            'sku': it.sku,
            'gstRate': it.gstRate,
            'priceIncludesTax': it.priceIncludesTax,
          },
        )
        .toList(growable: false);
    final encodedPayments = <Map<String, dynamic>>[
      <String, dynamic>{'mode': 'REFUND', 'amount': -original.amountReceived},
    ];

    await _db.transaction(() async {
      await _db
          .into(_db.salesEntries)
          .insert(
            SalesEntriesCompanion.insert(
              id: saleId,
              total: -original.total,
              discount: const Value(0),
              discountType: const Value('fixed'),
              paymentMode: const Value('REFUND'),
              date: now.toIso8601String().split('T').first,
              createdAt: now.millisecondsSinceEpoch,
              updatedAt: Value(now.millisecondsSinceEpoch),
              customerName: Value(original.customerName),
              customerPhone: Value(original.customerPhone),
              footerNote: Value('RETURN of receipt ${original.id}'),
              itemsJson: jsonEncode(encodedItems),
              paymentsJson: jsonEncode(encodedPayments),
              commandId: Value(commandId),
              syncStatus: const Value('queued'),
              backendSaleId: const Value(null),
            ),
          );

      if (restock) {
        for (final it in original.items) {
          final hasSku = it.sku != null && it.sku!.trim().isNotEmpty;
          final row =
              await (_db.select(_db.inventoryEntries)
                    ..where(
                      (t) => hasSku
                          ? t.sku.equals(it.sku!)
                          : t.name.equals(it.name),
                    )
                    ..limit(1))
                  .getSingleOrNull();
          if (row != null) {
            await (_db.update(
              _db.inventoryEntries,
            )..where((t) => t.id.equals(row.id))).write(
              InventoryEntriesCompanion(
                stock: Value(row.stock + it.quantity),
                updatedAt: Value(now.millisecondsSinceEpoch),
              ),
            );
            await _writeStockMovement(
              _db,
              itemId: row.id,
              itemName: row.name,
              delta: it.quantity,
              reason: 'RETURN',
              balanceAfter: row.stock + it.quantity,
              refId: saleId,
            );
          }
        }
      }
    });
  }

  Future<List<CommerceOutboxEntryModel>> getPendingOutboxEntries() async {
    final rows =
        await (_db.select(_db.commerceOutboxEntries)
              ..where(
                (tbl) =>
                    tbl.syncStatus.equals('pending') |
                    tbl.syncStatus.equals('failed'),
              )
              ..orderBy([(tbl) => OrderingTerm.asc(tbl.createdAt)]))
            .get();

    return rows
        .map(
          (row) => CommerceOutboxEntryModel(
            commandId: row.commandId,
            shopId: row.shopId,
            commandType: row.commandType,
            domain: row.domain,
            baseDomainEpoch: row.baseDomainEpoch,
            payloadJson: row.payloadJson,
            syncStatus: row.syncStatus,
            attemptCount: row.attemptCount,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            lastAttemptAt: row.lastAttemptAt,
            completedAt: row.completedAt,
            lastError: row.lastError,
          ),
        )
        .toList(growable: false);
  }

  Future<void> markOutboxSyncing(String commandId) async {
    await (_db.update(
      _db.commerceOutboxEntries,
    )..where((tbl) => tbl.commandId.equals(commandId))).write(
      CommerceOutboxEntriesCompanion(
        syncStatus: const Value('syncing'),
        attemptCount: const Value.absent(),
        lastAttemptAt: Value(DateTime.now().millisecondsSinceEpoch),
        updatedAt: Value(DateTime.now().millisecondsSinceEpoch),
      ),
    );

    await (_db.update(
      _db.salesEntries,
    )..where((tbl) => tbl.commandId.equals(commandId))).write(
      SalesEntriesCompanion(
        syncStatus: const Value('syncing'),
        updatedAt: Value(DateTime.now().millisecondsSinceEpoch),
      ),
    );
  }

  Future<void> registerOutboxAttempt(String commandId) async {
    final row = await (_db.select(
      _db.commerceOutboxEntries,
    )..where((tbl) => tbl.commandId.equals(commandId))).getSingleOrNull();
    final nextAttempts = (row?.attemptCount ?? 0) + 1;
    final now = DateTime.now().millisecondsSinceEpoch;
    await (_db.update(
      _db.commerceOutboxEntries,
    )..where((tbl) => tbl.commandId.equals(commandId))).write(
      CommerceOutboxEntriesCompanion(
        attemptCount: Value(nextAttempts),
        lastAttemptAt: Value(now),
        updatedAt: Value(now),
      ),
    );
  }

  Future<void> markCommandSynced({
    required String commandId,
    required String receiptId,
    String? backendSaleId,
  }) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    await _db.transaction(() async {
      await (_db.update(
        _db.commerceOutboxEntries,
      )..where((tbl) => tbl.commandId.equals(commandId))).write(
        CommerceOutboxEntriesCompanion(
          syncStatus: const Value('synced'),
          lastError: const Value(null),
          completedAt: Value(now),
          updatedAt: Value(now),
        ),
      );

      await (_db.update(
        _db.salesEntries,
      )..where((tbl) => tbl.commandId.equals(commandId))).write(
        SalesEntriesCompanion(
          syncStatus: const Value('synced_backend'),
          backendReceiptId: Value(receiptId),
          backendSaleId: Value(backendSaleId),
          lastSyncError: const Value(null),
          lastSyncedAt: Value(now),
          updatedAt: Value(now),
        ),
      );
    });
  }

  Future<void> markCommandFailed({
    required String commandId,
    required String error,
  }) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    await _db.transaction(() async {
      await (_db.update(
        _db.commerceOutboxEntries,
      )..where((tbl) => tbl.commandId.equals(commandId))).write(
        CommerceOutboxEntriesCompanion(
          syncStatus: const Value('failed'),
          lastError: Value(error),
          updatedAt: Value(now),
        ),
      );

      await (_db.update(
        _db.salesEntries,
      )..where((tbl) => tbl.commandId.equals(commandId))).write(
        SalesEntriesCompanion(
          syncStatus: const Value('failed_backend'),
          lastSyncError: Value(error),
          updatedAt: Value(now),
        ),
      );
    });
  }

  Future<void> markCommandQueued(String commandId) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    await (_db.update(
      _db.commerceOutboxEntries,
    )..where((tbl) => tbl.commandId.equals(commandId))).write(
      CommerceOutboxEntriesCompanion(
        syncStatus: const Value('pending'),
        updatedAt: Value(now),
      ),
    );

    await (_db.update(
      _db.salesEntries,
    )..where((tbl) => tbl.commandId.equals(commandId))).write(
      SalesEntriesCompanion(
        syncStatus: const Value('queued'),
        updatedAt: Value(now),
      ),
    );
  }

  Future<int> _readDomainEpoch(String domain) async {
    final row =
        await (_db.select(_db.shopSettingsEntries)
              ..where((tbl) => tbl.key.equals('domain_state_$domain')))
            .getSingleOrNull();
    if (row == null) {
      return 1;
    }

    try {
      final decoded = jsonDecode(row.value) as Map<String, dynamic>;
      final epoch = decoded['current_epoch'];
      if (epoch is int) return epoch;
      if (epoch is num) return epoch.toInt();
      if (epoch is String) return int.tryParse(epoch) ?? 1;
    } catch (_) {
      return 1;
    }
    return 1;
  }

  Future<String> _resolveSaleStorageId({
    required String backendSaleId,
    required String? commandId,
  }) async {
    if (commandId != null) {
      final existingByCommand = await (_db.select(
        _db.salesEntries,
      )..where((tbl) => tbl.commandId.equals(commandId))).getSingleOrNull();
      if (existingByCommand != null) {
        return existingByCommand.id;
      }
    }

    final existingByBackendId =
        await (_db.select(_db.salesEntries)
              ..where((tbl) => tbl.backendSaleId.equals(backendSaleId)))
            .getSingleOrNull();
    if (existingByBackendId != null) {
      return existingByBackendId.id;
    }

    return backendSaleId;
  }

  Future<void> clearWorkspace() async {
    await _db.transaction(() async {
      await _db.delete(_db.commerceOutboxEntries).go();
      await _db.delete(_db.salesEntries).go();
    });
  }
}

String? _historyExactDate(HistoryDateWindow window) {
  if (window != HistoryDateWindow.today) {
    return null;
  }
  return _historyDateOnly(DateTime.now());
}

String? _historySinceDate(HistoryDateWindow window) {
  final today = DateTime.now();
  return switch (window) {
    HistoryDateWindow.all => null,
    HistoryDateWindow.today => null,
    HistoryDateWindow.sevenDays => _historyDateOnly(
      today.subtract(const Duration(days: 6)),
    ),
    HistoryDateWindow.thirtyDays => _historyDateOnly(
      today.subtract(const Duration(days: 29)),
    ),
    HistoryDateWindow.ninetyDays => _historyDateOnly(
      today.subtract(const Duration(days: 89)),
    ),
  };
}

String _historyDateOnly(DateTime value) =>
    value.toIso8601String().split('T').first;

CommerceSyncState _parseSyncState(String raw) {
  switch (raw) {
    case 'queued':
      return CommerceSyncState.queued;
    case 'syncing':
      return CommerceSyncState.syncing;
    case 'synced_backend':
    case 'synced':
      return CommerceSyncState.synced;
    case 'failed_backend':
    case 'failed':
      return CommerceSyncState.failed;
    default:
      return CommerceSyncState.localOnly;
  }
}

double _asDouble(Object? value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? 0;
  return 0;
}

double? _asDoubleOrNull(Object? value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  if (value is String) {
    final t = value.trim();
    return t.isEmpty ? null : double.tryParse(t);
  }
  return null;
}

bool _asBool(Object? value, {bool fallback = false}) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) {
    final normalized = value.trim().toLowerCase();
    if (const {'1', 'true', 'yes', 'y', 'on'}.contains(normalized)) {
      return true;
    }
    if (const {'0', 'false', 'no', 'n', 'off'}.contains(normalized)) {
      return false;
    }
  }
  return fallback;
}

int _asInt(Object? value) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}

int? _asIntOrNull(Object? value) {
  if (value == null) return null;
  if (value is num) return value.toInt();
  if (value is String) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return null;
    return int.tryParse(trimmed);
  }
  return null;
}

var _ledgerSeq = 0;

/// Append one entry to a customer's khata. Safe inside a transaction.
Future<void> _writeCustomerLedger(
  BusinessHubDatabase db, {
  required String customerId,
  required String type,
  required double amount,
  required double balanceAfter,
  String? refId,
  String note = '',
  String? actorName,
}) async {
  final seq = _ledgerSeq++;
  await db
      .into(db.customerLedgerEntries)
      .insert(
        CustomerLedgerEntriesCompanion.insert(
          id: 'led-${DateTime.now().microsecondsSinceEpoch}-$seq',
          customerId: customerId,
          type: type,
          amount: amount,
          balanceAfter: balanceAfter,
          refId: Value(refId),
          note: Value(note),
          actorName: Value(actorName),
          createdAt: DateTime.now().millisecondsSinceEpoch,
        ),
      );
}

var _movementSeq = 0;

/// Append one row to the stock audit trail. Safe to call inside a transaction;
/// the id blends time, item and a process-lifetime counter so tight loops never
/// collide.
Future<void> _writeStockMovement(
  BusinessHubDatabase db, {
  required String itemId,
  required String itemName,
  required int delta,
  required String reason,
  int? balanceAfter,
  String? refId,
  String note = '',
  String? actorName,
}) async {
  final seq = _movementSeq++;
  await db
      .into(db.stockMovementEntries)
      .insert(
        StockMovementEntriesCompanion.insert(
          id: 'mv-${DateTime.now().microsecondsSinceEpoch}-$seq',
          itemId: itemId,
          itemName: itemName,
          delta: delta,
          reason: reason,
          balanceAfter: Value(balanceAfter),
          refId: Value(refId),
          note: Value(note),
          actorName: Value(actorName),
          createdAt: DateTime.now().millisecondsSinceEpoch,
        ),
      );
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

List<SaleDetailItem> _parseSaleItems(String raw) {
  try {
    final decoded = jsonDecode(raw);
    if (decoded is! List) {
      return const <SaleDetailItem>[];
    }
    return decoded
        .whereType<Map>()
        .map(
          (item) => SaleDetailItem(
            name: (item['name'] ?? 'Unknown item').toString(),
            quantity: _asInt(item['quantity']),
            unitPrice: _asDouble(item['price'] ?? item['unit_price']),
            size: _asStringOrNull(item['size']),
            sku: _asStringOrNull(item['sku']),
            unitCost: item['costPrice'] == null && item['unit_cost'] == null
                ? null
                : _asDouble(item['costPrice'] ?? item['unit_cost']),
            hsnCode: _asStringOrNull(
              item['hsnCode'] ?? item['hsn_code'] ?? item['hsn_snapshot'],
            ),
            gstRate: _asDouble(item['gstRate'] ?? item['gst_rate']),
            taxableAmount: _asDouble(
              item['taxableAmount'] ?? item['taxable_amount'],
            ),
            taxAmount: _asDouble(item['taxAmount'] ?? item['tax_amount']),
            cgstAmount: _asDouble(item['cgstAmount'] ?? item['cgst_amount']),
            sgstAmount: _asDouble(item['sgstAmount'] ?? item['sgst_amount']),
            igstAmount: _asDouble(item['igstAmount'] ?? item['igst_amount']),
            priceIncludesTax: _asBool(
              item['priceIncludesTax'] ?? item['price_includes_tax'],
              fallback: true,
            ),
          ),
        )
        .toList(growable: false);
  } catch (_) {
    return const <SaleDetailItem>[];
  }
}

List<SaleDetailPayment> _parseSalePayments(String raw) {
  try {
    final decoded = jsonDecode(raw);
    if (decoded is! List) {
      return const <SaleDetailPayment>[];
    }
    return decoded
        .whereType<Map>()
        .map(
          (payment) => SaleDetailPayment(
            mode: (payment['mode'] ?? payment['payment_method'] ?? 'CASH')
                .toString(),
            amount: _asDouble(payment['amount']),
            referenceCode: _asStringOrNull(payment['reference_code']),
            note: _asStringOrNull(payment['note']),
          ),
        )
        .toList(growable: false);
  } catch (_) {
    return const <SaleDetailPayment>[];
  }
}

final expenseRepositoryProvider = Provider<ExpenseRepository>((ref) {
  return ExpenseRepository(ref.watch(localDatabaseProvider));
});

class ExpenseRepository {
  ExpenseRepository(this._db);

  final BusinessHubDatabase _db;

  Future<void> recordExpense({
    required String category,
    required double amount,
    required DateTime expenseDate,
    String description = '',
    String paymentMethod = 'CASH',
    String paymentReference = '',
    String? actorName,
  }) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    await _db.into(_db.expenseEntries).insert(
          ExpenseEntriesCompanion.insert(
            id: 'expense-${DateTime.now().microsecondsSinceEpoch}',
            category: Value(
              category.trim().isEmpty ? 'General' : category.trim(),
            ),
            amount: Value(amount),
            description: Value(description.trim()),
            paymentMethod: Value(paymentMethod),
            paymentReference: Value(paymentReference.trim()),
            expenseDate: expenseDate.toIso8601String().split('T').first,
            actorName: Value(actorName),
            createdAt: now,
            updatedAt: Value(now),
          ),
        );
  }

  Stream<List<ExpenseRecord>> watchExpenses({
    String query = '',
    String category = '',
  }) {
    final where = <String>['tombstone = 0'];
    final vars = <Variable<Object>>[];
    final q = query.trim().toLowerCase();
    if (q.isNotEmpty) {
      where.add('(LOWER(category) LIKE ? OR LOWER(description) LIKE ?)');
      vars
        ..add(Variable<String>('%$q%'))
        ..add(Variable<String>('%$q%'));
    }
    if (category.trim().isNotEmpty) {
      where.add('LOWER(category) = ?');
      vars.add(Variable<String>(category.trim().toLowerCase()));
    }
    final sql =
        'SELECT * FROM expenses WHERE ${where.join(' AND ')} '
        'ORDER BY expense_date DESC, created_at DESC;';
    return _db
        .customSelect(sql, variables: vars, readsFrom: {_db.expenseEntries})
        .watch()
        .map(
          (rows) => rows
              .map(
                (row) => ExpenseRecord(
                  id: row.read<String>('id'),
                  category: row.read<String>('category'),
                  amount: row.read<double>('amount'),
                  description: row.read<String>('description'),
                  paymentMethod: row.read<String>('payment_method'),
                  paymentReference: row.read<String>('payment_reference'),
                  expenseDate:
                      DateTime.tryParse(row.read<String>('expense_date')) ??
                      DateTime.now(),
                  actorName: _asStringOrNull(
                    row.readNullable<String>('actor_name'),
                  ),
                  tombstone: row.read<int>('tombstone') == 1,
                ),
              )
              .toList(growable: false),
        );
  }

  Future<ExpenseSummarySnapshot> summary() async {
    final rows = await (_db.select(
      _db.expenseEntries,
    )..where((t) => t.tombstone.equals(false))).get();
    final total = rows.fold<double>(0, (sum, r) => sum + r.amount);
    final byCategory = <String, double>{};
    for (final r in rows) {
      byCategory[r.category] = (byCategory[r.category] ?? 0) + r.amount;
    }
    String? biggest;
    var max = -1.0;
    byCategory.forEach((k, v) {
      if (v > max) {
        max = v;
        biggest = k;
      }
    });
    return ExpenseSummarySnapshot(
      totalEntries: rows.length,
      totalAmount: total,
      uniqueCategories: byCategory.length,
      biggestCategory: biggest,
    );
  }
}

final purchaseRepositoryProvider = Provider<PurchaseRepository>((ref) {
  return PurchaseRepository(ref.watch(localDatabaseProvider));
});

/// Stock buying + supplier dues, local-first. Purchases are money-out with a
/// running payable; suppliers and their outstanding balances are derived by
/// grouping purchases, so there's no separate supplier entity to keep in sync.
class PurchaseRepository {
  PurchaseRepository(this._db);

  final BusinessHubDatabase _db;

  /// Records the purchase and returns its id (so the caller can link any
  /// auto stock-in movements back to this purchase).
  Future<String> recordPurchase({
    required String supplierName,
    required double total,
    required DateTime purchaseDate,
    double amountPaid = 0,
    String supplierPhone = '',
    String reference = '',
    String paymentMethod = 'CASH',
    String notes = '',
    String? actorName,
  }) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    final id = 'purchase-${DateTime.now().microsecondsSinceEpoch}';
    // A payment can never exceed the bill, and neither value can be negative.
    final safeTotal = total < 0 ? 0.0 : total;
    final safePaid = amountPaid < 0
        ? 0.0
        : (amountPaid > safeTotal ? safeTotal : amountPaid);
    await _db.into(_db.purchaseEntries).insert(
          PurchaseEntriesCompanion.insert(
            id: id,
            supplierName: supplierName.trim().isEmpty
                ? 'Unnamed supplier'
                : supplierName.trim(),
            supplierPhone: Value(supplierPhone.trim()),
            reference: Value(reference.trim()),
            total: Value(safeTotal),
            amountPaid: Value(safePaid),
            paymentMethod: Value(paymentMethod),
            notes: Value(notes.trim()),
            purchaseDate: purchaseDate.toIso8601String().split('T').first,
            actorName: Value(actorName),
            createdAt: now,
            updatedAt: Value(now),
          ),
        );
    return id;
  }

  /// Add a payment against an existing purchase, capped at its outstanding
  /// balance. Returns the new outstanding balance.
  Future<double> settlePurchase({
    required String purchaseId,
    required double amount,
  }) async {
    final row = await (_db.select(_db.purchaseEntries)
          ..where((t) => t.id.equals(purchaseId)))
        .getSingleOrNull();
    if (row == null) return 0;
    final due = row.total - row.amountPaid;
    final applied = amount < 0 ? 0.0 : (amount > due ? due : amount);
    final newPaid = row.amountPaid + applied;
    await (_db.update(_db.purchaseEntries)
          ..where((t) => t.id.equals(purchaseId)))
        .write(
      PurchaseEntriesCompanion(
        amountPaid: Value(newPaid),
        updatedAt: Value(DateTime.now().millisecondsSinceEpoch),
      ),
    );
    final remaining = row.total - newPaid;
    return remaining < 0 ? 0 : remaining;
  }

  Future<void> deletePurchase(String id) async {
    await (_db.update(_db.purchaseEntries)..where((t) => t.id.equals(id)))
        .write(
      PurchaseEntriesCompanion(
        tombstone: const Value(true),
        updatedAt: Value(DateTime.now().millisecondsSinceEpoch),
      ),
    );
  }

  Stream<List<PurchaseRecord>> watchPurchases({String query = ''}) {
    final where = <String>['tombstone = 0'];
    final vars = <Variable<Object>>[];
    final q = query.trim().toLowerCase();
    if (q.isNotEmpty) {
      where.add(
        '(LOWER(supplier_name) LIKE ? OR LOWER(reference) LIKE ? '
        'OR LOWER(notes) LIKE ?)',
      );
      vars
        ..add(Variable<String>('%$q%'))
        ..add(Variable<String>('%$q%'))
        ..add(Variable<String>('%$q%'));
    }
    final sql =
        'SELECT * FROM purchases WHERE ${where.join(' AND ')} '
        'ORDER BY purchase_date DESC, created_at DESC;';
    return _db
        .customSelect(sql, variables: vars, readsFrom: {_db.purchaseEntries})
        .watch()
        .map((rows) => rows.map(_mapPurchaseRow).toList(growable: false));
  }

  /// Suppliers rolled up from their purchases, ordered by who you owe most.
  Stream<List<SupplierDue>> watchSuppliers() {
    const sql = '''
      SELECT
        supplier_name AS name,
        MAX(supplier_phone) AS phone,
        COUNT(*) AS purchase_count,
        COALESCE(SUM(total), 0) AS total_purchased,
        COALESCE(SUM(total - amount_paid), 0) AS payable
      FROM purchases
      WHERE tombstone = 0
      GROUP BY LOWER(supplier_name)
      ORDER BY payable DESC, total_purchased DESC;
    ''';
    return _db
        .customSelect(sql, readsFrom: {_db.purchaseEntries})
        .watch()
        .map(
          (rows) => rows
              .map(
                (row) => SupplierDue(
                  name: row.read<String>('name'),
                  phone:
                      _asStringOrNull(row.readNullable<String>('phone')) ?? '',
                  purchaseCount: row.read<int>('purchase_count'),
                  totalPurchased: row.read<double>('total_purchased'),
                  payable: row.read<double>('payable'),
                ),
              )
              .toList(growable: false),
        );
  }

  Stream<PurchaseSummarySnapshot> watchSummary() {
    const sql = '''
      SELECT
        COUNT(*) AS total_purchases,
        COALESCE(SUM(total), 0) AS total_spent,
        COALESCE(SUM(total - amount_paid), 0) AS total_payable,
        COUNT(DISTINCT LOWER(supplier_name)) AS supplier_count
      FROM purchases
      WHERE tombstone = 0;
    ''';
    return _db
        .customSelect(sql, readsFrom: {_db.purchaseEntries})
        .watchSingle()
        .map(
          (row) => PurchaseSummarySnapshot(
            totalPurchases: row.read<int>('total_purchases'),
            totalSpent: row.read<double>('total_spent'),
            totalPayable: row.read<double>('total_payable'),
            supplierCount: row.read<int>('supplier_count'),
          ),
        );
  }

  PurchaseRecord _mapPurchaseRow(QueryRow row) {
    return PurchaseRecord(
      id: row.read<String>('id'),
      supplierName: row.read<String>('supplier_name'),
      supplierPhone: row.read<String>('supplier_phone'),
      reference: row.read<String>('reference'),
      total: row.read<double>('total'),
      amountPaid: row.read<double>('amount_paid'),
      paymentMethod: row.read<String>('payment_method'),
      notes: row.read<String>('notes'),
      purchaseDate:
          DateTime.tryParse(row.read<String>('purchase_date')) ??
          DateTime.now(),
      actorName: _asStringOrNull(row.readNullable<String>('actor_name')),
      tombstone: row.read<int>('tombstone') == 1,
    );
  }
}

final reportsRepositoryProvider = Provider<ReportsRepository>((ref) {
  return ReportsRepository(ref.watch(localDatabaseProvider));
});

/// Read side for financial reporting. Parses stored sale rows into the shape
/// [computeProfitAndLoss] expects; expenses for the same window come through a
/// sibling stream so the pure P&L math stays in one place.
class ReportsRepository {
  ReportsRepository(this._db);

  final BusinessHubDatabase _db;

  Stream<List<ReportSale>> watchReportSales(HistoryDateWindow window) {
    final exactDate = _historyExactDate(window);
    final sinceDate = _historySinceDate(window);
    final where = <String>['tombstone = 0'];
    final vars = <Variable<Object>>[];
    if (exactDate != null) {
      where.add('date = ?');
      vars.add(Variable<String>(exactDate));
    } else if (sinceDate != null) {
      where.add('date >= ?');
      vars.add(Variable<String>(sinceDate));
    }
    return _db
        .customSelect(
          'SELECT total, customer_name, items_json FROM sales '
          'WHERE ${where.join(' AND ')};',
          variables: vars,
          readsFrom: {_db.salesEntries},
        )
        .watch()
        .map(
          (rows) => rows
              .map(
                (row) => ReportSale(
                  total: row.read<double>('total'),
                  customerName: _asStringOrNull(
                    row.readNullable<String>('customer_name'),
                  ),
                  lines: _parseReportLines(row.read<String>('items_json')),
                ),
              )
              .toList(growable: false),
        );
  }

  Stream<double> watchPeriodExpenses(HistoryDateWindow window) {
    final exactDate = _historyExactDate(window);
    final sinceDate = _historySinceDate(window);
    final where = <String>['tombstone = 0'];
    final vars = <Variable<Object>>[];
    if (exactDate != null) {
      where.add('expense_date = ?');
      vars.add(Variable<String>(exactDate));
    } else if (sinceDate != null) {
      where.add('expense_date >= ?');
      vars.add(Variable<String>(sinceDate));
    }
    return _db
        .customSelect(
          'SELECT COALESCE(SUM(amount), 0) AS total FROM expenses '
          'WHERE ${where.join(' AND ')};',
          variables: vars,
          readsFrom: {_db.expenseEntries},
        )
        .watchSingle()
        .map((row) => row.read<double>('total'));
  }

  List<ReportSaleLine> _parseReportLines(String itemsJson) {
    if (itemsJson.trim().isEmpty) return const <ReportSaleLine>[];
    try {
      final decoded = jsonDecode(itemsJson);
      if (decoded is! List) return const <ReportSaleLine>[];
      return decoded.whereType<Map<String, dynamic>>().map((item) {
        return ReportSaleLine(
          name: (item['name'] ?? 'Item').toString(),
          quantity: _asInt(item['quantity']),
          price: _asDouble(item['price'] ?? item['unitPrice']),
          costPrice: _asDoubleOrNull(item['costPrice'] ?? item['unit_cost']),
          gstRate: _asDouble(item['gstRate'] ?? item['gst_rate']),
          priceIncludesTax: _asBool(
            item['priceIncludesTax'] ?? item['price_includes_tax'],
            fallback: true,
          ),
        );
      }).toList(growable: false);
    } catch (_) {
      return const <ReportSaleLine>[];
    }
  }
}
