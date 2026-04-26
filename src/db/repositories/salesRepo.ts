/**
 * Sales Repository — Standardized CamelCase Standards
 */

import { Database } from '../sqlite';
import { tableEvents } from '../events';
import type { Sale, SaleItem } from '../../lib/types';

const now = () => Date.now();
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

    const sales: Sale[] = [];
    for (const row of rows) {
      const items = await Database.query<SaleItem>(
        `SELECT itemId, name, quantity, price, costPrice, size,
                isReturn
         FROM sale_items WHERE saleId = ?;`, [row.id],
      );
      const payments = await Database.query<{ mode: string; amount: number }>(
        `SELECT mode, amount FROM sale_payments WHERE saleId = ?;`, [row.id],
      );
      sales.push({ ...row, sourceMeta: parseSourceMeta(row.sourceMeta), items, payments });
    }
    return sales;
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

  async upsert(sale: Sale): Promise<void> {
    const ts = now();
    const ca = typeof sale.createdAt === 'string' ? new Date(sale.createdAt).getTime() : (sale.createdAt || ts);
    const stmts: Array<{ sql: string; params?: any[] }> = [];

    stmts.push({
      sql: `INSERT OR REPLACE INTO sales
              (id, total, discount, discountValue, discountType, paymentMode,
               customerName, customerPhone, customerId, footerNote, sourceMeta, date,
               createdAt, updatedAt, staffId, dirty, tombstone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
      params: [sale.id, sale.total, sale.discount, sale.discountValue, sale.discountType,
               sale.paymentMode, sale.customerName ?? null, sale.customerPhone ?? null,
               sale.customerId ?? null, sale.footerNote ?? null, serializeSourceMeta(sale.sourceMeta), sale.date, ca, ts, sale.staffId ?? null],
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
    const results: any[] = [];
    for (const row of rows) {
      const items = await Database.query<SaleItem>(
        `SELECT itemId, name, quantity, price, costPrice, size, isReturn
         FROM sale_items WHERE saleId = ?;`, [row.id],
      );
      const payments = await Database.query<{ mode: string; amount: number }>(
        `SELECT mode, amount FROM sale_payments WHERE saleId = ?;`, [row.id],
      );
      results.push({ ...row, sourceMeta: parseSourceMeta(row.sourceMeta), items, payments });
    }
    return results;
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
      const ca = typeof sale.createdAt === 'string' ? new Date(sale.createdAt).getTime() : (sale.createdAt || remoteUpdatedAt);
      const stmts: Array<{ sql: string; params?: any[] }> = [];

      stmts.push({
        sql: `INSERT OR REPLACE INTO sales
                (id, total, discount, discountValue, discountType, paymentMode,
                 customerName, customerPhone, customerId, footerNote, sourceMeta, date,
                 createdAt, updatedAt, staffId, dirty, tombstone)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        params: [sale.id, sale.total, sale.discount, sale.discountValue, sale.discountType,
                 sale.paymentMode, sale.customerName ?? null, sale.customerPhone ?? null,
                 sale.customerId ?? null, sale.footerNote ?? null, serializeSourceMeta(sale.sourceMeta), sale.date, ca, remoteUpdatedAt, sale.staffId ?? null],
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

      await Database.transaction(stmts);
    }
  },
};
