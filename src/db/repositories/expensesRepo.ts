/**
 * Expenses Repository — Local SQLite CRUD with sync metadata
 */

import { execQuery, execRun } from '../connection';
import type { Expense } from '../../lib/types';

const now = () => new Date().toISOString();

export const expensesRepo = {
  async getAll(): Promise<Expense[]> {
    return execQuery<Expense>(
      `SELECT id, category, amount, description, date, created_at as createdAt
       FROM expenses WHERE is_deleted = 0 ORDER BY date DESC, created_at DESC;`
    );
  },

  async upsert(expense: Expense): Promise<void> {
    const ts = now();
    await execRun(
      `INSERT OR REPLACE INTO expenses (id, category, amount, description, date, created_at, updated_at, is_dirty, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0);`,
      [expense.id, expense.category, expense.amount, expense.description, expense.date, expense.createdAt, ts]
    );
  },

  async softDelete(id: string): Promise<void> {
    const ts = now();
    await execRun(
      `UPDATE expenses SET is_deleted = 1, is_dirty = 1, updated_at = ? WHERE id = ?;`,
      [ts, id]
    );
  },

  async getDirty(): Promise<Array<Expense & { isDeleted: boolean }>> {
    return execQuery(
      `SELECT id, category, amount, description, date, created_at as createdAt,
              updated_at as updatedAt, is_deleted as isDeleted
       FROM expenses WHERE is_dirty = 1;`
    );
  },

  async markClean(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await execRun(`UPDATE expenses SET is_dirty = 0 WHERE id IN (${placeholders});`, ids);
  },

  async mergeRemote(expense: Expense, remoteUpdatedAt: string): Promise<void> {
    const existing = await execQuery<{ updatedAt: string; isDirty: number }>(
      'SELECT updated_at as updatedAt, is_dirty as isDirty FROM expenses WHERE id = ?;',
      [expense.id]
    );

    if (existing.length === 0) {
      await execRun(
        `INSERT INTO expenses (id, category, amount, description, date, created_at, updated_at, is_dirty, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0);`,
        [expense.id, expense.category, expense.amount, expense.description, expense.date, expense.createdAt, remoteUpdatedAt]
      );
    } else if (remoteUpdatedAt > existing[0].updatedAt || !existing[0].isDirty) {
      await execRun(
        `UPDATE expenses SET category = ?, amount = ?, description = ?, date = ?,
                updated_at = ?, is_dirty = 0, is_deleted = 0 WHERE id = ?;`,
        [expense.category, expense.amount, expense.description, expense.date, remoteUpdatedAt, expense.id]
      );
    }
  },
};
