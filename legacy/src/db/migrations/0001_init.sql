-- ================================================================
-- Business Hub — 0001_init
-- Phase 2: Local-First SQLite Schema
--
-- Conventions:
--   updated_at : INTEGER (ms epoch)  – LWW conflict resolution
--   tombstone  : INTEGER (0|1)       – soft-delete
--   dirty      : INTEGER (0|1)       – pending push
-- ================================================================

-- Inventory (Public)
CREATE TABLE IF NOT EXISTS inventory (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  price       REAL NOT NULL DEFAULT 0,
  sku         TEXT,
  category    TEXT NOT NULL DEFAULT 'General',
  subcategory TEXT,
  size        TEXT,
  description TEXT,
  stock       INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  tombstone   INTEGER NOT NULL DEFAULT 0,
  dirty       INTEGER NOT NULL DEFAULT 0
);

-- Inventory Private (Admin-only cost data)
CREATE TABLE IF NOT EXISTS inventory_private (
  id                 TEXT PRIMARY KEY,
  cost_price         REAL NOT NULL DEFAULT 0,
  supplier_id        TEXT,
  last_purchase_date TEXT,
  updated_at         INTEGER NOT NULL,
  dirty              INTEGER NOT NULL DEFAULT 0
);

-- Sales
CREATE TABLE IF NOT EXISTS sales (
  id             TEXT PRIMARY KEY,
  total          REAL NOT NULL DEFAULT 0,
  discount       REAL NOT NULL DEFAULT 0,
  discount_value TEXT DEFAULT '0',
  discount_type  TEXT DEFAULT 'fixed',
  payment_mode   TEXT DEFAULT 'CASH',
  customer_name  TEXT,
  customer_phone TEXT,
  customer_id    TEXT,
  footer_note    TEXT,
  date           TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  tombstone      INTEGER NOT NULL DEFAULT 0,
  dirty          INTEGER NOT NULL DEFAULT 0
);

-- Sale Items (normalized from Sale.items[])
CREATE TABLE IF NOT EXISTS sale_items (
  id        TEXT PRIMARY KEY,
  sale_id   TEXT NOT NULL,
  item_id   TEXT NOT NULL,
  name      TEXT NOT NULL,
  quantity  INTEGER NOT NULL DEFAULT 1,
  price     REAL NOT NULL DEFAULT 0,
  cost_price REAL,
  size      TEXT,
  is_return INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_item_id ON sale_items(item_id);

-- Sale Payments (normalized from Sale.payments[])
CREATE TABLE IF NOT EXISTS sale_payments (
  id      TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  mode    TEXT NOT NULL,
  amount  REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON sale_payments(sale_id);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL DEFAULT '-',
  email       TEXT,
  total_spent REAL NOT NULL DEFAULT 0,
  balance     REAL NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  tombstone   INTEGER NOT NULL DEFAULT 0,
  dirty       INTEGER NOT NULL DEFAULT 0
);

-- Customer Payments
CREATE TABLE IF NOT EXISTS customer_payments (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  amount      REAL NOT NULL DEFAULT 0,
  date        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  tombstone   INTEGER NOT NULL DEFAULT 0,
  dirty       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cust_pay_customer ON customer_payments(customer_id);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id          TEXT PRIMARY KEY,
  category    TEXT NOT NULL,
  amount      REAL NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  date        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  tombstone   INTEGER NOT NULL DEFAULT 0,
  dirty       INTEGER NOT NULL DEFAULT 0
);

-- Staff
CREATE TABLE IF NOT EXISTS staff (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL DEFAULT '',
  email       TEXT,
  role        TEXT NOT NULL DEFAULT 'staff',
  joined_at   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',
  permissions TEXT,
  updated_at  INTEGER NOT NULL,
  tombstone   INTEGER NOT NULL DEFAULT 0,
  dirty       INTEGER NOT NULL DEFAULT 0
);

-- Staff Private (Admin-only)
CREATE TABLE IF NOT EXISTS staff_private (
  id         TEXT PRIMARY KEY,
  salary     REAL DEFAULT 0,
  pin        TEXT,
  updated_at INTEGER NOT NULL,
  dirty      INTEGER NOT NULL DEFAULT 0
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id          TEXT PRIMARY KEY,
  staff_id    TEXT NOT NULL,
  date        TEXT NOT NULL,
  clock_in    TEXT,
  clock_out   TEXT,
  status      TEXT NOT NULL DEFAULT 'ABSENT',
  total_hours REAL,
  overtime    REAL,
  bonus       REAL,
  note        TEXT,
  updated_at  INTEGER NOT NULL,
  tombstone   INTEGER NOT NULL DEFAULT 0,
  dirty       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_attendance_staff ON attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date  ON attendance(date);

-- Shop Metadata (KV Store)
CREATE TABLE IF NOT EXISTS shop_metadata (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  dirty      INTEGER NOT NULL DEFAULT 0
);

-- Sync Queue (mutation outbox)
CREATE TABLE IF NOT EXISTS sync_queue (
  op_id       TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  operation   TEXT NOT NULL,
  payload     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  retries     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);

-- Sync State (per-collection watermark)
CREATE TABLE IF NOT EXISTS sync_state (
  entity_type    TEXT PRIMARY KEY,
  last_synced_at INTEGER NOT NULL
);
