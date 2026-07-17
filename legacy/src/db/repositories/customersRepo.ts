/**
 * Customers + Customer Payments — Standardized CamelCase Standards
 */

import { Database } from '../sqlite';
import { tableEvents } from '../events';
import type { Customer, CustomerPayment } from '../../lib/types';

const now = () => Date.now();

export interface CustomerListFilters {
  search?: string;
}

export interface CustomerListMetrics {
  total: number;
  activeCredits: number;
  totalCreditAmount: number;
}

const buildCustomerWhereClause = (
  filters: CustomerListFilters = {},
): { clause: string; params: Array<string | number> } => {
  const conditions = ['tombstone = 0'];
  const params: Array<string | number> = [];

  if (filters.search?.trim()) {
    const phoneLike = `%${filters.search.trim()}%`;
    const textLike = `%${filters.search.trim().toLowerCase()}%`;
    conditions.push('(LOWER(name) LIKE ? OR phone LIKE ?)');
    params.push(textLike, phoneLike);
  }

  return {
    clause: `WHERE ${conditions.join(' AND ')}`,
    params,
  };
};

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

export const customersRepo = {
  async getAll(): Promise<Customer[]> {
    const rows = await Database.query<any>(
      `SELECT id, name, phone, email, totalSpent, balance, sourceMeta, createdAt
       FROM customers WHERE tombstone = 0 ORDER BY name ASC;`,
    );
    return rows.map((row) => ({ ...row, sourceMeta: parseSourceMeta(row.sourceMeta) }));
  },

  async getPage(
    filters: CustomerListFilters = {},
    page: number = 1,
    pageSize: number = 100,
  ): Promise<Customer[]> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(pageSize, 500));
    const offset = (safePage - 1) * safePageSize;
    const { clause, params } = buildCustomerWhereClause(filters);
    const rows = await Database.query<any>(
      `SELECT id, name, phone, email, totalSpent, balance, sourceMeta, createdAt
       FROM customers
       ${clause}
       ORDER BY balance DESC, name ASC
       LIMIT ? OFFSET ?;`,
      [...params, safePageSize, offset],
    );
    return rows.map((row) => ({ ...row, sourceMeta: parseSourceMeta(row.sourceMeta) }));
  },

  async getMetrics(filters: CustomerListFilters = {}): Promise<CustomerListMetrics> {
    const { clause, params } = buildCustomerWhereClause(filters);
    const rows = await Database.query<CustomerListMetrics>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END) AS activeCredits,
              COALESCE(SUM(balance), 0) AS totalCreditAmount
       FROM customers
       ${clause};`,
      params,
    );
    return rows[0] ?? { total: 0, activeCredits: 0, totalCreditAmount: 0 };
  },

  async findByPhoneOrName(phone?: string, name?: string): Promise<Customer | null> {
    const normalizedPhone = phone?.trim() || '';
    const normalizedName = name?.trim().toLowerCase() || '';
    if (!normalizedPhone && !normalizedName) return null;

    const rows = await Database.query<any>(
      `SELECT id, name, phone, email, totalSpent, balance, sourceMeta, createdAt
       FROM customers
       WHERE tombstone = 0
         AND (
           (? <> '' AND phone = ?)
           OR (? <> '' AND LOWER(name) = ?)
         )
       ORDER BY CASE WHEN (? <> '' AND phone = ?) THEN 0 ELSE 1 END
       LIMIT 1;`,
      [normalizedPhone, normalizedPhone, normalizedName, normalizedName, normalizedPhone, normalizedPhone],
    );

    return rows[0] ? { ...rows[0], sourceMeta: parseSourceMeta(rows[0].sourceMeta) } : null;
  },

  async getById(id: string): Promise<Customer | null> {
    const rows = await Database.query<any>(
      `SELECT id, name, phone, email, totalSpent, balance, sourceMeta, createdAt
       FROM customers WHERE id = ? AND tombstone = 0;`, [id],
    );
    return rows[0] ? { ...rows[0], sourceMeta: parseSourceMeta(rows[0].sourceMeta) } : null;
  },

  async upsert(customer: Customer): Promise<void> {
    const ts = now();
    const ca = typeof customer.createdAt === 'string' ? new Date(customer.createdAt).getTime() : (customer.createdAt || ts);
    await Database.run(
      `INSERT OR REPLACE INTO customers (id, name, phone, email, totalSpent, balance, sourceMeta, createdAt, updatedAt, dirty, tombstone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
      [customer.id, customer.name, customer.phone, customer.email ?? null,
       customer.totalSpent, customer.balance, serializeSourceMeta(customer.sourceMeta), ca, ts],
    );
    tableEvents.emit('customers');
  },

  async updateBalance(id: string, spentDelta: number, balanceDelta: number): Promise<void> {
    await Database.run(
      `UPDATE customers SET totalSpent = totalSpent + ?, balance = balance + ?, updatedAt = ?, dirty = 1
       WHERE id = ?;`,
      [spentDelta, balanceDelta, now(), id],
    );
    tableEvents.emit('customers');
  },

  async softDelete(id: string): Promise<void> {
    await Database.run(
      `UPDATE customers SET tombstone = 1, dirty = 1, updatedAt = ? WHERE id = ?;`,
      [now(), id],
    );
    tableEvents.emit('customers');
  },

  async getDirty(): Promise<Array<Customer & { tombstone: number }>> {
    return Database.query(
      `SELECT id, name, phone, email, totalSpent, balance, sourceMeta, createdAt,
              updatedAt, tombstone
       FROM customers WHERE dirty = 1;`,
    ).then((rows: any[]) => rows.map((row) => ({ ...row, sourceMeta: parseSourceMeta(row.sourceMeta) })));
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const ph = ids.map(() => '?').join(',');
    await Database.run(`UPDATE customers SET dirty = 0 WHERE id IN (${ph});`, ids);
  },

  async mergeRemote(customer: Customer, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updatedAt: number; dirty: number }>(
      'SELECT updatedAt, dirty FROM customers WHERE id = ?;', [customer.id],
    );
    const ca = typeof customer.createdAt === 'string' ? new Date(customer.createdAt).getTime() : (customer.createdAt || remoteUpdatedAt);

    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO customers (id, name, phone, email, totalSpent, balance, sourceMeta, createdAt, updatedAt, dirty, tombstone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        [customer.id, customer.name, customer.phone, customer.email ?? null,
         customer.totalSpent, customer.balance, serializeSourceMeta(customer.sourceMeta), ca, remoteUpdatedAt],
      );
    } else if (remoteUpdatedAt > existing[0].updatedAt || !existing[0].dirty) {
      await Database.run(
        `UPDATE customers SET name=?, phone=?, email=?, totalSpent=?, balance=?, sourceMeta=?,
                updatedAt=?, dirty=0, tombstone=0 WHERE id=?;`,
        [customer.name, customer.phone, customer.email ?? null,
         customer.totalSpent, customer.balance, serializeSourceMeta(customer.sourceMeta), remoteUpdatedAt, customer.id],
      );
    }
  },
};

// ─── CUSTOMER PAYMENTS ──────────────────────────────────────

export const customerPaymentsRepo = {
  async getAll(): Promise<CustomerPayment[]> {
    return Database.query<CustomerPayment>(
      `SELECT id, customerId, amount, date, createdAt
       FROM customer_payments WHERE tombstone = 0 ORDER BY createdAt DESC;`,
    );
  },

  async getRange(dateFrom?: string, dateTo?: string): Promise<CustomerPayment[]> {
    const conditions = ['tombstone = 0'];
    const params: Array<string | number> = [];

    if (dateFrom) {
      conditions.push('date >= ?');
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push('date <= ?');
      params.push(dateTo);
    }

    return Database.query<CustomerPayment>(
      `SELECT id, customerId, amount, date, createdAt
       FROM customer_payments
       WHERE ${conditions.join(' AND ')}
       ORDER BY date DESC, createdAt DESC;`,
      params,
    );
  },

  async getByCustomerId(customerId: string): Promise<CustomerPayment[]> {
    return Database.query<CustomerPayment>(
      `SELECT id, customerId, amount, date, createdAt
       FROM customer_payments
       WHERE customerId = ? AND tombstone = 0
       ORDER BY createdAt DESC;`,
      [customerId],
    );
  },

  async upsert(payment: CustomerPayment): Promise<void> {
    const ts = now();
    const ca = typeof payment.createdAt === 'string' ? new Date(payment.createdAt).getTime() : (payment.createdAt || ts);
    await Database.run(
      `INSERT OR REPLACE INTO customer_payments (id, customerId, amount, date, createdAt, updatedAt, dirty, tombstone)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0);`,
      [payment.id, payment.customerId, payment.amount, payment.date, ca, ts],
    );
    tableEvents.emit('customer_payments');
  },

  async getDirty(): Promise<Array<CustomerPayment & { updatedAt: number }>> {
    return Database.query(
      `SELECT id, customerId, amount, date, createdAt, updatedAt
       FROM customer_payments WHERE dirty = 1;`,
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const ph = ids.map(() => '?').join(',');
    await Database.run(`UPDATE customer_payments SET dirty = 0 WHERE id IN (${ph});`, ids);
  },

  async mergeRemote(payment: CustomerPayment, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updatedAt: number; dirty: number }>(
      'SELECT updatedAt, dirty FROM customer_payments WHERE id = ?;', [payment.id],
    );
    const ca = typeof payment.createdAt === 'string' ? new Date(payment.createdAt).getTime() : (payment.createdAt || remoteUpdatedAt);

    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO customer_payments (id, customerId, amount, date, createdAt, updatedAt, dirty, tombstone)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0);`,
        [payment.id, payment.customerId, payment.amount, payment.date, ca, remoteUpdatedAt],
      );
    } else if (remoteUpdatedAt > existing[0].updatedAt || !existing[0].dirty) {
      await Database.run(
        `UPDATE customer_payments SET customerId=?, amount=?, date=?, updatedAt=?, dirty=0
         WHERE id=?;`,
        [payment.customerId, payment.amount, payment.date, remoteUpdatedAt, payment.id],
      );
    }
  },
};
