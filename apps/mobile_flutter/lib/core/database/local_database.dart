import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

part 'local_database.g.dart';

final localDatabaseProvider = Provider<BusinessHubDatabase>((ref) {
  return LocalDatabaseController.instance.database;
});

class ShopSettingsEntries extends Table {
  @override
  String get tableName => 'shop_settings';

  TextColumn get key => text()();
  TextColumn get value => text()();
  IntColumn get updatedAt => integer()();

  @override
  Set<Column<Object>>? get primaryKey => {key};
}

class InventoryEntries extends Table {
  @override
  String get tableName => 'inventory';

  TextColumn get id => text()();
  TextColumn get name => text()();
  RealColumn get price => real()();
  TextColumn get sku => text().nullable()();
  TextColumn get category => text().withDefault(const Constant('General'))();
  TextColumn get subcategory => text().nullable()();
  TextColumn get size => text().nullable()();
  TextColumn get description => text().nullable()();
  IntColumn get stock => integer().withDefault(const Constant(0))();
  TextColumn get sourceMeta => text().named('source_meta').nullable()();
  IntColumn get createdAt => integer().named('created_at')();
  IntColumn get updatedAt =>
      integer().named('updated_at').withDefault(const Constant(0))();
  BoolColumn get tombstone => boolean().withDefault(const Constant(false))();
}

class InventoryPrivateEntries extends Table {
  @override
  String get tableName => 'inventory_private';

  TextColumn get id => text()();
  RealColumn get costPrice =>
      real().named('cost_price').withDefault(const Constant(0))();
  TextColumn get supplierId => text().named('supplier_id').nullable()();
  TextColumn get lastPurchaseDate =>
      text().named('last_purchase_date').nullable()();
  IntColumn get updatedAt =>
      integer().named('updated_at').withDefault(const Constant(0))();
  BoolColumn get tombstone => boolean().withDefault(const Constant(false))();
}

class SalesEntries extends Table {
  @override
  String get tableName => 'sales';

  TextColumn get id => text()();
  RealColumn get total => real()();
  RealColumn get discount => real().withDefault(const Constant(0))();
  TextColumn get discountType =>
      text().named('discount_type').withDefault(const Constant('fixed'))();
  TextColumn get paymentMode =>
      text().named('payment_mode').withDefault(const Constant('CASH'))();
  TextColumn get date => text()();
  IntColumn get createdAt => integer().named('created_at')();
  IntColumn get updatedAt =>
      integer().named('updated_at').withDefault(const Constant(0))();
  TextColumn get customerName => text().named('customer_name').nullable()();
  TextColumn get customerPhone => text().named('customer_phone').nullable()();
  TextColumn get customerId => text().named('customer_id').nullable()();
  TextColumn get footerNote => text().named('footer_note').nullable()();
  TextColumn get itemsJson => text().named('items_json')();
  TextColumn get paymentsJson => text().named('payments_json')();
  BoolColumn get tombstone => boolean().withDefault(const Constant(false))();
}

@DriftDatabase(
  tables: [
    ShopSettingsEntries,
    InventoryEntries,
    InventoryPrivateEntries,
    SalesEntries,
  ],
)
class BusinessHubDatabase extends _$BusinessHubDatabase {
  BusinessHubDatabase()
    : super(
        driftDatabase(
          name: 'business_hub_mobile',
          native: const DriftNativeOptions(shareAcrossIsolates: true),
        ),
      );

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) async {
      await m.createAll();
    },
  );
}

final class LocalDatabaseController {
  LocalDatabaseController._();

  static final LocalDatabaseController instance = LocalDatabaseController._();
  final BusinessHubDatabase database = BusinessHubDatabase();

  Future<void> initialize() async {
    await database.customSelect('SELECT 1;').get();
  }
}
