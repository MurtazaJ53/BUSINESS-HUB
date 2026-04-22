/**
 * Drizzle ORM Schema — Local-First SQLite Tables
 *
 * Conventions (per Phase-2 spec):
 *   • updatedAt  – INTEGER ms-epoch for LWW conflict resolution
 *   • tombstone  – INTEGER (0|1) soft-delete; prevents resurrection on sync
 *   • sync_queue – mutation outbox that the push engine drains
 *   • sync_state – high-water mark per Firestore collection
 *
 * Normalized: sale_items & sale_payments are separate tables (not embedded JSON).
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ─── INVENTORY ──────────────────────────────────────────────

export const inventory = sqliteTable('inventory', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  price:       real('price').notNull().default(0),
  sku:         text('sku'),
  category:    text('category').notNull().default('General'),
  subcategory: text('subcategory'),
  size:        text('size'),
  description: text('description'),
  stock:       integer('stock').default(0),
  createdAt:   integer('created_at').notNull(),        // ms epoch
  updatedAt:   integer('updated_at').notNull(),        // ms epoch
  tombstone:   integer('tombstone').notNull().default(0),
  dirty:       integer('dirty').notNull().default(0),  // 1 = pending push
});

export const inventoryPrivate = sqliteTable('inventory_private', {
  id:               text('id').primaryKey(),
  costPrice:        real('cost_price').notNull().default(0),
  supplierId:       text('supplier_id'),
  lastPurchaseDate: text('last_purchase_date'),
  updatedAt:        integer('updated_at').notNull(),
  dirty:            integer('dirty').notNull().default(0),
});

// ─── SALES (Normalized) ────────────────────────────────────

export const sales = sqliteTable('sales', {
  id:            text('id').primaryKey(),
  total:         real('total').notNull().default(0),
  discount:      real('discount').notNull().default(0),
  discountValue: text('discount_value').default('0'),
  discountType:  text('discount_type').default('fixed'),
  paymentMode:   text('payment_mode').default('CASH'),
  customerName:  text('customer_name'),
  customerPhone: text('customer_phone'),
  customerId:    text('customer_id'),
  footerNote:    text('footer_note'),
  date:          text('date').notNull(),              // YYYY-MM-DD display
  createdAt:     integer('created_at').notNull(),
  updatedAt:     integer('updated_at').notNull(),
  tombstone:     integer('tombstone').notNull().default(0),
  dirty:         integer('dirty').notNull().default(0),
});

export const saleItems = sqliteTable('sale_items', {
  id:        text('id').primaryKey(),
  saleId:    text('sale_id').notNull(),
  itemId:    text('item_id').notNull(),
  name:      text('name').notNull(),
  quantity:  integer('quantity').notNull().default(1),
  price:     real('price').notNull().default(0),
  costPrice: real('cost_price'),
  size:      text('size'),
  isReturn:  integer('is_return').default(0),
});

export const salePayments = sqliteTable('sale_payments', {
  id:     text('id').primaryKey(),
  saleId: text('sale_id').notNull(),
  mode:   text('mode').notNull(),
  amount: real('amount').notNull().default(0),
});

// ─── CUSTOMERS ──────────────────────────────────────────────

export const customers = sqliteTable('customers', {
  id:         text('id').primaryKey(),
  name:       text('name').notNull(),
  phone:      text('phone').notNull().default('-'),
  email:      text('email'),
  totalSpent: real('total_spent').notNull().default(0),
  balance:    real('balance').notNull().default(0),
  createdAt:  integer('created_at').notNull(),
  updatedAt:  integer('updated_at').notNull(),
  tombstone:  integer('tombstone').notNull().default(0),
  dirty:      integer('dirty').notNull().default(0),
});

export const customerPayments = sqliteTable('customer_payments', {
  id:         text('id').primaryKey(),
  customerId: text('customer_id').notNull(),
  amount:     real('amount').notNull().default(0),
  date:       text('date').notNull(),
  createdAt:  integer('created_at').notNull(),
  updatedAt:  integer('updated_at').notNull(),
  tombstone:  integer('tombstone').notNull().default(0),
  dirty:      integer('dirty').notNull().default(0),
});

// ─── EXPENSES ───────────────────────────────────────────────

export const expenses = sqliteTable('expenses', {
  id:          text('id').primaryKey(),
  category:    text('category').notNull(),
  amount:      real('amount').notNull().default(0),
  description: text('description').notNull().default(''),
  date:        text('date').notNull(),
  createdAt:   integer('created_at').notNull(),
  updatedAt:   integer('updated_at').notNull(),
  tombstone:   integer('tombstone').notNull().default(0),
  dirty:       integer('dirty').notNull().default(0),
});

// ─── STAFF ──────────────────────────────────────────────────

export const staff = sqliteTable('staff', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  phone:       text('phone').notNull().default(''),
  email:       text('email'),
  role:        text('role').notNull().default('staff'),
  joinedAt:    text('joined_at').notNull(),
  status:      text('status').notNull().default('active'),
  permissions: text('permissions'),                    // JSON string
  updatedAt:   integer('updated_at').notNull(),
  tombstone:   integer('tombstone').notNull().default(0),
  dirty:       integer('dirty').notNull().default(0),
});

export const staffPrivate = sqliteTable('staff_private', {
  id:        text('id').primaryKey(),
  salary:    real('salary').default(0),
  pin:       text('pin'),
  updatedAt: integer('updated_at').notNull(),
  dirty:     integer('dirty').notNull().default(0),
});

// ─── ATTENDANCE ─────────────────────────────────────────────

export const attendance = sqliteTable('attendance', {
  id:         text('id').primaryKey(),
  staffId:    text('staff_id').notNull(),
  date:       text('date').notNull(),              // YYYY-MM-DD
  clockIn:    text('clock_in'),
  clockOut:   text('clock_out'),
  status:     text('status').notNull().default('ABSENT'),
  totalHours: real('total_hours'),
  overtime:   real('overtime'),
  bonus:      real('bonus'),
  note:       text('note'),
  updatedAt:  integer('updated_at').notNull(),
  tombstone:  integer('tombstone').notNull().default(0),
  dirty:      integer('dirty').notNull().default(0),
});

// ─── SHOP METADATA (KV Store) ──────────────────────────────

export const shopMetadata = sqliteTable('shop_metadata', {
  key:       text('key').primaryKey(),
  value:     text('value').notNull(),              // JSON
  updatedAt: integer('updated_at').notNull(),
  dirty:     integer('dirty').notNull().default(0),
});

// ─── SYNC INFRASTRUCTURE ───────────────────────────────────

/** Mutation outbox: pending offline writes that need pushing to Firestore. */
export const syncQueue = sqliteTable('sync_queue', {
  opId:       text('op_id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId:   text('entity_id').notNull(),
  operation:  text('operation').notNull(),          // CREATE | UPDATE | DELETE
  payload:    text('payload').notNull(),             // JSON
  createdAt:  integer('created_at').notNull(),       // ms epoch
  retries:    integer('retries').notNull().default(0),
});

/** Per-collection sync watermark so incremental pulls only request deltas. */
export const syncState = sqliteTable('sync_state', {
  entityType:   text('entity_type').primaryKey(),
  lastSyncedAt: integer('last_synced_at').notNull(), // ms epoch
});
