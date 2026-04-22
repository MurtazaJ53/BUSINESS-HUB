/**
 * Database Module — Barrel Export
 * 
 * Single import point for all database operations.
 */

export { initDatabase, getDb, execQuery, execRun, execTransaction, saveToStore, closeDatabase } from './connection';
export { inventoryRepo, inventoryPrivateRepo } from './repositories/inventoryRepo';
export { salesRepo } from './repositories/salesRepo';
export { customersRepo, customerPaymentsRepo } from './repositories/customersRepo';
export { expensesRepo } from './repositories/expensesRepo';
export { staffRepo, staffPrivateRepo, attendanceRepo } from './repositories/staffRepo';
export { outboxRepo } from './repositories/outboxRepo';
export { startSync, stopSync, getSyncStatus, onSyncStatusChange, onDataChange } from './syncEngine';
export type { SyncStatus } from './syncEngine';
