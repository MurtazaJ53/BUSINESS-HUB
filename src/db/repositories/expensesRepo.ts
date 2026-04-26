/**
 * Expenses Repository — Standardized CamelCase Standards
 */

import { Database } from '../sqlite';
import { tableEvents } from '../events';
import type { Expense } from '../../lib/types';

const now = () => Date.now();

export interface ExpenseListFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ExpenseListMetrics {
  totalCount: number;
  totalAmount: number;
}

export interface ExpenseCategoryTotal {
  category: string;
  total: number;
}

const buildExpenseWhereClause = (
  filters: ExpenseListFilters = {},
): { clause: string; params: Array<string | number> } => {
  const conditions = ['tombstone = 0'];
  const params: Array<string | number> = [];

  if (filters.search?.trim()) {
    const like = `%${filters.search.trim().toLowerCase()}%`;
    conditions.push('(LOWER(category) LIKE ? OR LOWER(description) LIKE ?)');
    params.push(like, like);
  }

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

export const expensesRepo = {
  async getAll(): Promise<Expense[]> {
    return Database.query<Expense>(
      `SELECT id, category, amount, description, paymentMethod, paymentReference, date, createdAt
       FROM expenses WHERE tombstone = 0 ORDER BY date DESC, createdAt DESC;`,
    );
  },

  async getPage(
    filters: ExpenseListFilters = {},
    page: number = 1,
    pageSize: number = 100,
  ): Promise<Expense[]> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(pageSize, 500));
    const offset = (safePage - 1) * safePageSize;
    const { clause, params } = buildExpenseWhereClause(filters);
    return Database.query<Expense>(
      `SELECT id, category, amount, description, paymentMethod, paymentReference, date, createdAt
       FROM expenses
       ${clause}
       ORDER BY date DESC, createdAt DESC
       LIMIT ? OFFSET ?;`,
      [...params, safePageSize, offset],
    );
  },

  async getMetrics(filters: ExpenseListFilters = {}): Promise<ExpenseListMetrics> {
    const { clause, params } = buildExpenseWhereClause(filters);
    const rows = await Database.query<ExpenseListMetrics>(
      `SELECT COUNT(*) AS totalCount,
              COALESCE(SUM(amount), 0) AS totalAmount
       FROM expenses
       ${clause};`,
      params,
    );
    return rows[0] ?? { totalCount: 0, totalAmount: 0 };
  },

  async getCategoryTotals(dateFrom?: string): Promise<ExpenseCategoryTotal[]> {
    const filters: ExpenseListFilters = {};
    if (dateFrom) filters.dateFrom = dateFrom;
    const { clause, params } = buildExpenseWhereClause(filters);
    return Database.query<ExpenseCategoryTotal>(
      `SELECT category, COALESCE(SUM(amount), 0) AS total
       FROM expenses
       ${clause}
       GROUP BY category
       ORDER BY total DESC;`,
      params,
    );
  },

  async upsert(expense: Expense): Promise<void> {
    const ts = now();
    const ca = typeof expense.createdAt === 'string' ? new Date(expense.createdAt).getTime() : (expense.createdAt || ts);
    await Database.run(
      `INSERT OR REPLACE INTO expenses (id, category, amount, description, paymentMethod, paymentReference, date, createdAt, updatedAt, dirty, tombstone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
      [expense.id, expense.category, expense.amount, expense.description, expense.paymentMethod || 'CASH', expense.paymentReference || null, expense.date, ca, ts],
    );
    tableEvents.emit('expenses');
  },

  async softDelete(id: string): Promise<void> {
    await Database.run(
      `UPDATE expenses SET tombstone = 1, dirty = 1, updatedAt = ? WHERE id = ?;`,
      [now(), id],
    );
    tableEvents.emit('expenses');
  },

  async getDirty(): Promise<Array<Expense & { tombstone: number }>> {
    return Database.query(
      `SELECT id, category, amount, description, paymentMethod, paymentReference, date, createdAt,
              updatedAt, tombstone
       FROM expenses WHERE dirty = 1;`,
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const ph = ids.map(() => '?').join(',');
    await Database.run(`UPDATE expenses SET dirty = 0 WHERE id IN (${ph});`, ids);
  },

  async mergeRemote(expense: Expense, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updatedAt: number; dirty: number }>(
      'SELECT updatedAt, dirty FROM expenses WHERE id = ?;', [expense.id],
    );
    const ca = typeof expense.createdAt === 'string' ? new Date(expense.createdAt).getTime() : (expense.createdAt || remoteUpdatedAt);

    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO expenses (id, category, amount, description, paymentMethod, paymentReference, date, createdAt, updatedAt, dirty, tombstone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        [expense.id, expense.category, expense.amount, expense.description, expense.paymentMethod || 'CASH', expense.paymentReference || null, expense.date, ca, remoteUpdatedAt],
      );
    } else if (remoteUpdatedAt > existing[0].updatedAt || !existing[0].dirty) {
      await Database.run(
        `UPDATE expenses SET category=?, amount=?, description=?, paymentMethod=?, paymentReference=?, date=?,
                updatedAt=?, dirty=0, tombstone=0 WHERE id=?;`,
        [expense.category, expense.amount, expense.description, expense.paymentMethod || 'CASH', expense.paymentReference || null, expense.date, remoteUpdatedAt, expense.id],
      );
    }
  },
};
