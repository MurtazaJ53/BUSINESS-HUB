/**
 * Inventory Repository
 */

import { Database } from '../sqlite';
import { tableEvents } from '../events';
import type { InventoryItem, InventoryPrivate } from '../../lib/types';

const now = () => Date.now();

export interface InventoryMetrics {
  totalItems: number;
  totalStock: number;
  inventoryValue: number;
  potentialProfit: number;
  lowStock: number;
}

export interface InventoryCategorySummary {
  category: string;
  productCount: number;
}

export interface InventoryProductSummary {
  name: string;
  variantCount: number;
  totalStock: number;
  totalCost: number;
  totalValue: number;
}

type InventoryPageRow = InventoryItem & { costPrice?: number };

const parseSourceMeta = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return typeof value === 'object' ? (value as Record<string, unknown>) : null;
};

const serializeSourceMeta = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

const mapInventoryRows = (rows: Array<Record<string, unknown>>): InventoryPageRow[] =>
  rows.map((row) => ({
    ...row,
    sourceMeta: parseSourceMeta(row.sourceMeta),
  })) as InventoryPageRow[];

export const inventoryRepo = {
  async getAll(): Promise<InventoryItem[]> {
    const rows = await Database.query<Record<string, unknown>>(
      `SELECT id, name, price, sku, category, subcategory, size, description, stock, sourceMeta, createdAt
       FROM inventory
       WHERE tombstone = 0
       ORDER BY name ASC;`,
    );
    return mapInventoryRows(rows);
  },

  async getMetrics(includeCost: boolean = false): Promise<InventoryMetrics> {
    const rows = await Database.query<InventoryMetrics>(
      includeCost
        ? `SELECT COUNT(*) AS totalItems,
                  COALESCE(SUM(i.stock), 0) AS totalStock,
                  COALESCE(SUM(i.price * i.stock), 0) AS inventoryValue,
                  COALESCE(SUM((i.price - COALESCE(ip.costPrice, 0)) * i.stock), 0) AS potentialProfit,
                  COALESCE(SUM(CASE WHEN i.stock <= 5 THEN 1 ELSE 0 END), 0) AS lowStock
           FROM inventory i
           LEFT JOIN inventory_private ip ON ip.id = i.id AND ip.tombstone = 0
           WHERE i.tombstone = 0;`
        : `SELECT COUNT(*) AS totalItems,
                  COALESCE(SUM(stock), 0) AS totalStock,
                  COALESCE(SUM(price * stock), 0) AS inventoryValue,
                  0 AS potentialProfit,
                  COALESCE(SUM(CASE WHEN stock <= 5 THEN 1 ELSE 0 END), 0) AS lowStock
           FROM inventory
           WHERE tombstone = 0;`,
    );
    return rows[0] ?? { totalItems: 0, totalStock: 0, inventoryValue: 0, potentialProfit: 0, lowStock: 0 };
  },

  async getCategoryPage(search: string = '', page: number = 1, pageSize: number = 24): Promise<InventoryCategorySummary[]> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(pageSize, 200));
    const offset = (safePage - 1) * safePageSize;
    const normalizedSearch = search.trim().toLowerCase();
    const params: Array<string | number> = [];
    let whereClause = 'WHERE tombstone = 0';

    if (normalizedSearch) {
      whereClause += ' AND LOWER(COALESCE(category, \'General\')) LIKE ?';
      params.push(`%${normalizedSearch}%`);
    }

    return Database.query<InventoryCategorySummary>(
      `SELECT COALESCE(category, 'General') AS category,
              COUNT(DISTINCT name) AS productCount
       FROM inventory
       ${whereClause}
       GROUP BY COALESCE(category, 'General')
       ORDER BY category ASC
       LIMIT ? OFFSET ?;`,
      [...params, safePageSize, offset],
    );
  },

  async getCategoryCount(search: string = ''): Promise<number> {
    const normalizedSearch = search.trim().toLowerCase();
    const params: Array<string | number> = [];
    let whereClause = 'WHERE tombstone = 0';

    if (normalizedSearch) {
      whereClause += ' AND LOWER(COALESCE(category, \'General\')) LIKE ?';
      params.push(`%${normalizedSearch}%`);
    }

    const rows = await Database.query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM (
         SELECT 1
         FROM inventory
         ${whereClause}
         GROUP BY COALESCE(category, 'General')
       ) grouped;`,
      params,
    );
    return Number(rows[0]?.total || 0);
  },

  async getProductPage(
    category: string,
    search: string = '',
    page: number = 1,
    pageSize: number = 24,
    includeCost: boolean = false,
  ): Promise<InventoryProductSummary[]> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(pageSize, 200));
    const offset = (safePage - 1) * safePageSize;
    const normalizedSearch = search.trim().toLowerCase();
    const params: Array<string | number> = [category];
    let extraWhere = '';

    if (normalizedSearch) {
      extraWhere = ' AND LOWER(i.name) LIKE ?';
      params.push(`%${normalizedSearch}%`);
    }

    return Database.query<InventoryProductSummary>(
      includeCost
        ? `SELECT i.name AS name,
                  COUNT(*) AS variantCount,
                  COALESCE(SUM(i.stock), 0) AS totalStock,
                  COALESCE(SUM(COALESCE(ip.costPrice, 0) * i.stock), 0) AS totalCost,
                  COALESCE(SUM(i.price * i.stock), 0) AS totalValue
           FROM inventory i
           LEFT JOIN inventory_private ip ON ip.id = i.id AND ip.tombstone = 0
           WHERE i.tombstone = 0
             AND COALESCE(i.category, 'General') = ?
             ${extraWhere}
           GROUP BY i.name
           ORDER BY i.name ASC
           LIMIT ? OFFSET ?;`
        : `SELECT i.name AS name,
                  COUNT(*) AS variantCount,
                  COALESCE(SUM(i.stock), 0) AS totalStock,
                  0 AS totalCost,
                  COALESCE(SUM(i.price * i.stock), 0) AS totalValue
           FROM inventory i
           WHERE i.tombstone = 0
             AND COALESCE(i.category, 'General') = ?
             ${extraWhere}
           GROUP BY i.name
           ORDER BY i.name ASC
           LIMIT ? OFFSET ?;`,
      [...params, safePageSize, offset],
    );
  },

  async getProductCount(category: string, search: string = ''): Promise<number> {
    const normalizedSearch = search.trim().toLowerCase();
    const params: Array<string | number> = [category];
    let extraWhere = '';

    if (normalizedSearch) {
      extraWhere = ' AND LOWER(name) LIKE ?';
      params.push(`%${normalizedSearch}%`);
    }

    const rows = await Database.query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM (
         SELECT 1
         FROM inventory
         WHERE tombstone = 0
           AND COALESCE(category, 'General') = ?
           ${extraWhere}
         GROUP BY name
       ) grouped;`,
      params,
    );
    return Number(rows[0]?.total || 0);
  },

  async getVariantPage(
    category: string,
    name: string,
    search: string = '',
    page: number = 1,
    pageSize: number = 24,
    includeCost: boolean = false,
  ): Promise<InventoryPageRow[]> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(pageSize, 200));
    const offset = (safePage - 1) * safePageSize;
    const normalizedSearch = search.trim().toLowerCase();
    const params: Array<string | number> = [category, name];
    let extraWhere = '';

    if (normalizedSearch) {
      extraWhere = ` AND (
        LOWER(i.name) LIKE ?
        OR LOWER(COALESCE(i.sku, '')) LIKE ?
        OR LOWER(COALESCE(i.size, '')) LIKE ?
      )`;
      params.push(`%${normalizedSearch}%`, `%${normalizedSearch}%`, `%${normalizedSearch}%`);
    }

    const rows = await Database.query<Record<string, unknown>>(
      includeCost
        ? `SELECT i.id, i.name, i.price, i.sku, i.category, i.subcategory, i.size, i.description,
                  i.stock, i.sourceMeta, i.createdAt, ip.costPrice
           FROM inventory i
           LEFT JOIN inventory_private ip ON ip.id = i.id AND ip.tombstone = 0
           WHERE i.tombstone = 0
             AND COALESCE(i.category, 'General') = ?
             AND i.name = ?
             ${extraWhere}
           ORDER BY COALESCE(i.size, ''), COALESCE(i.subcategory, ''), i.createdAt DESC
           LIMIT ? OFFSET ?;`
        : `SELECT i.id, i.name, i.price, i.sku, i.category, i.subcategory, i.size, i.description,
                  i.stock, i.sourceMeta, i.createdAt
           FROM inventory i
           WHERE i.tombstone = 0
             AND COALESCE(i.category, 'General') = ?
             AND i.name = ?
             ${extraWhere}
           ORDER BY COALESCE(i.size, ''), COALESCE(i.subcategory, ''), i.createdAt DESC
           LIMIT ? OFFSET ?;`,
      [...params, safePageSize, offset],
    );
    return mapInventoryRows(rows);
  },

  async getVariantCount(category: string, name: string, search: string = ''): Promise<number> {
    const normalizedSearch = search.trim().toLowerCase();
    const params: Array<string | number> = [category, name];
    let extraWhere = '';

    if (normalizedSearch) {
      extraWhere = ` AND (
        LOWER(name) LIKE ?
        OR LOWER(COALESCE(sku, '')) LIKE ?
        OR LOWER(COALESCE(size, '')) LIKE ?
      )`;
      params.push(`%${normalizedSearch}%`, `%${normalizedSearch}%`, `%${normalizedSearch}%`);
    }

    const rows = await Database.query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM inventory
       WHERE tombstone = 0
         AND COALESCE(category, 'General') = ?
         AND name = ?
         ${extraWhere};`,
      params,
    );
    return Number(rows[0]?.total || 0);
  },

  async searchPage(search: string, page: number = 1, pageSize: number = 24, includeCost: boolean = false): Promise<InventoryPageRow[]> {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return [];

    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(pageSize, 200));
    const offset = (safePage - 1) * safePageSize;
    const like = `%${normalizedSearch}%`;
    const rows = await Database.query<Record<string, unknown>>(
      includeCost
        ? `SELECT i.id, i.name, i.price, i.sku, i.category, i.subcategory, i.size, i.description,
                  i.stock, i.sourceMeta, i.createdAt, ip.costPrice
           FROM inventory i
           LEFT JOIN inventory_private ip ON ip.id = i.id AND ip.tombstone = 0
           WHERE i.tombstone = 0
             AND (
               LOWER(i.name) LIKE ?
               OR LOWER(COALESCE(i.sku, '')) LIKE ?
               OR LOWER(COALESCE(i.category, '')) LIKE ?
               OR LOWER(COALESCE(i.subcategory, '')) LIKE ?
             )
           ORDER BY i.name ASC
           LIMIT ? OFFSET ?;`
        : `SELECT i.id, i.name, i.price, i.sku, i.category, i.subcategory, i.size, i.description,
                  i.stock, i.sourceMeta, i.createdAt
           FROM inventory i
           WHERE i.tombstone = 0
             AND (
               LOWER(i.name) LIKE ?
               OR LOWER(COALESCE(i.sku, '')) LIKE ?
               OR LOWER(COALESCE(i.category, '')) LIKE ?
               OR LOWER(COALESCE(i.subcategory, '')) LIKE ?
             )
           ORDER BY i.name ASC
           LIMIT ? OFFSET ?;`,
      [like, like, like, like, safePageSize, offset],
    );
    return mapInventoryRows(rows);
  },

  async searchCount(search: string): Promise<number> {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return 0;

    const like = `%${normalizedSearch}%`;
    const rows = await Database.query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM inventory
       WHERE tombstone = 0
         AND (
           LOWER(name) LIKE ?
           OR LOWER(COALESCE(sku, '')) LIKE ?
           OR LOWER(COALESCE(category, '')) LIKE ?
           OR LOWER(COALESCE(subcategory, '')) LIKE ?
         );`,
      [like, like, like, like],
    );
    return Number(rows[0]?.total || 0);
  },

  async getById(id: string): Promise<InventoryItem | null> {
    const rows = await Database.query<Record<string, unknown>>(
      `SELECT id, name, price, sku, category, subcategory, size, description, stock, sourceMeta, createdAt
       FROM inventory
       WHERE id = ? AND tombstone = 0;`,
      [id],
    );
    return rows[0] ? mapInventoryRows([rows[0]])[0] : null;
  },

  async getByIds(ids: string[], includeCost: boolean = false): Promise<InventoryPageRow[]> {
    if (!ids.length) return [];

    const placeholders = ids.map(() => '?').join(',');
    const rows = await Database.query<Record<string, unknown>>(
      includeCost
        ? `SELECT i.id, i.name, i.price, i.sku, i.category, i.subcategory, i.size, i.description,
                  i.stock, i.sourceMeta, i.createdAt, ip.costPrice
           FROM inventory i
           LEFT JOIN inventory_private ip ON ip.id = i.id AND ip.tombstone = 0
           WHERE i.tombstone = 0 AND i.id IN (${placeholders});`
        : `SELECT id, name, price, sku, category, subcategory, size, description, stock, sourceMeta, createdAt
           FROM inventory
           WHERE tombstone = 0 AND id IN (${placeholders});`,
      ids,
    );
    return mapInventoryRows(rows);
  },

  async findBySkuOrId(identifier: string, includeCost: boolean = false): Promise<InventoryPageRow | null> {
    const value = identifier.trim();
    if (!value) return null;

    const rows = await Database.query<Record<string, unknown>>(
      includeCost
        ? `SELECT i.id, i.name, i.price, i.sku, i.category, i.subcategory, i.size, i.description,
                  i.stock, i.sourceMeta, i.createdAt, ip.costPrice
           FROM inventory i
           LEFT JOIN inventory_private ip ON ip.id = i.id AND ip.tombstone = 0
           WHERE i.tombstone = 0
             AND (i.id = ? OR COALESCE(i.sku, '') = ?)
           ORDER BY CASE WHEN COALESCE(i.sku, '') = ? THEN 0 ELSE 1 END
           LIMIT 1;`
        : `SELECT i.id, i.name, i.price, i.sku, i.category, i.subcategory, i.size, i.description,
                  i.stock, i.sourceMeta, i.createdAt
           FROM inventory i
           WHERE i.tombstone = 0
             AND (i.id = ? OR COALESCE(i.sku, '') = ?)
           ORDER BY CASE WHEN COALESCE(i.sku, '') = ? THEN 0 ELSE 1 END
           LIMIT 1;`,
      [value, value, value],
    );

    return rows[0] ? mapInventoryRows([rows[0]])[0] : null;
  },

  async getLatestPage(limit: number = 10, includeCost: boolean = false): Promise<InventoryPageRow[]> {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const rows = await Database.query<Record<string, unknown>>(
      includeCost
        ? `SELECT i.id, i.name, i.price, i.sku, i.category, i.subcategory, i.size, i.description,
                  i.stock, i.sourceMeta, i.createdAt, ip.costPrice
           FROM inventory i
           LEFT JOIN inventory_private ip ON ip.id = i.id AND ip.tombstone = 0
           WHERE i.tombstone = 0
           ORDER BY i.createdAt DESC, i.name ASC
           LIMIT ?;`
        : `SELECT i.id, i.name, i.price, i.sku, i.category, i.subcategory, i.size, i.description,
                  i.stock, i.sourceMeta, i.createdAt
           FROM inventory i
           WHERE i.tombstone = 0
           ORDER BY i.createdAt DESC, i.name ASC
           LIMIT ?;`,
      [safeLimit],
    );
    return mapInventoryRows(rows);
  },

  async upsert(item: InventoryItem): Promise<void> {
    const ts = now();
    const createdAt = typeof item.createdAt === 'string' ? new Date(item.createdAt).getTime() : (item.createdAt || ts);
    await Database.run(
      `INSERT OR REPLACE INTO inventory
         (id, name, price, sku, category, subcategory, size, description, stock, sourceMeta, createdAt, updatedAt, dirty, tombstone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
      [
        item.id,
        item.name,
        item.price,
        item.sku ?? null,
        item.category,
        item.subcategory ?? null,
        item.size ?? null,
        item.description ?? null,
        item.stock ?? 0,
        serializeSourceMeta(item.sourceMeta),
        createdAt,
        ts,
      ],
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

  async getDirty(): Promise<Array<InventoryItem & { tombstone: number }>> {
    const rows = await Database.query<Record<string, unknown>>(
      `SELECT id, name, price, sku, category, subcategory, size, description, stock,
              sourceMeta, createdAt, updatedAt, tombstone
       FROM inventory
       WHERE dirty = 1;`,
    );
    return mapInventoryRows(rows) as Array<InventoryItem & { tombstone: number }>;
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(',');
    await Database.run(`UPDATE inventory SET dirty = 0 WHERE id IN (${placeholders});`, ids);
  },

  async mergeRemote(item: InventoryItem, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updatedAt: number; dirty: number }>(
      `SELECT updatedAt, dirty FROM inventory WHERE id = ?;`,
      [item.id],
    );
    const createdAt = typeof item.createdAt === 'string' ? new Date(item.createdAt).getTime() : (item.createdAt || remoteUpdatedAt);

    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO inventory (id, name, price, sku, category, subcategory, size, description, stock, sourceMeta, createdAt, updatedAt, dirty, tombstone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        [
          item.id,
          item.name,
          item.price,
          item.sku ?? null,
          item.category,
          item.subcategory ?? null,
          item.size ?? null,
          item.description ?? null,
          item.stock ?? 0,
          serializeSourceMeta(item.sourceMeta),
          createdAt,
          remoteUpdatedAt,
        ],
      );
    } else if (remoteUpdatedAt > existing[0].updatedAt || !existing[0].dirty) {
      await Database.run(
        `UPDATE inventory
         SET name = ?, price = ?, sku = ?, category = ?, subcategory = ?, size = ?,
             description = ?, stock = ?, sourceMeta = ?, updatedAt = ?, dirty = 0, tombstone = 0
         WHERE id = ?;`,
        [
          item.name,
          item.price,
          item.sku ?? null,
          item.category,
          item.subcategory ?? null,
          item.size ?? null,
          item.description ?? null,
          item.stock ?? 0,
          serializeSourceMeta(item.sourceMeta),
          remoteUpdatedAt,
          item.id,
        ],
      );
    }
  },
};

export const inventoryPrivateRepo = {
  async getAll(): Promise<InventoryPrivate[]> {
    return Database.query<InventoryPrivate>(
      `SELECT id, costPrice, supplierId, lastPurchaseDate
       FROM inventory_private
       WHERE tombstone = 0;`,
    );
  },

  async getById(id: string): Promise<InventoryPrivate | null> {
    const rows = await Database.query<InventoryPrivate>(
      `SELECT id, costPrice, supplierId, lastPurchaseDate
       FROM inventory_private
       WHERE id = ? AND tombstone = 0;`,
      [id],
    );
    return rows[0] ?? null;
  },

  async getByIds(ids: string[]): Promise<InventoryPrivate[]> {
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    return Database.query<InventoryPrivate>(
      `SELECT id, costPrice, supplierId, lastPurchaseDate
       FROM inventory_private
       WHERE tombstone = 0 AND id IN (${placeholders});`,
      ids,
    );
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
      `SELECT updatedAt, dirty FROM inventory_private WHERE id = ?;`,
      [item.id],
    );
    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO inventory_private (id, costPrice, supplierId, lastPurchaseDate, updatedAt, dirty, tombstone)
         VALUES (?, ?, ?, ?, ?, 0, 0);`,
        [item.id, item.costPrice, item.supplierId ?? null, item.lastPurchaseDate ?? null, remoteUpdatedAt],
      );
    } else if (remoteUpdatedAt > existing[0].updatedAt || !existing[0].dirty) {
      await Database.run(
        `UPDATE inventory_private
         SET costPrice = ?, supplierId = ?, lastPurchaseDate = ?, updatedAt = ?, dirty = 0, tombstone = 0
         WHERE id = ?;`,
        [item.costPrice, item.supplierId ?? null, item.lastPurchaseDate ?? null, remoteUpdatedAt, item.id],
      );
    }
  },

  async getDirty(): Promise<Array<InventoryPrivate & { updatedAt: number }>> {
    return Database.query<Array<InventoryPrivate & { updatedAt: number }>[number]>(
      `SELECT id, costPrice, supplierId, lastPurchaseDate, updatedAt
       FROM inventory_private
       WHERE dirty = 1;`,
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(',');
    await Database.run(`UPDATE inventory_private SET dirty = 0 WHERE id IN (${placeholders});`, ids);
  },
};
