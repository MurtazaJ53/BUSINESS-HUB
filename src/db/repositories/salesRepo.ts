/**
 * Sales Repository — epoch timestamps, tombstone, Database singleton
 */

import { Database } from '../sqlite';
import type { Sale, SaleItem } from '../../lib/types';

const now = () => Date.now();

export const salesRepo = {
  async getAll(limitCount = 100): Promise<Sale[]> {
    const rows = await Database.query<any>(
      `SELECT id, total, discount, discount_value as discountValue, discount_type as discountType,
              payment_mode as paymentMode, customer_name as customerName, customer_phone as customerPhone,
              customer_id as customerId, footer_note as footerNote, date, created_at as createdAt
       FROM sales WHERE tombstone = 0 ORDER BY created_at DESC LIMIT ?;`,
      [limitCount],
    );

    const sales: Sale[] = [];
    for (const row of rows) {
      const items = await Database.query<SaleItem>(
        `SELECT item_id as itemId, name, quantity, price, cost_price as costPrice, size,
                is_return as isReturn
         FROM sale_items WHERE sale_id = ?;`, [row.id],
      );
      const payments = await Database.query<{ mode: string; amount: number }>(
        `SELECT mode, amount FROM sale_payments WHERE sale_id = ?;`, [row.id],
      );
      sales.push({ ...row, items, payments });
    }
    return sales;
  },

  async getById(id: string): Promise<Sale | null> {
    const rows = await Database.query<any>(
      `SELECT id, total, discount, discount_value as discountValue, discount_type as discountType,
              payment_mode as paymentMode, customer_name as customerName, customer_phone as customerPhone,
              customer_id as customerId, footer_note as footerNote, date, created_at as createdAt
       FROM sales WHERE id = ? AND tombstone = 0;`, [id],
    );
    if (!rows.length) return null;
    const items = await Database.query<SaleItem>(
      `SELECT item_id as itemId, name, quantity, price, cost_price as costPrice, size, is_return as isReturn
       FROM sale_items WHERE sale_id = ?;`, [id],
    );
    const payments = await Database.query<{ mode: string; amount: number }>(
      `SELECT mode, amount FROM sale_payments WHERE sale_id = ?;`, [id],
    );
    return { ...rows[0], items, payments };
  },

  async upsert(sale: Sale): Promise<void> {
    const ts = now();
    const ca = typeof sale.createdAt === 'string' ? new Date(sale.createdAt).getTime() : (sale.createdAt || ts);
    const stmts: Array<{ sql: string; params?: any[] }> = [];

    stmts.push({
      sql: `INSERT OR REPLACE INTO sales
              (id, total, discount, discount_value, discount_type, payment_mode,
               customer_name, customer_phone, customer_id, footer_note, date,
               created_at, updated_at, dirty, tombstone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
      params: [sale.id, sale.total, sale.discount, sale.discountValue, sale.discountType,
               sale.paymentMode, sale.customerName ?? null, sale.customerPhone ?? null,
               sale.customerId ?? null, sale.footerNote ?? null, sale.date, ca, ts],
    });

    stmts.push({ sql: 'DELETE FROM sale_items WHERE sale_id = ?;', params: [sale.id] });
    sale.items.forEach((item, idx) => {
      stmts.push({
        sql: `INSERT INTO sale_items (id, sale_id, item_id, name, quantity, price, cost_price, size, is_return)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        params: [`${sale.id}_${item.itemId}_${idx}`, sale.id, item.itemId, item.name,
                 item.quantity, item.price, item.costPrice ?? null, item.size ?? null,
                 item.isReturn ? 1 : 0],
      });
    });

    stmts.push({ sql: 'DELETE FROM sale_payments WHERE sale_id = ?;', params: [sale.id] });
    sale.payments.forEach((pmt, idx) => {
      stmts.push({
        sql: `INSERT INTO sale_payments (id, sale_id, mode, amount) VALUES (?, ?, ?, ?);`,
        params: [`${sale.id}_${pmt.mode}_${idx}`, sale.id, pmt.mode, pmt.amount],
      });
    });

    await Database.transaction(stmts);
  },

  async softDelete(id: string): Promise<void> {
    await Database.run(
      `UPDATE sales SET tombstone = 1, dirty = 1, updated_at = ? WHERE id = ?;`,
      [now(), id],
    );
  },

  async getDirty(): Promise<Array<Sale & { tombstone: number; updatedAt: number }>> {
    const rows = await Database.query<any>(
      `SELECT id, total, discount, discount_value as discountValue, discount_type as discountType,
              payment_mode as paymentMode, customer_name as customerName, customer_phone as customerPhone,
              customer_id as customerId, footer_note as footerNote, date, created_at as createdAt,
              updated_at as updatedAt, tombstone
       FROM sales WHERE dirty = 1;`,
    );
    const results: any[] = [];
    for (const row of rows) {
      const items = await Database.query<SaleItem>(
        `SELECT item_id as itemId, name, quantity, price, cost_price as costPrice, size, is_return as isReturn
         FROM sale_items WHERE sale_id = ?;`, [row.id],
      );
      const payments = await Database.query<{ mode: string; amount: number }>(
        `SELECT mode, amount FROM sale_payments WHERE sale_id = ?;`, [row.id],
      );
      results.push({ ...row, items, payments });
    }
    return results;
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const ph = ids.map(() => '?').join(',');
    await Database.run(`UPDATE sales SET dirty = 0 WHERE id IN (${ph});`, ids);
  },

  async mergeRemote(sale: Sale, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updated_at: number; dirty: number }>(
      'SELECT updated_at, dirty FROM sales WHERE id = ?;', [sale.id],
    );
    if (existing.length === 0 || remoteUpdatedAt > existing[0].updated_at || !existing[0].dirty) {
      const ca = typeof sale.createdAt === 'string' ? new Date(sale.createdAt).getTime() : (sale.createdAt || remoteUpdatedAt);
      const stmts: Array<{ sql: string; params?: any[] }> = [];

      stmts.push({
        sql: `INSERT OR REPLACE INTO sales
                (id, total, discount, discount_value, discount_type, payment_mode,
                 customer_name, customer_phone, customer_id, footer_note, date,
                 created_at, updated_at, dirty, tombstone)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        params: [sale.id, sale.total, sale.discount, sale.discountValue, sale.discountType,
                 sale.paymentMode, sale.customerName ?? null, sale.customerPhone ?? null,
                 sale.customerId ?? null, sale.footerNote ?? null, sale.date, ca, remoteUpdatedAt],
      });

      stmts.push({ sql: 'DELETE FROM sale_items WHERE sale_id = ?;', params: [sale.id] });
      sale.items.forEach((item, idx) => {
        stmts.push({
          sql: `INSERT INTO sale_items (id, sale_id, item_id, name, quantity, price, cost_price, size, is_return)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          params: [`${sale.id}_${item.itemId}_${idx}`, sale.id, item.itemId, item.name,
                   item.quantity, item.price, item.costPrice ?? null, item.size ?? null,
                   item.isReturn ? 1 : 0],
        });
      });

      stmts.push({ sql: 'DELETE FROM sale_payments WHERE sale_id = ?;', params: [sale.id] });
      sale.payments.forEach((pmt, idx) => {
        stmts.push({
          sql: `INSERT INTO sale_payments (id, sale_id, mode, amount) VALUES (?, ?, ?, ?);`,
          params: [`${sale.id}_${pmt.mode}_${idx}`, sale.id, pmt.mode, pmt.amount],
        });
      });

      await Database.transaction(stmts);
    }
  },
};
