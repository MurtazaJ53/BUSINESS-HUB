/**
 * SQLite Adapter — Industrial Indestructible Architecture
 * 
 * Optimized for professional deployment and agentic ERP environments.
 * This engine bypasses migration-log traps by using idempotent schema 
 * verification on every boot.
 */

import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

export interface RunResult { changes: number; }

interface SqlJsDatabase {
  run(sql: string, params?: any[]): void;
  exec(sql: string): Array<{ columns: string[]; values: any[][] }>;
  getChangesCount(): number;
  export(): Uint8Array;
}

const IDB_NAME = 'business_hub_sqljs';
const IDB_STORE = 'databases';
const IDB_KEY = 'main';

async function idbSave(data: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => {
      const tx = req.result.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(data, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

async function idbLoad(): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => {
      const tx = req.result.transaction(IDB_STORE, 'readonly');
      const getReq = tx.objectStore(IDB_STORE).get(IDB_KEY);
      getReq.onsuccess = () => resolve(getReq.result ?? null);
      getReq.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}

class DatabaseSingleton {
  private platform: 'web' | 'native' = 'web';
  private ready = false;
  private booting = false;
  private bootPromise: Promise<void> | null = null;
  private nativeSqlite: SQLiteConnection | null = null;
  private nativeDb: any = null;
  private webDb: SqlJsDatabase | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  async boot(): Promise<void> {
    if (this.ready) return;
    if (this.bootPromise) return this.bootPromise;

    this.bootPromise = (async () => {
      this.booting = true;
      this.platform = Capacitor.getPlatform() === 'web' ? 'web' : 'native';

      if (this.platform === 'native') {
        await this.bootNative();
      } else {
        await this.bootWeb();
      }

      await this.runMigrations();
      
      this.ready = true;
      this.booting = false;
      console.log('[DB] System Online');
    })();

    return this.bootPromise;
  }

  private async bootNative(): Promise<void> {
    try {
      this.nativeSqlite = new SQLiteConnection(CapacitorSQLite);

      const DB_NAME = 'business_hub';
      const retCC = await this.nativeSqlite.checkConnectionsConsistency();
      const isConn = (await this.nativeSqlite.isConnection(DB_NAME, false)).result;

      if (retCC.result && isConn) {
        this.nativeDb = await this.nativeSqlite.retrieveConnection(DB_NAME, false);
      } else {
        this.nativeDb = await this.nativeSqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
      }
      await this.nativeDb.open();
    } catch (err) {
      throw new Error(`Native DB Boot Failure: ${err}`);
    }
  }

  private async bootWeb(): Promise<void> {
    try {
      const initSqlJs = (await import('sql.js')).default;
      const response = await fetch('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/sql-wasm.wasm');
      const SQL = await initSqlJs({ wasmBinary: new Uint8Array(await response.arrayBuffer()) });
      const saved = await idbLoad();
      this.webDb = saved ? new SQL.Database(saved) : new SQL.Database();
      this.webDb!.run('PRAGMA journal_mode = MEMORY;');
    } catch (err) {
      const initSqlJs = (await import('sql.js')).default;
      this.webDb = (await initSqlJs()).Database();
    }
  }

  async query<T = Record<string, unknown>>(sql: string, params?: any[]): Promise<T[]> {
    this.assertReady();
    if (this.platform === 'native') {
      const res = await this.nativeDb.query(sql, params);
      return (res.values ?? []) as T[];
    }
    if (params && params.length > 0) {
      const stmt = (this.webDb as any).prepare(sql);
      stmt.bind(params);
      const rows: T[] = [];
      while (stmt.step()) {
        const cols = stmt.getColumnNames();
        const vals = stmt.get();
        const row: any = {};
        cols.forEach((c: string, i: number) => { row[c] = vals[i]; });
        rows.push(row);
      }
      stmt.free();
      return rows;
    }
    const results = this.webDb!.exec(sql);
    if (results.length === 0) return [];
    const { columns, values } = results[0];
    return values.map(row => {
      const obj: any = {};
      columns.forEach((c, i) => { obj[c] = row[i]; });
      return obj;
    });
  }

  async run(sql: string, params?: any[]): Promise<RunResult> {
    this.assertReady();
    if (this.platform === 'native') {
      const res = await this.nativeDb.run(sql, params);
      return { changes: res.changes?.changes ?? 0 };
    }
    this.webDb!.run(sql, params);
    if (this.platform === 'web') {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(async () => {
        const data = this.webDb!.export();
        await idbSave(data);
      }, 500);
    }
    return { changes: 1 };
  }

  async transaction(stmts: Array<{ sql: string; params?: any[] }>): Promise<void> {
    this.assertReady();
    if (this.platform === 'native') {
      await this.nativeDb.run('BEGIN TRANSACTION;');
      try {
        for (const s of stmts) await this.nativeDb.run(s.sql, s.params);
        await this.nativeDb.run('COMMIT;');
      } catch (e) {
        await this.nativeDb.run('ROLLBACK;');
        throw e;
      }
      return;
    }
    this.webDb!.run('BEGIN TRANSACTION;');
    try {
      for (const s of stmts) this.webDb!.run(s.sql, s.params);
      this.webDb!.run('COMMIT;');
    } catch (e) {
      this.webDb!.run('ROLLBACK;');
      throw e;
    }
  }

  private async runMigrations(): Promise<void> {
    console.log('[DB] Verifying Indestructible Core Schema...');

    const coreSchema = `
        CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS shop_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL, dirty INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS sync_state (entity_type TEXT PRIMARY KEY, last_synced_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS outbox (opId TEXT PRIMARY KEY, entityType TEXT NOT NULL, entityId TEXT NOT NULL, operation TEXT NOT NULL, payload TEXT NOT NULL, createdAt INTEGER NOT NULL, retries INTEGER DEFAULT 0);
        
        CREATE TABLE IF NOT EXISTS inventory (id TEXT PRIMARY KEY, name TEXT NOT NULL, price REAL, stock REAL, category TEXT, sku TEXT, tombstone INTEGER DEFAULT 0, updatedAt INTEGER, dirty INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS inventory_private (id TEXT PRIMARY KEY, costPrice REAL, lastPurchaseDate TEXT, tombstone INTEGER DEFAULT 0, updatedAt INTEGER, dirty INTEGER DEFAULT 0);
        
        CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, customerId TEXT, customerName TEXT, customerPhone TEXT, total REAL NOT NULL, date TEXT, status TEXT, items TEXT NOT NULL, payments TEXT NOT NULL, tombstone INTEGER DEFAULT 0, createdAt TEXT, updatedAt INTEGER, dirty INTEGER DEFAULT 0);
        
        CREATE TABLE IF NOT EXISTS staff (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, email TEXT, role TEXT, status TEXT, joinedAt TEXT, permissions TEXT, tombstone INTEGER DEFAULT 0, updatedAt INTEGER, dirty INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS staff_private (id TEXT PRIMARY KEY, salary REAL, pin TEXT, tombstone INTEGER DEFAULT 0, updatedAt INTEGER, dirty INTEGER DEFAULT 0);
        
        CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, balance REAL, totalSpent REAL, tombstone INTEGER DEFAULT 0, createdAt TEXT, updatedAt INTEGER, dirty INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS customer_payments (id TEXT PRIMARY KEY, customerId TEXT, amount REAL, date TEXT, tombstone INTEGER DEFAULT 0, createdAt TEXT, updatedAt INTEGER, dirty INTEGER DEFAULT 0);
        
        CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, category TEXT, amount REAL, description TEXT, date TEXT, tombstone INTEGER DEFAULT 0, createdAt TEXT, updatedAt INTEGER, dirty INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS attendance (id TEXT PRIMARY KEY, staffId TEXT, date TEXT, clockIn TEXT, clockOut TEXT, totalHours REAL, status TEXT, overtime REAL, bonus REAL, tombstone INTEGER DEFAULT 0, updatedAt INTEGER, dirty INTEGER DEFAULT 0);
        
        CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sales(id);
        CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
    `;

    try {
        if (this.platform === 'native') {
            await this.nativeDb.execute(coreSchema);
        } else {
            this.webDb!.run(coreSchema);
        }
    } catch (schemaError) {
        console.error('[DB] Schema Compilation Failed:', schemaError);
        throw new Error('Database schema compilation failed.');
    }

    const checkSchema = async () => {
        try {
            const tables = await this.query<{ name: string }>(
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('staff', 'inventory', 'sales', 'shop_metadata');"
            );
            return tables.length === 4;
        } catch (e) { return false; }
    };

    if (!(await checkSchema())) {
        throw new Error('Schema Integrity Audit Failed. Critical tables are missing.');
    }
    console.log('[DB] Schema Verification Complete.');
  }

  async nuclearReset(): Promise<void> {
    console.warn('[DB] NUCLEAR RESET TRIGGERED');
    if (this.platform === 'native') {
      try {
        if (this.nativeDb) await this.nativeDb.close();
        await CapacitorSQLite.deleteDatabase({ database: 'business_hub' });
      } catch (e) { console.error('Nuclear Delete failed:', e); }
    } else {
      localStorage.clear();
      const req = indexedDB.deleteDatabase(IDB_NAME);
      await new Promise(r => req.onsuccess = r);
    }
    window.location.reload();
  }

  private assertReady(): void {
    if (!this.ready && !this.booting) {
      throw new Error('System not ready.');
    }
  }
}

export const Database = new DatabaseSingleton();

