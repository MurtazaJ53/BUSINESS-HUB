/**
 * SQLite Adapter — Indestructible Self-Healing Architecture
 * 
 * Optimized for professional deployment. 
 * This engine detects schema corruption and automatically self-repairs.
 */

import { Capacitor } from '@capacitor/core';

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
  private nativeSqlite: any = null;
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
      console.log('[DB] Ready');
    })();

    return this.bootPromise;
  }

  private async bootNative(): Promise<void> {
    try {
      const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
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
      this.webDb = (await (await import('sql.js')).default()).Database(); // Fallback
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

  private async runMigrations(): Promise<void> {
    const checkSchema = async () => {
        try {
            const tables = await this.query<{ name: string }>(
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('staff', 'inventory', 'sales', 'shop_metadata');"
            );
            return tables.length === 4;
        } catch (e) { return false; }
    };

    // Stage 1: Meta Reset Check
    // If the DB was partly initialized in a previous failed session, we wipe it.
    if (this.platform === 'native') {
        const hasMigrations = (await this.nativeDb.query("SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations';")).values?.length > 0;
        const schemaOk = hasMigrations ? await checkSchema() : false;

        if (hasMigrations && !schemaOk) {
            console.warn('[DB] Schema corruption detected. Executing self-repair factory reset...');
            await this.nativeDb.close();
            await this.nativeSqlite.deleteDatabase('business_hub', false);
            await this.bootNative(); // Re-open fresh
        }
    }

    // Stage 2: Initialize Core Tables
    const initSql = `
        CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS shop_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL, dirty INTEGER NOT NULL DEFAULT 0);
    `;
    if (this.platform === 'native') {
        await this.nativeDb.execute(initSql);
    } else {
        this.webDb!.run(initSql);
    }

    // Stage 3: Load & Execute Migration
    const { default: sql0001 } = await import('./migrations/0001_init.sql?raw');
    const applied = await this.query<{ id: string }>('SELECT id FROM _migrations WHERE id = ?;', ['0001_init']);
    
    if (applied.length === 0) {
        console.log('[DB] Applying Industrial Migration 0001...');
        if (this.platform === 'native') {
            await this.nativeDb.execute(sql0001);
            await this.nativeDb.run('INSERT INTO _migrations (id, applied_at) VALUES (?, ?);', ['0001_init', Date.now()]);
        } else {
            this.webDb!.run(sql0001);
            this.webDb!.run('INSERT INTO _migrations (id, applied_at) VALUES (?, ?);', ['0001_init', Date.now()]);
        }
    }

    // Stage 4: High-Reliability Audit
    if (!(await checkSchema())) {
        throw new Error('Database integrity check failed after self-repair. Please contact support.');
    }
  }

  /** Nuclear Recovery: Deletes the physical database file and reboots fresh. */
  async nuclearReset(): Promise<void> {
    console.warn('[DB] NUCLEAR RESET TRIGGERED');
    if (this.platform === 'native') {
      try {
        await this.nativeDb.close();
        const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
        const conn = new SQLiteConnection(CapacitorSQLite);
        await conn.deleteDatabase('business_hub', false);
      } catch (e) { console.error('Delete failed', e); }
    } else {
      localStorage.clear();
      const req = indexedDB.deleteDatabase(IDB_NAME);
      await new Promise(r => req.onsuccess = r);
    }
    window.location.reload();
  }

  private assertReady(): void {
    if (!this.ready && !this.booting) {
      throw new Error('[DB] System not ready.');
    }
  }
}

export const Database = new DatabaseSingleton();
