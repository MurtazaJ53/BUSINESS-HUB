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
  TextColumn get commandId => text().named('command_id').nullable()();
  TextColumn get syncStatus =>
      text().named('sync_status').withDefault(const Constant('local_only'))();
  TextColumn get backendReceiptId =>
      text().named('backend_receipt_id').nullable()();
  TextColumn get backendSaleId => text().named('backend_sale_id').nullable()();
  TextColumn get lastSyncError => text().named('last_sync_error').nullable()();
  IntColumn get lastSyncedAt => integer().named('last_synced_at').nullable()();
  BoolColumn get tombstone => boolean().withDefault(const Constant(false))();
}

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

@DriftDatabase(
  tables: [
    ShopSettingsEntries,
    InventoryEntries,
    InventoryPrivateEntries,
    SalesEntries,
    CustomerEntries,
    CommerceOutboxEntries,
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
  int get schemaVersion => 4;

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
