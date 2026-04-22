/**
 * Drizzle ORM Schema — Local-First SQLite Tables
 * 
 * Every entity table includes:
 *   - updatedAt: ISO timestamp for LWW conflict resolution
 *   - isDirty: boolean flag for pending sync
 *   - isDeleted: soft-delete tombstone (prevents resurrection on sync)
 * 
 * Sale items and payments are normalized into separate tables
 * for efficient SQL queries across the relational model.
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ─── INVENTORY ──────────────────────────────────────────────

export const inventory = sqliteTable('inventory', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  price: real('price').notNull().default(0),
  sku: text('sku'),
  category: text('category').notNull().default('General'),
  subcategory: text('subcategory'),
  size: text('size'),
  description: text('description'),
  stock: integer('stock').default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(false),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
});

export const inventoryPrivate = sqliteTable('inventory_private', {
  id: text('id').primaryKey(),
  costPrice: real('cost_price').notNull().default(0),
  supplierId: text('supplier_id'),
  lastPurchaseDate: text('last_purchase_date'),
  updatedAt: text('updated_at').notNull(),
  isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(false),
});

// ─── SALES (Normalized) ────────────────────────────────────

export const sales = sqliteTable('sales', {
  id: text('id').primaryKey(),
  total: real('total').notNull().default(0),
  discount: real('discount').notNull().default(0),
  discountValue: text('discount_value').default('0'),
  discountType: text('discount_type').default('fixed'), // 'fixed' | 'percent'
  paymentMode: text('payment_mode').default('CASH'),    // Legacy compat
  customerName: text('customer_name'),
  customerPhone: text('customer_phone'),
  customerId: text('customer_id'),
  footerNote: text('footer_note'),
  date: text('date').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(false),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
});

export const saleItems = sqliteTable('sale_items', {
  id: text('id').primaryKey(), // saleId_itemId_idx
  saleId: text('sale_id').notNull(),
  itemId: text('item_id').notNull(),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull().default(1),
  price: real('price').notNull().default(0),
  costPrice: real('cost_price'),
  size: text('size'),
  isReturn: integer('is_return', { mode: 'boolean' }).default(false),
});

export const salePayments = sqliteTable('sale_payments', {
  id: text('id').primaryKey(), // saleId_mode_idx
  saleId: text('sale_id').notNull(),
  mode: text('mode').notNull(),
  amount: real('amount').notNull().default(0),
});

// ─── CUSTOMERS ──────────────────────────────────────────────

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull().default('-'),
  email: text('email'),
  totalSpent: real('total_spent').notNull().default(0),
  balance: real('balance').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(false),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
});

export const customerPayments = sqliteTable('customer_payments', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull(),
  amount: real('amount').notNull().default(0),
  date: text('date').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(false),
});

// ─── EXPENSES ───────────────────────────────────────────────

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  amount: real('amount').notNull().default(0),
  description: text('description').notNull().default(''),
  date: text('date').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(false),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
});

// ─── STAFF ──────────────────────────────────────────────────

export const staff = sqliteTable('staff', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull().default(''),
  email: text('email'),
  role: text('role').notNull().default('staff'),
  joinedAt: text('joined_at').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'inactive'
  permissions: text('permissions'), // JSON array string
  updatedAt: text('updated_at').notNull(),
  isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(false),
});

export const staffPrivate = sqliteTable('staff_private', {
  id: text('id').primaryKey(),
  salary: real('salary').default(0),
  pin: text('pin'),
  updatedAt: text('updated_at').notNull(),
  isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(false),
});

// ─── ATTENDANCE ─────────────────────────────────────────────

export const attendance = sqliteTable('attendance', {
  id: text('id').primaryKey(), // staffId_date
  staffId: text('staff_id').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  clockIn: text('clock_in'),
  clockOut: text('clock_out'),
  status: text('status').notNull().default('ABSENT'), // PRESENT | ABSENT | HALF_DAY | LEAVE
  totalHours: real('total_hours'),
  overtime: real('overtime'),
  bonus: real('bonus'),
  note: text('note'),
  updatedAt: text('updated_at').notNull(),
  isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(false),
});

// ─── SHOP METADATA (KV Store) ──────────────────────────────

export const shopMetadata = sqliteTable('shop_metadata', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON stringified
  updatedAt: text('updated_at').notNull(),
  isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(false),
});

// ─── SYNC INFRASTRUCTURE ───────────────────────────────────

export const syncOutbox = sqliteTable('sync_outbox', {
  opId: text('op_id').primaryKey(),
  entityType: text('entity_type').notNull(), // 'inventory' | 'sales' | etc.
  entityId: text('entity_id').notNull(),
  operation: text('operation').notNull(), // 'CREATE' | 'UPDATE' | 'DELETE'
  payload: text('payload').notNull(), // JSON stringified
  createdAt: text('created_at').notNull(),
  retries: integer('retries').notNull().default(0),
});

export const syncState = sqliteTable('sync_state', {
  entityType: text('entity_type').primaryKey(),
  lastSyncedAt: text('last_synced_at').notNull(),
});
