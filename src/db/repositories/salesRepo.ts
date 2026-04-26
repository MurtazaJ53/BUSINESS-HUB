/**
 * Sales Repository — Standardized CamelCase Standards
 */

import { Database } from '../sqlite';
import { tableEvents } from '../events';
import type { Sale, SaleItem } from '../../lib/types';

const now = () => Date.now();
type PaymentMode = Sale['paymentMode'];

export interface SalesRangeFilters {
  dateFrom?: string;
  dateTo?: string;
}

export interface SalesHistoryFilters extends SalesRangeFilters {
  search?: string;
}

export interface SaleHistorySummary {
  id: string;
  total: number;
  discount: number;
  discountValue: number;
  discountType: 'fixed' | 'percent';
  paymentMode: PaymentMode;
  customerName?: string | null;
  customerPhone?: string | null;
  customerId?: string | null;
  footerNote?: string | null;
  sourceMeta?: Record<string, unknown> | null;
  date: string;
  createdAt: number | string;
  staffId?: string | null;
  itemQuantity: number;
  paymentCount: number;
}

export interface SalesHistoryMetrics {
  totalCount: number;
  totalAmount: number;
}

export interface DailySalesSeriesPoint {
  date: string;
  total: number;
  orderCount: number;
}

export interface ItemVelocityPoint {
  itemId: string;
  quantity: number;
}

const parseSourceMeta = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return typeof value === 'object' ? value as Record<string, unknown> : null;
};
const serializeSourceMeta = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return null; }
};

const buildSalesWhereClause = (
  filters: SalesHistoryFilters = {},
): { clause: string; params: Array<string | number> } => {
  const conditions = ['s.tombstone = 0'];
  const params: Array<string | number> = [];

  if (filters.search?.trim()) {
    const like = `%${filters.search.trim().toLowerCase()}%`;
    conditions.push('(LOWER(s.id) LIKE ? OR LOWER(COALESCE(s.customerName, \'\')) LIKE ?)');
    params.push(like, like);
  }

  if (filters.dateFrom) {
    conditions.push('s.date >= ?');
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push('s.date <= ?');
    params.push(filters.dateTo);
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
};

const buildRangeClause = (
  filters: SalesRangeFilters = {},
): { clause: string; params: Array<string | number> } => {
  const conditions = ['tombstone = 0'];
  const params: Array<string | number> = [];

  if (filters.dateFrom) {
    conditions.push('date >= ?');
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push('date <= ?');
    params.push(filters.dateTo);
  }

  return {
    clause: `WHERE ${conditions.join(' AND ')}`,
    params,
  };
};

const hydrateSalesRows = async (rows: any[]): Promise<Sale[]> => {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const ph = ids.map(() => '?').join(',');

  const [items, payments] = await Promise.all([
    Database.query<(SaleItem & { saleId: string })>(
      `SELECT saleId, itemId, name, quantity, price, costPrice, size, isReturn
       FROM sale_items
       WHERE saleId IN (${ph});`,
      ids,
    ),
    Database.query<{ saleId: string; mode: string; amount: number }>(
      `SELECT saleId, mode, amount
       FROM sale_payments
       WHERE saleId IN (${ph});`,
      ids,
    ),
  ]);

  const itemMap = new Map<string, SaleItem[]>();
  items.forEach(({ saleId, ...item }) => {
    const bucket = itemMap.get(saleId) ?? [];
    bucket.push(item);
    itemMap.set(saleId, bucket);
  });

  const paymentMap = new Map<string, Array<{ mode: string; amount: number }>>();
  payments.forEach(({ saleId, ...payment }) => {
    const bucket = paymentMap.get(saleId) ?? [];
    bucket.push(payment);
    paymentMap.set(saleId, bucket);
  });

  return rows.map((row) => ({
    ...row,
    sourceMeta: parseSourceMeta(row.sourceMeta),
    items: itemMap.get(row.id) ?? [],
    payments: paymentMap.get(row.id) ?? [],
  }));
};

const buildUpsertStatements = (sale: Sale, updatedAt: number, dirty: 0 | 1): Array<{ sql: string; params?: any[] }> => {
  const createdAt = typeof sale.createdAt === 'string' ? new Date(sale.createdAt).getTime() : (sale.createdAt || updatedAt);
  const stmts: Array<{ sql: string; params?: any[] }> = [];

  stmts.push({
    sql: `INSERT OR REPLACE INTO sales
            (id, total, discount, discountValue, discountType, paymentMode,
             customerName, customerPhone, customerId, footerNote, sourceMeta, date,
             createdAt, updatedAt, staffId, dirty, tombstone)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);`,
    params: [sale.id, sale.total, sale.discount, sale.discountValue, sale.discountType,
             sale.paymentMode, sale.customerName ?? null, sale.customerPhone ?? null,
             sale.customerId ?? null, sale.footerNote ?? null, serializeSourceMeta(sale.sourceMeta), sale.date, createdAt, updatedAt, sale.staffId ?? null, dirty],
  });

  stmts.push({ sql: 'DELETE FROM sale_items WHERE saleId = ?;', params: [sale.id] });
  sale.items.forEach((item, idx) => {
    stmts.push({
      sql: `INSERT INTO sale_items (id, saleId, itemId, name, quantity, price, costPrice, size, isReturn)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      params: [`${sale.id}_${item.itemId}_${idx}`, sale.id, item.itemId, item.name,
               item.quantity, item.price, item.costPrice ?? null, item.size ?? null,
               item.isReturn ? 1 : 0],
    });
  });

  stmts.push({ sql: 'DELETE FROM sale_payments WHERE saleId = ?;', params: [sale.id] });
  sale.payments.forEach((pmt, idx) => {
    stmts.push({
      sql: `INSERT INTO sale_payments (id, saleId, mode, amount) VALUES (?, ?, ?, ?);`,
      params: [`${sale.id}_${pmt.mode}_${idx}`, sale.id, pmt.mode, pmt.amount],
    });
  });

  return stmts;
};

export const salesRepo = {
  async getAll(limitCount?: number): Promise<Sale[]> {
    const rows = await Database.query<any>(
      limitCount
        ? `SELECT id, total, discount, discountValue, discountType,
                  paymentMode, customerName, customerPhone,
                  customerId, footerNote, sourceMeta, date, createdAt, staffId
           FROM sales WHERE tombstone = 0 ORDER BY createdAt DESC LIMIT ?;`
        : `SELECT id, total, discount, discountValue, discountType,
                  paymentMode, customerName, customerPhone,
                  customerId, footerNote, sourceMeta, date, createdAt, staffId
           FROM sales WHERE tombstone = 0 ORDER BY createdAt DESC;`,
      limitCount ? [limitCount] : [],
    );
    return hydrateSalesRows(rows);
  },

  async getRange(filters: SalesRangeFilters = {}): Promise<Sale[]> {
    const { clause, params } = buildRangeClause(filters);
    const rows = await Database.query<any>(
      `SELECT id, total, discount, discountValue, discountType,
              paymentMode, customerName, customerPhone,
              customerId, footerNote, sourceMeta, date, createdAt, staffId
       FROM sales
       ${clause}
       ORDER BY date DESC, createdAt DESC;`,
      params,
    );
    return hydrateSalesRows(rows);
  },

  async getById(id: string): Promise<Sale | null> {
    const rows = await Database.query<any>(
      `SELECT id, total, discount, discountValue, discountType,
              paymentMode, customerName, customerPhone,
              customerId, footerNote, sourceMeta, date, createdAt, staffId
       FROM sales WHERE id = ? AND tombstone = 0;`, [id],
    );
    if (!rows.length) return null;
    const items = await Database.query<SaleItem>(
      `SELECT itemId, name, quantity, price, costPrice, size, isReturn
       FROM sale_items WHERE saleId = ?;`, [id],
    );
    const payments = await Database.query<{ mode: string; amount: number }>(
      `SELECT mode, amount FROM sale_payments WHERE saleId = ?;`, [id],
    );
    return { ...rows[0], sourceMeta: parseSourceMeta(rows[0].sourceMeta), items, payments };
  },

  async getByCustomerId(customerId: string): Promise<Sale[]> {
    const rows = await Database.query<any>(
      `SELECT id, total, discount, discountValue, discountType,
              paymentMode, customerName, customerPhone,
              customerId, footerNote, sourceMeta, date, createdAt, staffId
       FROM sales
       WHERE customerId = ? AND tombstone = 0
       ORDER BY date DESC, createdAt DESC;`,
      [customerId],
    );
    return hydrateSalesRows(rows);
  },

  async getHistoryPage(
    filters: SalesHistoryFilters = {},
    page: number = 1,
    pageSize: number = 100,
  ): Promise<SaleHistorySummary[]> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(pageSize, 500));
    const offset = (safePage - 1) * safePageSize;
    const { clause, params } = buildSalesWhereClause(filters);
    const rows = await Database.query<any>(
      `SELECT s.id,
              s.total,
              s.discount,
              s.discountValue,
              s.discountType,
              s.paymentMode,
              s.customerName,
              s.customerPhone,
              s.customerId,
              s.footerNote,
              s.sourceMeta,
              s.date,
              s.createdAt,
              s.staffId,
              COALESCE((
                SELECT SUM(si.quantity)
                FROM sale_items si
                WHERE si.saleId = s.id
              ), 0) AS itemQuantity,
              COALESCE((
                SELECT COUNT(*)
                FROM sale_payments sp
                WHERE sp.saleId = s.id
              ), 0) AS paymentCount
       FROM sales s
       ${clause}
       ORDER BY s.date DESC, s.createdAt DESC
       LIMIT ? OFFSET ?;`,
      [...params, safePageSize, offset],
    );

    return rows.map((row) => ({
      ...row,
      sourceMeta: parseSourceMeta(row.sourceMeta),
      itemQuantity: Number(row.itemQuantity || 0),
      paymentCount: Number(row.paymentCount || 0),
    }));
  },

  async getHistoryMetrics(filters: SalesHistoryFilters = {}): Promise<SalesHistoryMetrics> {
    const { clause, params } = buildSalesWhereClause(filters);
    const rows = await Database.query<{ totalCount: number; totalAmount: number }>(
      `SELECT COUNT(*) AS totalCount,
              COALESCE(SUM(s.total), 0) AS totalAmount
       FROM sales s
       ${clause};`,
      params,
    );
    return rows[0] ?? { totalCount: 0, totalAmount: 0 };
  },

  async getDailySeries(filters: SalesRangeFilters = {}): Promise<DailySalesSeriesPoint[]> {
    const { clause, params } = buildRangeClause(filters);
    return Database.query<DailySalesSeriesPoint>(
      `SELECT date,
              COALESCE(SUM(total), 0) AS total,
              COUNT(*) AS orderCount
       FROM sales
       ${clause}
       GROUP BY date
       ORDER BY date ASC;`,
      params,
    );
  },

  async getItemVelocityMap(
    itemIds: string[],
    filters: SalesRangeFilters = {},
  ): Promise<Record<string, number>> {
    if (!itemIds.length) return {};
    const placeholders = itemIds.map(() => '?').join(',');
    const { clause, params } = buildRangeClause(filters);
    const rows = await Database.query<ItemVelocityPoint>(
      `SELECT si.itemId AS itemId,
              COALESCE(SUM(si.quantity), 0) AS quantity
       FROM sale_items si
       INNER JOIN sales s ON s.id = si.saleId
       ${clause.replace('WHERE', 'WHERE')} AND si.itemId IN (${placeholders}) AND COALESCE(si.isReturn, 0) = 0
       GROUP BY si.itemId;`,
      [...params, ...itemIds],
    );
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.itemId] = Number(row.quantity || 0);
      return acc;
    }, {});
  },

  async getCreditAgingMap(): Promise<Record<string, string>> {
    const rows = await Database.query<{ customerId: string; oldestCreditDate: string }>(
      `SELECT s.customerId AS customerId,
              MIN(s.date) AS oldestCreditDate
       FROM sales s
       WHERE s.tombstone = 0
         AND s.customerId IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM sale_payments sp
           WHERE sp.saleId = s.id AND sp.mode = 'CREDIT'
         )
       GROUP BY s.customerId;`,
    );
    return rows.reduce<Record<string, string>>((acc, row) => {
      if (row.customerId && row.oldestCreditDate) acc[row.customerId] = row.oldestCreditDate;
      return acc;
    }, {});
  },

  async upsert(sale: Sale): Promise<void> {
    const ts = now();
    await Database.transaction(buildUpsertStatements(sale, ts, 1));
    tableEvents.emit(['sales', 'sale_items', 'sale_payments']);
  },

  async upsertMany(sales: Sale[], dirty: 0 | 1 = 1): Promise<void> {
    if (!sales.length) return;
    const ts = now();
    const stmts = sales.flatMap((sale) => buildUpsertStatements(sale, ts, dirty));
    await Database.transaction(stmts);
    tableEvents.emit(['sales', 'sale_items', 'sale_payments']);
  },

  async softDelete(id: string): Promise<void> {
    await Database.run(
      `UPDATE sales SET tombstone = 1, dirty = 1, updatedAt = ? WHERE id = ?;`,
      [now(), id],
    );
    tableEvents.emit(['sales', 'sale_items', 'sale_payments']);
  },

  async getDirty(): Promise<Array<Sale & { tombstone: number; updatedAt: number }>> {
    const rows = await Database.query<any>(
      `SELECT id, total, discount, discountValue, discountType,
              paymentMode, customerName, customerPhone,
              customerId, footerNote, sourceMeta, date, createdAt, staffId,
              updatedAt, tombstone
       FROM sales WHERE dirty = 1;`,
    );
    return hydrateSalesRows(rows) as Promise<Array<Sale & { tombstone: number; updatedAt: number }>>;
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const ph = ids.map(() => '?').join(',');
    await Database.run(`UPDATE sales SET dirty = 0 WHERE id IN (${ph});`, ids);
  },

  async mergeRemote(sale: Sale, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updatedAt: number; dirty: number }>(
      'SELECT updatedAt, dirty FROM sales WHERE id = ?;', [sale.id],
    );
    if (existing.length === 0 || remoteUpdatedAt > existing[0].updatedAt || !existing[0].dirty) {
      await Database.transaction(buildUpsertStatements(sale, remoteUpdatedAt, 0));
    }
  },
};
