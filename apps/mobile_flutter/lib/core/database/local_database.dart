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

@TableIndex(name: 'inventory_name_idx', columns: {#name})
@TableIndex(name: 'inventory_sku_idx', columns: {#sku})
@TableIndex(name: 'inventory_category_idx', columns: {#category})
@TableIndex(name: 'inventory_tombstone_idx', columns: {#tombstone})
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
  TextColumn get hsnCode => text().named('hsn_code').nullable()();
  RealColumn get gstRate =>
      real().named('gst_rate').withDefault(const Constant(0))();
  BoolColumn get priceIncludesTax =>
      boolean().named('price_includes_tax').withDefault(const Constant(true))();
  IntColumn get stock => integer().withDefault(const Constant(0))();
  TextColumn get sourceMeta => text().named('source_meta').nullable()();
  TextColumn get imagePath => text().named('image_path').nullable()();
  IntColumn get createdAt => integer().named('created_at')();
  IntColumn get updatedAt =>
      integer().named('updated_at').withDefault(const Constant(0))();
  BoolColumn get tombstone => boolean().withDefault(const Constant(false))();

  @override
  Set<Column<Object>>? get primaryKey => {id};
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

  @override
  Set<Column<Object>>? get primaryKey => {id};
}

@TableIndex(name: 'sales_created_at_idx', columns: {#createdAt})
@TableIndex(name: 'sales_tombstone_idx', columns: {#tombstone})
@TableIndex(name: 'sales_sync_status_idx', columns: {#syncStatus})
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
  TextColumn get commandId => text().named('command_id').nullable()();
  TextColumn get syncStatus =>
      text().named('sync_status').withDefault(const Constant('local_only'))();
  TextColumn get backendReceiptId =>
      text().named('backend_receipt_id').nullable()();
  TextColumn get backendSaleId => text().named('backend_sale_id').nullable()();
  TextColumn get lastSyncError => text().named('last_sync_error').nullable()();
  IntColumn get lastSyncedAt => integer().named('last_synced_at').nullable()();
  BoolColumn get tombstone => boolean().withDefault(const Constant(false))();

  @override
  Set<Column<Object>>? get primaryKey => {id};
}

@TableIndex(name: 'customers_name_idx', columns: {#name})
@TableIndex(name: 'customers_phone_idx', columns: {#phone})
@TableIndex(name: 'customers_tombstone_idx', columns: {#tombstone})
class CustomerEntries extends Table {
  @override
  String get tableName => 'customers';

  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get phone => text().nullable()();
  TextColumn get email => text().nullable()();
  TextColumn get notes => text().nullable()();
  TextColumn get status => text().withDefault(const Constant('active'))();
  RealColumn get totalSpent =>
      real().named('total_spent').withDefault(const Constant(0))();
  RealColumn get balance => real().withDefault(const Constant(0))();
  IntColumn get createdAt => integer().named('created_at')();
  IntColumn get updatedAt =>
      integer().named('updated_at').withDefault(const Constant(0))();
  IntColumn get lastSeenAt => integer().named('last_seen_at').nullable()();
  BoolColumn get tombstone => boolean().withDefault(const Constant(false))();

  @override
  Set<Column<Object>>? get primaryKey => {id};
}

class CommerceOutboxEntries extends Table {
  @override
  String get tableName => 'commerce_outbox';

  TextColumn get commandId => text().named('command_id')();
  TextColumn get shopId => text().named('shop_id')();
  TextColumn get commandType => text().named('command_type')();
  TextColumn get domain => text()();
  IntColumn get baseDomainEpoch =>
      integer().named('base_domain_epoch').withDefault(const Constant(1))();
  TextColumn get payloadJson => text().named('payload_json')();
  TextColumn get syncStatus =>
      text().named('sync_status').withDefault(const Constant('pending'))();
  IntColumn get attemptCount =>
      integer().named('attempt_count').withDefault(const Constant(0))();
  TextColumn get lastError => text().named('last_error').nullable()();
  IntColumn get createdAt => integer().named('created_at')();
  IntColumn get updatedAt =>
      integer().named('updated_at').withDefault(const Constant(0))();
  IntColumn get lastAttemptAt =>
      integer().named('last_attempt_at').nullable()();
  IntColumn get completedAt => integer().named('completed_at').nullable()();

  @override
  Set<Column<Object>>? get primaryKey => {commandId};
}

class ExpenseEntries extends Table {
  @override
  String get tableName => 'expenses';

  TextColumn get id => text()();
  TextColumn get category =>
      text().withDefault(const Constant('General'))();
  RealColumn get amount => real().withDefault(const Constant(0))();
  TextColumn get description => text().withDefault(const Constant(''))();
  TextColumn get paymentMethod =>
      text().named('payment_method').withDefault(const Constant('CASH'))();
  TextColumn get paymentReference =>
      text().named('payment_reference').withDefault(const Constant(''))();
  TextColumn get expenseDate => text().named('expense_date')();
  TextColumn get actorName => text().named('actor_name').nullable()();
  IntColumn get createdAt => integer().named('created_at')();
  IntColumn get updatedAt =>
      integer().named('updated_at').withDefault(const Constant(0))();
  BoolColumn get tombstone => boolean().withDefault(const Constant(false))();

  @override
  Set<Column<Object>>? get primaryKey => {id};
}

@DriftDatabase(
  tables: [
    ShopSettingsEntries,
    InventoryEntries,
    InventoryPrivateEntries,
    SalesEntries,
    CustomerEntries,
    CommerceOutboxEntries,
    ExpenseEntries,
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
  int get schemaVersion => 8;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) async {
      await m.createAll();
    },
    onUpgrade: (m, from, to) async {
      if (from < 2) {
        await m.addColumn(salesEntries, salesEntries.commandId);
        await m.addColumn(salesEntries, salesEntries.syncStatus);
        await m.addColumn(salesEntries, salesEntries.backendReceiptId);
        await m.addColumn(salesEntries, salesEntries.lastSyncError);
        await m.addColumn(salesEntries, salesEntries.lastSyncedAt);
        await m.createTable(commerceOutboxEntries);
      }
      if (from < 3) {
        await m.addColumn(salesEntries, salesEntries.backendSaleId);
      }
      if (from < 4) {
        await m.createTable(customerEntries);
      }
      if (from < 5) {
        await m.addColumn(inventoryEntries, inventoryEntries.hsnCode);
        await m.addColumn(inventoryEntries, inventoryEntries.gstRate);
        await m.addColumn(
          inventoryEntries,
          inventoryEntries.priceIncludesTax,
        );
      }
      if (from < 6) {
        // Indexes are automatically handled by Drift on upgrade if we don't drop the table.
        // We just need to bump the schema version.
      }
      if (from < 7) {
        await m.createTable(expenseEntries);
      }
      if (from < 8) {
        await m.addColumn(inventoryEntries, inventoryEntries.imagePath);
      }
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
