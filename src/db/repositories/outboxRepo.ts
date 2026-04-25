/**
 * Outbox Repository → outbox
 */

import { Database } from '../sqlite';

export interface QueueEntry {
  opId: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: string;
  createdAt: number;
  retries: number;
}

export const outboxRepo = {
  async enqueue(entry: Omit<QueueEntry, 'retries'>): Promise<void> {
    await Database.run(
      `INSERT OR REPLACE INTO outbox (opId, entityType, entityId, operation, payload, createdAt, retries)
       VALUES (?, ?, ?, ?, ?, ?, 0);`,
      [entry.opId, entry.entityType, entry.entityId, entry.operation, entry.payload, entry.createdAt],
    );
  },

  async getAll(): Promise<QueueEntry[]> {
    return Database.query<QueueEntry>(
      `SELECT opId, entityType, entityId, operation, payload, createdAt, retries
       FROM outbox ORDER BY createdAt ASC;`,
    );
  },

  async remove(opId: string): Promise<void> {
    await Database.run('DELETE FROM outbox WHERE opId = ?;', [opId]);
  },

  async incrementRetries(opId: string): Promise<void> {
    await Database.run('UPDATE outbox SET retries = retries + 1 WHERE opId = ?;', [opId]);
  },

  async removeForEntity(entityType: string, entityId: string): Promise<void> {
    await Database.run('DELETE FROM outbox WHERE entityType = ? AND entityId = ?;', [entityType, entityId]);
  },

  async count(): Promise<number> {
    const rows = await Database.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM outbox;');
    return rows[0]?.cnt ?? 0;
  },

  async clear(): Promise<void> {
    await Database.run('DELETE FROM outbox;');
  },
};
