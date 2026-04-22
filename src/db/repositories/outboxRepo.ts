/**
 * Outbox Repository → sync_queue
 */

import { Database } from '../sqlite';

export interface QueueEntry {
  opId: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: string;
  createdAt: number; // ms epoch
  retries: number;
}

export const outboxRepo = {
  async enqueue(entry: Omit<QueueEntry, 'retries'>): Promise<void> {
    await Database.run(
      `INSERT OR REPLACE INTO sync_queue (op_id, entity_type, entity_id, operation, payload, created_at, retries)
       VALUES (?, ?, ?, ?, ?, ?, 0);`,
      [entry.opId, entry.entityType, entry.entityId, entry.operation, entry.payload, entry.createdAt],
    );
  },

  async getAll(): Promise<QueueEntry[]> {
    return Database.query<QueueEntry>(
      `SELECT op_id as opId, entity_type as entityType, entity_id as entityId,
              operation, payload, created_at as createdAt, retries
       FROM sync_queue ORDER BY created_at ASC;`,
    );
  },

  async remove(opId: string): Promise<void> {
    await Database.run('DELETE FROM sync_queue WHERE op_id = ?;', [opId]);
  },

  async incrementRetries(opId: string): Promise<void> {
    await Database.run('UPDATE sync_queue SET retries = retries + 1 WHERE op_id = ?;', [opId]);
  },

  async removeForEntity(entityType: string, entityId: string): Promise<void> {
    await Database.run('DELETE FROM sync_queue WHERE entity_type = ? AND entity_id = ?;', [entityType, entityId]);
  },

  async count(): Promise<number> {
    const r = await Database.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM sync_queue;');
    return r[0]?.cnt ?? 0;
  },

  async clear(): Promise<void> {
    await Database.run('DELETE FROM sync_queue;');
  },
};
