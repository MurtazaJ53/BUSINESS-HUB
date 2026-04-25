/**
 * Expenses Repository — Standardized CamelCase Standards
 */

import { Database } from '../sqlite';
import { tableEvents } from '../events';
import type { Expense } from '../../lib/types';

const now = () => Date.now();

export const expensesRepo = {
  async getAll(): Promise<Expense[]> {
    return Database.query<Expense>(
      `SELECT id, category, amount, description, paymentMethod, paymentReference, date, createdAt
       FROM expenses WHERE tombstone = 0 ORDER BY date DESC, createdAt DESC;`,
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
