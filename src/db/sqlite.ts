/**
 * SQLite Adapter — Dual-platform Database singleton
 *
 * • Native (Android / iOS)  → @capacitor-community/sqlite  (file-backed, instant)
 * • Web (dev / PWA)         → sql.js WASM + IndexedDB persistence
 *
 * Every consumer imports `Database` and calls one of the typed helpers:
 *   query<T>(sql, params?)   → T[]          (SELECT)
 *   run(sql, params?)        → { changes }  (INSERT/UPDATE/DELETE)
 *   transaction(stmts[])     → void          (atomic batch)
 *
 * Lifecycle:
 *   1. main.tsx calls `await Database.boot()`
 *   2. boot() selects the right driver, opens the DB, runs migrations
 *   3. The rest of the app uses Database.query / .run / .transaction
 */

import { Capacitor } from '@capacitor/core';

// ─── Types ──────────────────────────────────────────────────

export interface QueryResult<T = Record<string, unknown>> {
  values: T[];
}
export interface RunResult {
  changes: number;
}

// SQL.js types (subset we actually use)
interface SqlJsDatabase {
  run(sql: string, params?: any[]): void;
  exec(sql: string): Array<{ columns: string[]; values: any[][] }>;
  getChangesCount(): number;
  export(): Uint8Array;
}

// ─── IDB helpers (for sql.js web persistence) ──────────────

const IDB_NAME = 'business_hub_sqljs';
const IDB_STORE = 'databases';
const IDB_KEY = 'main';

async function idbSave(data: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => {
      const tx = req.result.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(data, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbLoad(): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => {
      const tx = req.result.transaction(IDB_STORE, 'readonly');
      const getReq = tx.objectStore(IDB_STORE).get(IDB_KEY);
      getReq.onsuccess = () => resolve(getReq.result ?? null);
      getReq.onerror = () => reject(getReq.error);
    };
    req.onerror = () => reject(req.error);
  });
}

// ─── Database Singleton ─────────────────────────────────────

class DatabaseSingleton {
  private platform: 'native' | 'web' = 'web';
  private ready = false;

  // Native driver state (@capacitor-community/sqlite)
  private nativeSqlite: any = null;     // SQLiteConnection
  private nativeDb: any = null;         // SQLiteDBConnection

  // Web driver state (sql.js)
  private webDb: SqlJsDatabase | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  /** Call once from main.tsx before React renders. */
  async boot(): Promise<void> {
    if (this.ready) return;

    this.platform = Capacitor.getPlatform() === 'web' ? 'web' : 'native';
    console.log(`[DB] Booting on platform: ${this.platform}`);

    if (this.platform === 'native') {
      await this.bootNative();
    } else {
      await this.bootWeb();
    }

    // Run migrations
    await this.runMigrations();
    this.ready = true;
    console.log('[DB] Ready');
  }

  // ── Native boot ────────────────────────────────────────────

  private async bootNative(): Promise<void> {
    const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
    this.nativeSqlite = new SQLiteConnection(CapacitorSQLite);

    const DB_NAME = 'business_hub';
    const retCC = await this.nativeSqlite.checkConnectionsConsistency();
    const isConn = (await this.nativeSqlite.isConnection(DB_NAME, false)).result;

    if (retCC.result && isConn) {
      this.nativeDb = await this.nativeSqlite.retrieveConnection(DB_NAME, false);
    } else {
      this.nativeDb = await this.nativeSqlite.createConnection(
        DB_NAME, false, 'no-encryption', 1, false,
      );
    }
    await this.nativeDb.open();
  }

  // ── Web boot (sql.js + IndexedDB persistence) ─────────────

  private async bootWeb(): Promise<void> {
    const initSqlJs = (await import('sql.js')).default;

    // Load WASM from CDN (sql.js ships its own)
    const SQL = await initSqlJs({
      locateFile: (file: string) =>
        `https://sql.js.org/dist/${file}`,
    });

    // Try to restore a previously persisted database
    const saved = await idbLoad();
    this.webDb = saved ? new SQL.Database(saved) : new SQL.Database();

    // Enable WAL-like pragma for better performance
    this.webDb!.run('PRAGMA journal_mode = MEMORY;');
  }

  // ── Persistence (web only, debounced) ──────────────────────

  private scheduleSave(): void {
    if (this.platform !== 'web' || !this.webDb) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      try {
        const data = this.webDb!.export();
        await idbSave(data);
      } catch (e) {
        console.error('[DB] IDB save failed', e);
      }
    }, 500); // debounce 500ms
  }

  /** Force-flush web database to IndexedDB right now. */
  async flush(): Promise<void> {
    if (this.platform === 'web' && this.webDb) {
      const data = this.webDb.export();
      await idbSave(data);
    }
  }

  // ── query<T>() — SELECT rows ──────────────────────────────

  async query<T = Record<string, unknown>>(sql: string, params?: any[]): Promise<T[]> {
    this.assertReady();

    if (this.platform === 'native') {
      const res = await this.nativeDb.query(sql, params);
      return (res.values ?? []) as T[];
    }

    // sql.js path: exec() returns {columns, values[][]}
    // We need to bind params manually
    if (params && params.length > 0) {
      // Use a statement for parameterised queries
      const stmt = (this.webDb as any).prepare(sql);
      stmt.bind(params);

      const rows: T[] = [];
      while (stmt.step()) {
        const cols: string[] = stmt.getColumnNames();
        const vals: any[] = stmt.get();
        const row: Record<string, any> = {};
        cols.forEach((c, i) => { row[c] = vals[i]; });
        rows.push(row as T);
      }
      stmt.free();
      return rows;
    }

    // No params — use exec()
    const results = this.webDb!.exec(sql);
    if (results.length === 0) return [];
    const { columns, values } = results[0];
    return values.map(row => {
      const obj: Record<string, any> = {};
      columns.forEach((c, i) => { obj[c] = row[i]; });
      return obj as T;
    });
  }

  // ── run() — INSERT / UPDATE / DELETE ──────────────────────

  async run(sql: string, params?: any[]): Promise<RunResult> {
    this.assertReady();

    if (this.platform === 'native') {
      const res = await this.nativeDb.run(sql, params);
      return { changes: res.changes?.changes ?? 0 };
    }

    this.webDb!.run(sql, params);
    const changes = this.webDb!.getChangesCount();
    this.scheduleSave();
    return { changes };
  }

  // ── transaction() — atomic batch ──────────────────────────

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

    // Web path
    this.webDb!.run('BEGIN TRANSACTION;');
    try {
      for (const s of stmts) this.webDb!.run(s.sql, s.params);
      this.webDb!.run('COMMIT;');
      this.scheduleSave();
    } catch (e) {
      this.webDb!.run('ROLLBACK;');
      throw e;
    }
  }

  // ── Migrations ────────────────────────────────────────────

  private async runMigrations(): Promise<void> {
    // Ensure tracker table
    await this.run(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
    `);

    const applied = await this.query<{ id: string }>('SELECT id FROM _migrations;');
    const appliedIds = new Set(applied.map(r => r.id));

    // Import migration SQL (Vite ?raw)
    const { default: sql0001 } = await import('./migrations/0001_init.sql?raw');

    const migrations: Array<{ id: string; sql: string }> = [
      { id: '0001_init', sql: sql0001 },
    ];

    for (const m of migrations) {
      if (appliedIds.has(m.id)) continue;
      console.log(`[DB] Applying migration: ${m.id}`);

      const stmts = m.sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const stmt of stmts) {
        await this.run(stmt + ';');
      }

      await this.run(
        'INSERT INTO _migrations (id, applied_at) VALUES (?, ?);',
        [m.id, Date.now()],
      );
      console.log(`[DB] Migration ${m.id} applied`);
    }
  }

  // ── Close ─────────────────────────────────────────────────

  async close(): Promise<void> {
    if (this.platform === 'native' && this.nativeDb) {
      await this.nativeDb.close();
      await this.nativeSqlite.closeConnection('business_hub', false);
      this.nativeDb = null;
    }
    if (this.platform === 'web' && this.webDb) {
      await this.flush();
      (this.webDb as any).close();
      this.webDb = null;
    }
    this.ready = false;
  }

  private assertReady(): void {
    if (!this.ready) throw new Error('[DB] Not initialized. Call Database.boot() first.');
  }
}

/** The app-wide Database singleton. Import this everywhere. */
export const Database = new DatabaseSingleton();
