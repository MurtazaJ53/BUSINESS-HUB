/**
 * Inventory Repository — epoch timestamps, tombstone, dirty, Database singleton
 */

import { Database } from '../sqlite';
import type { InventoryItem, InventoryPrivate } from '../../lib/types';

const now = () => Date.now();

export const inventoryRepo = {
  // ─── READ ────────────────────────────────────────────────

  async getAll(): Promise<InventoryItem[]> {
    return Database.query<InventoryItem>(
      `SELECT id, name, price, sku, category, subcategory, size, description, stock,
              created_at as createdAt
       FROM inventory WHERE tombstone = 0 ORDER BY name ASC;`,
    );
  },

  async getById(id: string): Promise<InventoryItem | null> {
    const rows = await Database.query<InventoryItem>(
      `SELECT id, name, price, sku, category, subcategory, size, description, stock,
              created_at as createdAt
       FROM inventory WHERE id = ? AND tombstone = 0;`,
      [id],
    );
    return rows[0] ?? null;
  },

  // ─── WRITE ───────────────────────────────────────────────

  async upsert(item: InventoryItem): Promise<void> {
    const ts = now();
    const ca = typeof item.createdAt === 'string' ? new Date(item.createdAt).getTime() : (item.createdAt || ts);
    await Database.run(
      `INSERT OR REPLACE INTO inventory
         (id, name, price, sku, category, subcategory, size, description, stock, created_at, updated_at, dirty, tombstone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
      [item.id, item.name, item.price, item.sku ?? null, item.category, item.subcategory ?? null,
       item.size ?? null, item.description ?? null, item.stock ?? 0, ca, ts],
    );
  },

  async updateStock(id: string, delta: number): Promise<void> {
    await Database.run(
      `UPDATE inventory SET stock = stock + ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
      [delta, now(), id],
    );
  },

  async softDelete(id: string): Promise<void> {
    await Database.run(
      `UPDATE inventory SET tombstone = 1, dirty = 1, updated_at = ? WHERE id = ?;`,
      [now(), id],
    );
  },

  async clearAll(): Promise<void> {
    await Database.run(
      `UPDATE inventory SET tombstone = 1, dirty = 1, updated_at = ?;`,
      [now()],
    );
  },

  // ─── SYNC ────────────────────────────────────────────────

  async getDirty(): Promise<Array<InventoryItem & { tombstone: number }>> {
    return Database.query(
      `SELECT id, name, price, sku, category, subcategory, size, description, stock,
              created_at as createdAt, updated_at as updatedAt, tombstone
       FROM inventory WHERE dirty = 1;`,
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const ph = ids.map(() => '?').join(',');
    await Database.run(`UPDATE inventory SET dirty = 0 WHERE id IN (${ph});`, ids);
  },

  async mergeRemote(item: InventoryItem, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updated_at: number; dirty: number }>(
      'SELECT updated_at, dirty FROM inventory WHERE id = ?;', [item.id],
    );
    const ca = typeof item.createdAt === 'string' ? new Date(item.createdAt).getTime() : (item.createdAt || remoteUpdatedAt);

    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO inventory (id, name, price, sku, category, subcategory, size, description, stock, created_at, updated_at, dirty, tombstone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        [item.id, item.name, item.price, item.sku ?? null, item.category, item.subcategory ?? null,
         item.size ?? null, item.description ?? null, item.stock ?? 0, ca, remoteUpdatedAt],
      );
    } else if (remoteUpdatedAt > existing[0].updated_at || !existing[0].dirty) {
      await Database.run(
        `UPDATE inventory SET name=?, price=?, sku=?, category=?, subcategory=?, size=?,
                description=?, stock=?, updated_at=?, dirty=0, tombstone=0
         WHERE id=?;`,
        [item.name, item.price, item.sku ?? null, item.category, item.subcategory ?? null,
         item.size ?? null, item.description ?? null, item.stock ?? 0, remoteUpdatedAt, item.id],
      );
    }
  },
};

// ─── INVENTORY PRIVATE ──────────────────────────────────────

export const inventoryPrivateRepo = {
  async getAll(): Promise<InventoryPrivate[]> {
    return Database.query<InventoryPrivate>(
      `SELECT id, cost_price as costPrice, supplier_id as supplierId,
              last_purchase_date as lastPurchaseDate
       FROM inventory_private;`,
    );
  },

  async upsert(item: InventoryPrivate): Promise<void> {
    await Database.run(
      `INSERT OR REPLACE INTO inventory_private (id, cost_price, supplier_id, last_purchase_date, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, 1);`,
      [item.id, item.costPrice, item.supplierId ?? null, item.lastPurchaseDate ?? null, now()],
    );
  },

  async mergeRemote(item: InventoryPrivate, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updated_at: number; dirty: number }>(
      'SELECT updated_at, dirty FROM inventory_private WHERE id = ?;', [item.id],
    );
    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO inventory_private (id, cost_price, supplier_id, last_purchase_date, updated_at, dirty)
         VALUES (?, ?, ?, ?, ?, 0);`,
        [item.id, item.costPrice, item.supplierId ?? null, item.lastPurchaseDate ?? null, remoteUpdatedAt],
      );
    } else if (remoteUpdatedAt > existing[0].updated_at || !existing[0].dirty) {
      await Database.run(
        `UPDATE inventory_private SET cost_price=?, supplier_id=?, last_purchase_date=?, updated_at=?, dirty=0
         WHERE id=?;`,
        [item.costPrice, item.supplierId ?? null, item.lastPurchaseDate ?? null, remoteUpdatedAt, item.id],
      );
    }
  },

  async getDirty(): Promise<Array<InventoryPrivate & { updatedAt: number }>> {
    return Database.query(
      `SELECT id, cost_price as costPrice, supplier_id as supplierId,
              last_purchase_date as lastPurchaseDate, updated_at as updatedAt
       FROM inventory_private WHERE dirty = 1;`,
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const ph = ids.map(() => '?').join(',');
    await Database.run(`UPDATE inventory_private SET dirty = 0 WHERE id IN (${ph});`, ids);
  },
};
