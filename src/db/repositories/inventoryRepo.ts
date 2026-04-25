/**
 * Inventory Repository — Standardized CamelCase Standards
 */

import { Database } from '../sqlite';
import { tableEvents } from '../events';
import type { InventoryItem, InventoryPrivate } from '../../lib/types';

const now = () => Date.now();

export const inventoryRepo = {
  // ─── READ ────────────────────────────────────────────────

  async getAll(): Promise<InventoryItem[]> {
    return Database.query<InventoryItem>(
      `SELECT id, name, price, sku, category, subcategory, size, description, stock, createdAt
       FROM inventory WHERE tombstone = 0 ORDER BY name ASC;`,
    );
  },

  async getById(id: string): Promise<InventoryItem | null> {
    const rows = await Database.query<InventoryItem>(
      `SELECT id, name, price, sku, category, subcategory, size, description, stock, createdAt
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
         (id, name, price, sku, category, subcategory, size, description, stock, createdAt, updatedAt, dirty, tombstone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
      [item.id, item.name, item.price, item.sku ?? null, item.category, item.subcategory ?? null,
       item.size ?? null, item.description ?? null, item.stock ?? 0, ca, ts],
    );
    tableEvents.emit('inventory');
  },

  async updateStock(id: string, delta: number): Promise<void> {
    await Database.run(
      `UPDATE inventory SET stock = stock + ?, updatedAt = ?, dirty = 1 WHERE id = ?;`,
      [delta, now(), id],
    );
    tableEvents.emit('inventory');
  },

  async softDelete(id: string): Promise<void> {
    await Database.run(
      `UPDATE inventory SET tombstone = 1, dirty = 1, updatedAt = ? WHERE id = ?;`,
      [now(), id],
    );
    tableEvents.emit('inventory');
  },

  async clearAll(): Promise<void> {
    await Database.run(
      `UPDATE inventory SET tombstone = 1, dirty = 1, updatedAt = ?;`,
      [now()],
    );
    tableEvents.emit('inventory');
  },

  // ─── SYNC ────────────────────────────────────────────────

  async getDirty(): Promise<Array<InventoryItem & { tombstone: number }>> {
    return Database.query(
      `SELECT id, name, price, sku, category, subcategory, size, description, stock,
              createdAt, updatedAt, tombstone
       FROM inventory WHERE dirty = 1;`,
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const ph = ids.map(() => '?').join(',');
    await Database.run(`UPDATE inventory SET dirty = 0 WHERE id IN (${ph});`, ids);
  },

  async mergeRemote(item: InventoryItem, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updatedAt: number; dirty: number }>(
      'SELECT updatedAt, dirty FROM inventory WHERE id = ?;', [item.id],
    );
    const ca = typeof item.createdAt === 'string' ? new Date(item.createdAt).getTime() : (item.createdAt || remoteUpdatedAt);

    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO inventory (id, name, price, sku, category, subcategory, size, description, stock, createdAt, updatedAt, dirty, tombstone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        [item.id, item.name, item.price, item.sku ?? null, item.category, item.subcategory ?? null,
         item.size ?? null, item.description ?? null, item.stock ?? 0, ca, remoteUpdatedAt],
      );
    } else if (remoteUpdatedAt > existing[0].updatedAt || !existing[0].dirty) {
      await Database.run(
        `UPDATE inventory SET name=?, price=?, sku=?, category=?, subcategory=?, size=?,
                description=?, stock=?, updatedAt=?, dirty=0, tombstone=0
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
      `SELECT id, costPrice, supplierId, lastPurchaseDate
       FROM inventory_private;`,
    );
  },

  async getById(id: string): Promise<InventoryPrivate | null> {
    const rows = await Database.query<InventoryPrivate>(
      `SELECT id, costPrice, supplierId, lastPurchaseDate
       FROM inventory_private WHERE id = ?;`,
      [id],
    );
    return rows[0] ?? null;
  },

  async upsert(item: InventoryPrivate): Promise<void> {
    await Database.run(
      `INSERT OR REPLACE INTO inventory_private (id, costPrice, supplierId, lastPurchaseDate, updatedAt, dirty)
       VALUES (?, ?, ?, ?, ?, 1);`,
      [item.id, item.costPrice, item.supplierId ?? null, item.lastPurchaseDate ?? null, now()],
    );
    tableEvents.emit('inventory_private');
  },

  async remove(id: string): Promise<void> {
    await Database.run(
      `UPDATE inventory_private SET tombstone = 1, updatedAt = ?, dirty = 1 WHERE id = ?;`,
      [now(), id],
    );
    tableEvents.emit('inventory_private');
  },

  async mergeRemote(item: InventoryPrivate, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updatedAt: number; dirty: number }>(
      'SELECT updatedAt, dirty FROM inventory_private WHERE id = ?;', [item.id],
    );
    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO inventory_private (id, costPrice, supplierId, lastPurchaseDate, updatedAt, dirty)
         VALUES (?, ?, ?, ?, ?, 0);`,
        [item.id, item.costPrice, item.supplierId ?? null, item.lastPurchaseDate ?? null, remoteUpdatedAt],
      );
    } else if (remoteUpdatedAt > existing[0].updatedAt || !existing[0].dirty) {
      await Database.run(
        `UPDATE inventory_private SET costPrice=?, supplierId=?, lastPurchaseDate=?, updatedAt=?, dirty=0
         WHERE id=?;`,
        [item.costPrice, item.supplierId ?? null, item.lastPurchaseDate ?? null, remoteUpdatedAt, item.id],
      );
    }
  },

  async getDirty(): Promise<Array<InventoryPrivate & { updatedAt: number }>> {
    return Database.query(
      `SELECT id, costPrice, supplierId, lastPurchaseDate, updatedAt
       FROM inventory_private WHERE dirty = 1;`,
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const ph = ids.map(() => '?').join(',');
    await Database.run(`UPDATE inventory_private SET dirty = 0 WHERE id IN (${ph});`, ids);
  },
};
