/**
 * Customers + Customer Payments — epoch timestamps, tombstone, Database singleton
 */

import { Database } from '../sqlite';
import type { Customer, CustomerPayment } from '../../lib/types';

const now = () => Date.now();

export const customersRepo = {
  async getAll(): Promise<Customer[]> {
    return Database.query<Customer>(
      `SELECT id, name, phone, email, total_spent as totalSpent, balance, created_at as createdAt
       FROM customers WHERE tombstone = 0 ORDER BY name ASC;`,
    );
  },

  async getById(id: string): Promise<Customer | null> {
    const rows = await Database.query<Customer>(
      `SELECT id, name, phone, email, total_spent as totalSpent, balance, created_at as createdAt
       FROM customers WHERE id = ? AND tombstone = 0;`, [id],
    );
    return rows[0] ?? null;
  },

  async upsert(customer: Customer): Promise<void> {
    const ts = now();
    const ca = typeof customer.createdAt === 'string' ? new Date(customer.createdAt).getTime() : (customer.createdAt || ts);
    await Database.run(
      `INSERT OR REPLACE INTO customers (id, name, phone, email, total_spent, balance, created_at, updated_at, dirty, tombstone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
      [customer.id, customer.name, customer.phone, customer.email ?? null,
       customer.totalSpent, customer.balance, ca, ts],
    );
  },

  async updateBalance(id: string, spentDelta: number, balanceDelta: number): Promise<void> {
    await Database.run(
      `UPDATE customers SET total_spent = total_spent + ?, balance = balance + ?, updated_at = ?, dirty = 1
       WHERE id = ?;`,
      [spentDelta, balanceDelta, now(), id],
    );
  },

  async softDelete(id: string): Promise<void> {
    await Database.run(
      `UPDATE customers SET tombstone = 1, dirty = 1, updated_at = ? WHERE id = ?;`,
      [now(), id],
    );
  },

  async getDirty(): Promise<Array<Customer & { tombstone: number }>> {
    return Database.query(
      `SELECT id, name, phone, email, total_spent as totalSpent, balance, created_at as createdAt,
              updated_at as updatedAt, tombstone
       FROM customers WHERE dirty = 1;`,
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const ph = ids.map(() => '?').join(',');
    await Database.run(`UPDATE customers SET dirty = 0 WHERE id IN (${ph});`, ids);
  },

  async mergeRemote(customer: Customer, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updated_at: number; dirty: number }>(
      'SELECT updated_at, dirty FROM customers WHERE id = ?;', [customer.id],
    );
    const ca = typeof customer.createdAt === 'string' ? new Date(customer.createdAt).getTime() : (customer.createdAt || remoteUpdatedAt);

    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO customers (id, name, phone, email, total_spent, balance, created_at, updated_at, dirty, tombstone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        [customer.id, customer.name, customer.phone, customer.email ?? null,
         customer.totalSpent, customer.balance, ca, remoteUpdatedAt],
      );
    } else if (remoteUpdatedAt > existing[0].updated_at || !existing[0].dirty) {
      await Database.run(
        `UPDATE customers SET name=?, phone=?, email=?, total_spent=?, balance=?,
                updated_at=?, dirty=0, tombstone=0 WHERE id=?;`,
        [customer.name, customer.phone, customer.email ?? null,
         customer.totalSpent, customer.balance, remoteUpdatedAt, customer.id],
      );
    }
  },
};

// ─── CUSTOMER PAYMENTS ──────────────────────────────────────

export const customerPaymentsRepo = {
  async getAll(): Promise<CustomerPayment[]> {
    return Database.query<CustomerPayment>(
      `SELECT id, customer_id as customerId, amount, date, created_at as createdAt
       FROM customer_payments WHERE tombstone = 0 ORDER BY created_at DESC;`,
    );
  },

  async upsert(payment: CustomerPayment): Promise<void> {
    const ts = now();
    const ca = typeof payment.createdAt === 'string' ? new Date(payment.createdAt).getTime() : (payment.createdAt || ts);
    await Database.run(
      `INSERT OR REPLACE INTO customer_payments (id, customer_id, amount, date, created_at, updated_at, dirty, tombstone)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0);`,
      [payment.id, payment.customerId, payment.amount, payment.date, ca, ts],
    );
  },

  async getDirty(): Promise<Array<CustomerPayment & { updatedAt: number }>> {
    return Database.query(
      `SELECT id, customer_id as customerId, amount, date, created_at as createdAt, updated_at as updatedAt
       FROM customer_payments WHERE dirty = 1;`,
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const ph = ids.map(() => '?').join(',');
    await Database.run(`UPDATE customer_payments SET dirty = 0 WHERE id IN (${ph});`, ids);
  },

  async mergeRemote(payment: CustomerPayment, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updated_at: number; dirty: number }>(
      'SELECT updated_at, dirty FROM customer_payments WHERE id = ?;', [payment.id],
    );
    const ca = typeof payment.createdAt === 'string' ? new Date(payment.createdAt).getTime() : (payment.createdAt || remoteUpdatedAt);

    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO customer_payments (id, customer_id, amount, date, created_at, updated_at, dirty, tombstone)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0);`,
        [payment.id, payment.customerId, payment.amount, payment.date, ca, remoteUpdatedAt],
      );
    } else if (remoteUpdatedAt > existing[0].updated_at || !existing[0].dirty) {
      await Database.run(
        `UPDATE customer_payments SET customer_id=?, amount=?, date=?, updated_at=?, dirty=0
         WHERE id=?;`,
        [payment.customerId, payment.amount, payment.date, remoteUpdatedAt, payment.id],
      );
    }
  },
};
