/**
 * Expenses Repository — epoch timestamps, tombstone, Database singleton
 */

import { Database } from '../sqlite';
import type { Expense } from '../../lib/types';

const now = () => Date.now();

export const expensesRepo = {
  async getAll(): Promise<Expense[]> {
    return Database.query<Expense>(
      `SELECT id, category, amount, description, date, created_at as createdAt
       FROM expenses WHERE tombstone = 0 ORDER BY date DESC, created_at DESC;`,
    );
  },

  async upsert(expense: Expense): Promise<void> {
    const ts = now();
    const ca = typeof expense.createdAt === 'string' ? new Date(expense.createdAt).getTime() : (expense.createdAt || ts);
    await Database.run(
      `INSERT OR REPLACE INTO expenses (id, category, amount, description, date, created_at, updated_at, dirty, tombstone)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0);`,
      [expense.id, expense.category, expense.amount, expense.description, expense.date, ca, ts],
    );
  },

  async softDelete(id: string): Promise<void> {
    await Database.run(
      `UPDATE expenses SET tombstone = 1, dirty = 1, updated_at = ? WHERE id = ?;`,
      [now(), id],
    );
  },

  async getDirty(): Promise<Array<Expense & { tombstone: number }>> {
    return Database.query(
      `SELECT id, category, amount, description, date, created_at as createdAt,
              updated_at as updatedAt, tombstone
       FROM expenses WHERE dirty = 1;`,
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const ph = ids.map(() => '?').join(',');
    await Database.run(`UPDATE expenses SET dirty = 0 WHERE id IN (${ph});`, ids);
  },

  async mergeRemote(expense: Expense, remoteUpdatedAt: number): Promise<void> {
    const existing = await Database.query<{ updated_at: number; dirty: number }>(
      'SELECT updated_at, dirty FROM expenses WHERE id = ?;', [expense.id],
    );
    const ca = typeof expense.createdAt === 'string' ? new Date(expense.createdAt).getTime() : (expense.createdAt || remoteUpdatedAt);

    if (existing.length === 0) {
      await Database.run(
        `INSERT INTO expenses (id, category, amount, description, date, created_at, updated_at, dirty, tombstone)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        [expense.id, expense.category, expense.amount, expense.description, expense.date, ca, remoteUpdatedAt],
      );
    } else if (remoteUpdatedAt > existing[0].updated_at || !existing[0].dirty) {
      await Database.run(
        `UPDATE expenses SET category=?, amount=?, description=?, date=?,
                updated_at=?, dirty=0, tombstone=0 WHERE id=?;`,
        [expense.category, expense.amount, expense.description, expense.date, remoteUpdatedAt, expense.id],
      );
    }
  },
};
