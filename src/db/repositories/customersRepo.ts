/**
 * Customers Repository — Local SQLite CRUD with sync metadata
 */

import { execQuery, execRun } from '../connection';
import type { Customer, CustomerPayment } from '../../lib/types';

const now = () => new Date().toISOString();

export const customersRepo = {
  async getAll(): Promise<Customer[]> {
    return execQuery<Customer>(
      `SELECT id, name, phone, email, total_spent as totalSpent, balance, created_at as createdAt
       FROM customers WHERE is_deleted = 0 ORDER BY name ASC;`
    );
  },

  async getById(id: string): Promise<Customer | null> {
    const rows = await execQuery<Customer>(
      `SELECT id, name, phone, email, total_spent as totalSpent, balance, created_at as createdAt
       FROM customers WHERE id = ? AND is_deleted = 0;`,
      [id]
    );
    return rows[0] ?? null;
  },

  async upsert(customer: Customer): Promise<void> {
    const ts = now();
    await execRun(
      `INSERT OR REPLACE INTO customers (id, name, phone, email, total_spent, balance, created_at, updated_at, is_dirty, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
      [customer.id, customer.name, customer.phone, customer.email ?? null,
       customer.totalSpent, customer.balance, customer.createdAt, ts]
    );
  },

  async updateBalance(id: string, spentDelta: number, balanceDelta: number): Promise<void> {
    const ts = now();
    await execRun(
      `UPDATE customers SET total_spent = total_spent + ?, balance = balance + ?, updated_at = ?, is_dirty = 1
       WHERE id = ?;`,
      [spentDelta, balanceDelta, ts, id]
    );
  },

  async softDelete(id: string): Promise<void> {
    const ts = now();
    await execRun(
      `UPDATE customers SET is_deleted = 1, is_dirty = 1, updated_at = ? WHERE id = ?;`,
      [ts, id]
    );
  },

  async getDirty(): Promise<Array<Customer & { isDeleted: boolean }>> {
    return execQuery(
      `SELECT id, name, phone, email, total_spent as totalSpent, balance, created_at as createdAt,
              updated_at as updatedAt, is_deleted as isDeleted
       FROM customers WHERE is_dirty = 1;`
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await execRun(`UPDATE customers SET is_dirty = 0 WHERE id IN (${placeholders});`, ids);
  },

  async mergeRemote(customer: Customer, remoteUpdatedAt: string): Promise<void> {
    const existing = await execQuery<{ updatedAt: string; isDirty: number }>(
      'SELECT updated_at as updatedAt, is_dirty as isDirty FROM customers WHERE id = ?;',
      [customer.id]
    );

    if (existing.length === 0) {
      await execRun(
        `INSERT INTO customers (id, name, phone, email, total_spent, balance, created_at, updated_at, is_dirty, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        [customer.id, customer.name, customer.phone, customer.email ?? null,
         customer.totalSpent, customer.balance, customer.createdAt, remoteUpdatedAt]
      );
    } else {
      const local = existing[0];
      if (remoteUpdatedAt > local.updatedAt || !local.isDirty) {
        await execRun(
          `UPDATE customers SET name = ?, phone = ?, email = ?, total_spent = ?, balance = ?,
                  updated_at = ?, is_dirty = 0, is_deleted = 0 WHERE id = ?;`,
          [customer.name, customer.phone, customer.email ?? null,
           customer.totalSpent, customer.balance, remoteUpdatedAt, customer.id]
        );
      }
    }
  },
};

// ─── CUSTOMER PAYMENTS REPO ─────────────────────────────────

export const customerPaymentsRepo = {
  async getAll(): Promise<CustomerPayment[]> {
    return execQuery<CustomerPayment>(
      `SELECT id, customer_id as customerId, amount, date, created_at as createdAt
       FROM customer_payments ORDER BY created_at DESC;`
    );
  },

  async upsert(payment: CustomerPayment): Promise<void> {
    const ts = now();
    await execRun(
      `INSERT OR REPLACE INTO customer_payments (id, customer_id, amount, date, created_at, updated_at, is_dirty)
       VALUES (?, ?, ?, ?, ?, ?, 1);`,
      [payment.id, payment.customerId, payment.amount, payment.date, payment.createdAt, ts]
    );
  },

  async getDirty(): Promise<Array<CustomerPayment & { updatedAt: string }>> {
    return execQuery(
      `SELECT id, customer_id as customerId, amount, date, created_at as createdAt, updated_at as updatedAt
       FROM customer_payments WHERE is_dirty = 1;`
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await execRun(`UPDATE customer_payments SET is_dirty = 0 WHERE id IN (${placeholders});`, ids);
  },

  async mergeRemote(payment: CustomerPayment, remoteUpdatedAt: string): Promise<void> {
    const existing = await execQuery<{ updatedAt: string; isDirty: number }>(
      'SELECT updated_at as updatedAt, is_dirty as isDirty FROM customer_payments WHERE id = ?;',
      [payment.id]
    );

    if (existing.length === 0) {
      await execRun(
        `INSERT INTO customer_payments (id, customer_id, amount, date, created_at, updated_at, is_dirty)
         VALUES (?, ?, ?, ?, ?, ?, 0);`,
        [payment.id, payment.customerId, payment.amount, payment.date, payment.createdAt, remoteUpdatedAt]
      );
    } else if (remoteUpdatedAt > existing[0].updatedAt || !existing[0].isDirty) {
      await execRun(
        `UPDATE customer_payments SET customer_id = ?, amount = ?, date = ?, updated_at = ?, is_dirty = 0
         WHERE id = ?;`,
        [payment.customerId, payment.amount, payment.date, remoteUpdatedAt, payment.id]
      );
    }
  },
};
