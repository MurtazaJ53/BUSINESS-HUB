/**
 * Inventory Repository — Local SQLite CRUD with sync metadata
 */

import { execQuery, execRun, execTransaction } from '../connection';
import type { InventoryItem, InventoryPrivate } from '../../lib/types';

const now = () => new Date().toISOString();

export const inventoryRepo = {
  // ─── READ ────────────────────────────────────────────────

  async getAll(): Promise<InventoryItem[]> {
    return execQuery<InventoryItem>(
      `SELECT id, name, price, sku, category, subcategory, size, description, stock,
              created_at as createdAt
       FROM inventory WHERE is_deleted = 0 ORDER BY name ASC;`
    );
  },

  async getById(id: string): Promise<InventoryItem | null> {
    const rows = await execQuery<InventoryItem>(
      `SELECT id, name, price, sku, category, subcategory, size, description, stock,
              created_at as createdAt
       FROM inventory WHERE id = ? AND is_deleted = 0;`,
      [id]
    );
    return rows[0] ?? null;
  },

  // ─── WRITE ───────────────────────────────────────────────

  async upsert(item: InventoryItem): Promise<void> {
    const ts = now();
    await execRun(
      `INSERT OR REPLACE INTO inventory (id, name, price, sku, category, subcategory, size, description, stock, created_at, updated_at, is_dirty, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
      [item.id, item.name, item.price, item.sku ?? null, item.category, item.subcategory ?? null,
       item.size ?? null, item.description ?? null, item.stock ?? 0, item.createdAt, ts]
    );
  },

  async updateStock(id: string, delta: number): Promise<void> {
    const ts = now();
    await execRun(
      `UPDATE inventory SET stock = stock + ?, updated_at = ?, is_dirty = 1 WHERE id = ?;`,
      [delta, ts, id]
    );
  },

  async softDelete(id: string): Promise<void> {
    const ts = now();
    await execRun(
      `UPDATE inventory SET is_deleted = 1, is_dirty = 1, updated_at = ? WHERE id = ?;`,
      [ts, id]
    );
  },

  async clearAll(): Promise<void> {
    const ts = now();
    await execRun(
      `UPDATE inventory SET is_deleted = 1, is_dirty = 1, updated_at = ?;`,
      [ts]
    );
  },

  // ─── SYNC HELPERS ────────────────────────────────────────

  async getDirty(): Promise<Array<InventoryItem & { isDeleted: boolean }>> {
    return execQuery(
      `SELECT id, name, price, sku, category, subcategory, size, description, stock,
              created_at as createdAt, updated_at as updatedAt, is_deleted as isDeleted
       FROM inventory WHERE is_dirty = 1;`
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await execRun(
      `UPDATE inventory SET is_dirty = 0 WHERE id IN (${placeholders});`,
      ids
    );
  },

  /**
   * Merge a remote record using Last-Write-Wins.
   * Only overwrites if remote is newer or local is not dirty.
   */
  async mergeRemote(item: InventoryItem, remoteUpdatedAt: string): Promise<void> {
    const existing = await execQuery<{ updatedAt: string; isDirty: number }>(
      'SELECT updated_at as updatedAt, is_dirty as isDirty FROM inventory WHERE id = ?;',
      [item.id]
    );

    if (existing.length === 0) {
      // New record from remote — insert
      await execRun(
        `INSERT INTO inventory (id, name, price, sku, category, subcategory, size, description, stock, created_at, updated_at, is_dirty, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        [item.id, item.name, item.price, item.sku ?? null, item.category, item.subcategory ?? null,
         item.size ?? null, item.description ?? null, item.stock ?? 0, item.createdAt, remoteUpdatedAt]
      );
    } else {
      const local = existing[0];
      // LWW: Only overwrite if remote is newer OR local is clean
      if (remoteUpdatedAt > local.updatedAt || !local.isDirty) {
        await execRun(
          `UPDATE inventory SET name = ?, price = ?, sku = ?, category = ?, subcategory = ?, size = ?,
                  description = ?, stock = ?, updated_at = ?, is_dirty = 0, is_deleted = 0
           WHERE id = ?;`,
          [item.name, item.price, item.sku ?? null, item.category, item.subcategory ?? null,
           item.size ?? null, item.description ?? null, item.stock ?? 0, remoteUpdatedAt, item.id]
        );
      }
    }
  },
};

// ─── INVENTORY PRIVATE REPO ─────────────────────────────────

export const inventoryPrivateRepo = {
  async getAll(): Promise<InventoryPrivate[]> {
    return execQuery<InventoryPrivate>(
      `SELECT id, cost_price as costPrice, supplier_id as supplierId, last_purchase_date as lastPurchaseDate
       FROM inventory_private;`
    );
  },

  async upsert(item: InventoryPrivate): Promise<void> {
    const ts = now();
    await execRun(
      `INSERT OR REPLACE INTO inventory_private (id, cost_price, supplier_id, last_purchase_date, updated_at, is_dirty)
       VALUES (?, ?, ?, ?, ?, 1);`,
      [item.id, item.costPrice, item.supplierId ?? null, item.lastPurchaseDate ?? null, ts]
    );
  },

  async mergeRemote(item: InventoryPrivate, remoteUpdatedAt: string): Promise<void> {
    const existing = await execQuery<{ updatedAt: string; isDirty: number }>(
      'SELECT updated_at as updatedAt, is_dirty as isDirty FROM inventory_private WHERE id = ?;',
      [item.id]
    );

    if (existing.length === 0) {
      await execRun(
        `INSERT INTO inventory_private (id, cost_price, supplier_id, last_purchase_date, updated_at, is_dirty)
         VALUES (?, ?, ?, ?, ?, 0);`,
        [item.id, item.costPrice, item.supplierId ?? null, item.lastPurchaseDate ?? null, remoteUpdatedAt]
      );
    } else {
      const local = existing[0];
      if (remoteUpdatedAt > local.updatedAt || !local.isDirty) {
        await execRun(
          `UPDATE inventory_private SET cost_price = ?, supplier_id = ?, last_purchase_date = ?, updated_at = ?, is_dirty = 0
           WHERE id = ?;`,
          [item.costPrice, item.supplierId ?? null, item.lastPurchaseDate ?? null, remoteUpdatedAt, item.id]
        );
      }
    }
  },

  async getDirty(): Promise<Array<InventoryPrivate & { updatedAt: string }>> {
    return execQuery(
      `SELECT id, cost_price as costPrice, supplier_id as supplierId, last_purchase_date as lastPurchaseDate,
              updated_at as updatedAt
       FROM inventory_private WHERE is_dirty = 1;`
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await execRun(
      `UPDATE inventory_private SET is_dirty = 0 WHERE id IN (${placeholders});`,
      ids
    );
  },
};
