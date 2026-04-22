/**
 * Database Connection Layer
 * 
 * Initializes @capacitor-community/sqlite plugin, opens the database,
 * runs pending migrations, and exports a query executor.
 * 
 * Platform detection:
 *   - Android/iOS: native SQLite (file-backed, instant)
 *   - Web: sql.js fallback (in-memory + IndexedDB persistence)
 */

import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

const DB_NAME = 'business_hub';
const DB_VERSION = 1;

let sqlite: SQLiteConnection;
let db: SQLiteDBConnection | null = null;

/**
 * Initialize the SQLite connection and run migrations.
 * Must be called once at app startup before any data access.
 */
export async function initDatabase(): Promise<void> {
  sqlite = new SQLiteConnection(CapacitorSQLite);

  const platform = Capacitor.getPlatform();

  // Web platform requires explicit initialization of the sql.js WASM engine
  if (platform === 'web') {
    await sqlite.initWebStore();
  }

  // Check if the database already exists
  const retCC = await sqlite.checkConnectionsConsistency();
  const isConn = (await sqlite.isConnection(DB_NAME, false)).result;

  if (retCC.result && isConn) {
    db = await sqlite.retrieveConnection(DB_NAME, false);
  } else {
    db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);
  }

  await db.open();

  // Run migrations
  await runMigrations(db);

  console.log('[DB] Database initialized successfully on platform:', platform);
}

/**
 * Get the active database connection.
 * Throws if called before initDatabase().
 */
export function getDb(): SQLiteDBConnection {
  if (!db) {
    throw new Error('[DB] Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Execute a raw SQL query and return results.
 * This is the primary interface for repositories.
 */
export async function execQuery<T = any>(sql: string, values?: any[]): Promise<T[]> {
  const conn = getDb();
  const result = await conn.query(sql, values);
  return (result.values || []) as T[];
}

/**
 * Execute a SQL statement (INSERT, UPDATE, DELETE) that modifies data.
 * Returns the number of rows changed.
 */
export async function execRun(sql: string, values?: any[]): Promise<{ changes: number }> {
  const conn = getDb();
  const result = await conn.run(sql, values);
  return { changes: result.changes?.changes ?? 0 };
}

/**
 * Execute multiple SQL statements in a single transaction.
 * Rolls back on any failure.
 */
export async function execTransaction(statements: Array<{ sql: string; values?: any[] }>): Promise<void> {
  const conn = getDb();
  
  await conn.run('BEGIN TRANSACTION;');
  try {
    for (const stmt of statements) {
      await conn.run(stmt.sql, stmt.values);
    }
    await conn.run('COMMIT;');
  } catch (error) {
    await conn.run('ROLLBACK;');
    throw error;
  }
}

/**
 * Save the web database to IndexedDB for persistence.
 * No-op on native platforms.
 */
export async function saveToStore(): Promise<void> {
  const platform = Capacitor.getPlatform();
  if (platform === 'web') {
    await sqlite.saveToStore(DB_NAME);
  }
}

/**
 * Close the database connection gracefully.
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await saveToStore();
    await db.close();
    await sqlite.closeConnection(DB_NAME, false);
    db = null;
  }
}

// ─── Migration Runner ───────────────────────────────────────

import migration001 from './migrations/001_initial.sql?raw';

const MIGRATIONS: Array<{ id: string; sql: string }> = [
  { id: '001_initial', sql: migration001 },
];

async function runMigrations(conn: SQLiteDBConnection): Promise<void> {
  // Ensure migration tracker table exists
  await conn.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  // Get already-applied migrations
  const applied = await conn.query('SELECT id FROM _migrations;');
  const appliedIds = new Set((applied.values || []).map((r: any) => r.id));

  for (const migration of MIGRATIONS) {
    if (appliedIds.has(migration.id)) {
      console.log(`[DB] Migration ${migration.id} already applied, skipping.`);
      continue;
    }

    console.log(`[DB] Applying migration: ${migration.id}`);
    
    // Split the SQL file into individual statements and execute each
    const statements = migration.sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      await conn.run(stmt + ';');
    }

    // Record the migration
    await conn.run(
      'INSERT INTO _migrations (id, applied_at) VALUES (?, ?);',
      [migration.id, new Date().toISOString()]
    );

    console.log(`[DB] Migration ${migration.id} applied successfully.`);
  }
}
