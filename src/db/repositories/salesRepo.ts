/**
 * Sales Repository — Local SQLite CRUD with normalized items/payments
 */

import { execQuery, execRun, execTransaction } from '../connection';
import type { Sale, SaleItem } from '../../lib/types';

const now = () => new Date().toISOString();

export const salesRepo = {
  // ─── READ ────────────────────────────────────────────────

  async getAll(limitCount = 100): Promise<Sale[]> {
    const rows = await execQuery<any>(
      `SELECT id, total, discount, discount_value as discountValue, discount_type as discountType,
              payment_mode as paymentMode, customer_name as customerName, customer_phone as customerPhone,
              customer_id as customerId, footer_note as footerNote, date, created_at as createdAt
       FROM sales WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT ?;`,
      [limitCount]
    );

    // Attach items and payments for each sale
    const sales: Sale[] = [];
    for (const row of rows) {
      const items = await execQuery<SaleItem>(
        `SELECT item_id as itemId, name, quantity, price, cost_price as costPrice, size,
                is_return as isReturn
         FROM sale_items WHERE sale_id = ?;`,
        [row.id]
      );

      const payments = await execQuery<{ mode: string; amount: number }>(
        `SELECT mode, amount FROM sale_payments WHERE sale_id = ?;`,
        [row.id]
      );

      sales.push({
        ...row,
        items,
        payments,
      });
    }

    return sales;
  },

  async getById(id: string): Promise<Sale | null> {
    const rows = await execQuery<any>(
      `SELECT id, total, discount, discount_value as discountValue, discount_type as discountType,
              payment_mode as paymentMode, customer_name as customerName, customer_phone as customerPhone,
              customer_id as customerId, footer_note as footerNote, date, created_at as createdAt
       FROM sales WHERE id = ? AND is_deleted = 0;`,
      [id]
    );
    if (rows.length === 0) return null;

    const items = await execQuery<SaleItem>(
      `SELECT item_id as itemId, name, quantity, price, cost_price as costPrice, size, is_return as isReturn
       FROM sale_items WHERE sale_id = ?;`,
      [id]
    );

    const payments = await execQuery<{ mode: string; amount: number }>(
      `SELECT mode, amount FROM sale_payments WHERE sale_id = ?;`,
      [id]
    );

    return { ...rows[0], items, payments };
  },

  // ─── WRITE ───────────────────────────────────────────────

  async upsert(sale: Sale): Promise<void> {
    const ts = now();
    const stmts: Array<{ sql: string; values?: any[] }> = [];

    // Upsert the sale record
    stmts.push({
      sql: `INSERT OR REPLACE INTO sales (id, total, discount, discount_value, discount_type, payment_mode,
             customer_name, customer_phone, customer_id, footer_note, date, created_at, updated_at, is_dirty, is_deleted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
      values: [sale.id, sale.total, sale.discount, sale.discountValue, sale.discountType,
               sale.paymentMode, sale.customerName ?? null, sale.customerPhone ?? null,
               sale.customerId ?? null, sale.footerNote ?? null, sale.date, sale.createdAt, ts],
    });

    // Clear and re-insert items
    stmts.push({ sql: 'DELETE FROM sale_items WHERE sale_id = ?;', values: [sale.id] });
    for (let idx = 0; idx < sale.items.length; idx++) {
      const item = sale.items[idx];
      stmts.push({
        sql: `INSERT INTO sale_items (id, sale_id, item_id, name, quantity, price, cost_price, size, is_return)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        values: [`${sale.id}_${item.itemId}_${idx}`, sale.id, item.itemId, item.name,
                 item.quantity, item.price, item.costPrice ?? null, item.size ?? null,
                 item.isReturn ? 1 : 0],
      });
    }

    // Clear and re-insert payments
    stmts.push({ sql: 'DELETE FROM sale_payments WHERE sale_id = ?;', values: [sale.id] });
    for (let idx = 0; idx < sale.payments.length; idx++) {
      const pmt = sale.payments[idx];
      stmts.push({
        sql: `INSERT INTO sale_payments (id, sale_id, mode, amount)
              VALUES (?, ?, ?, ?);`,
        values: [`${sale.id}_${pmt.mode}_${idx}`, sale.id, pmt.mode, pmt.amount],
      });
    }

    await execTransaction(stmts);
  },

  async softDelete(id: string): Promise<void> {
    const ts = now();
    await execRun(
      `UPDATE sales SET is_deleted = 1, is_dirty = 1, updated_at = ? WHERE id = ?;`,
      [ts, id]
    );
  },

  // ─── SYNC HELPERS ────────────────────────────────────────

  async getDirty(): Promise<Array<Sale & { isDeleted: boolean; updatedAt: string }>> {
    const rows = await execQuery<any>(
      `SELECT id, total, discount, discount_value as discountValue, discount_type as discountType,
              payment_mode as paymentMode, customer_name as customerName, customer_phone as customerPhone,
              customer_id as customerId, footer_note as footerNote, date, created_at as createdAt,
              updated_at as updatedAt, is_deleted as isDeleted
       FROM sales WHERE is_dirty = 1;`
    );

    const results: Array<Sale & { isDeleted: boolean; updatedAt: string }> = [];
    for (const row of rows) {
      const items = await execQuery<SaleItem>(
        `SELECT item_id as itemId, name, quantity, price, cost_price as costPrice, size, is_return as isReturn
         FROM sale_items WHERE sale_id = ?;`,
        [row.id]
      );
      const payments = await execQuery<{ mode: string; amount: number }>(
        `SELECT mode, amount FROM sale_payments WHERE sale_id = ?;`,
        [row.id]
      );
      results.push({ ...row, items, payments });
    }
    return results;
  },

  async markClean(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await execRun(`UPDATE sales SET is_dirty = 0 WHERE id IN (${placeholders});`, ids);
  },

  async mergeRemote(sale: Sale, remoteUpdatedAt: string): Promise<void> {
    const existing = await execQuery<{ updatedAt: string; isDirty: number }>(
      'SELECT updated_at as updatedAt, is_dirty as isDirty FROM sales WHERE id = ?;',
      [sale.id]
    );

    if (existing.length === 0 || remoteUpdatedAt > existing[0].updatedAt || !existing[0].isDirty) {
      // Use the full upsert but mark as clean
      const ts = remoteUpdatedAt;
      const stmts: Array<{ sql: string; values?: any[] }> = [];

      stmts.push({
        sql: `INSERT OR REPLACE INTO sales (id, total, discount, discount_value, discount_type, payment_mode,
               customer_name, customer_phone, customer_id, footer_note, date, created_at, updated_at, is_dirty, is_deleted)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        values: [sale.id, sale.total, sale.discount, sale.discountValue, sale.discountType,
                 sale.paymentMode, sale.customerName ?? null, sale.customerPhone ?? null,
                 sale.customerId ?? null, sale.footerNote ?? null, sale.date, sale.createdAt, ts],
      });

      stmts.push({ sql: 'DELETE FROM sale_items WHERE sale_id = ?;', values: [sale.id] });
      for (let idx = 0; idx < sale.items.length; idx++) {
        const item = sale.items[idx];
        stmts.push({
          sql: `INSERT INTO sale_items (id, sale_id, item_id, name, quantity, price, cost_price, size, is_return)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          values: [`${sale.id}_${item.itemId}_${idx}`, sale.id, item.itemId, item.name,
                   item.quantity, item.price, item.costPrice ?? null, item.size ?? null,
                   item.isReturn ? 1 : 0],
        });
      }

      stmts.push({ sql: 'DELETE FROM sale_payments WHERE sale_id = ?;', values: [sale.id] });
      for (let idx = 0; idx < sale.payments.length; idx++) {
        const pmt = sale.payments[idx];
        stmts.push({
          sql: `INSERT INTO sale_payments (id, sale_id, mode, amount) VALUES (?, ?, ?, ?);`,
          values: [`${sale.id}_${pmt.mode}_${idx}`, sale.id, pmt.mode, pmt.amount],
        });
      }

      await execTransaction(stmts);
    }
  },
};
