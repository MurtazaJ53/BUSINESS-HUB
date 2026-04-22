/**
 * Outbox Repository — Sync mutation queue
 * 
 * Manages the sync_outbox table which stores pending local mutations
 * that need to be pushed to Firestore.
 */

import { execQuery, execRun } from '../connection';

export interface OutboxEntry {
  opId: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: string; // JSON
  createdAt: string;
  retries: number;
}

export const outboxRepo = {
  /**
   * Enqueue a new mutation for sync.
   */
  async enqueue(entry: Omit<OutboxEntry, 'retries'>): Promise<void> {
    await execRun(
      `INSERT OR REPLACE INTO sync_outbox (op_id, entity_type, entity_id, operation, payload, created_at, retries)
       VALUES (?, ?, ?, ?, ?, ?, 0);`,
      [entry.opId, entry.entityType, entry.entityId, entry.operation, entry.payload, entry.createdAt]
    );
  },

  /**
   * Get all pending outbox entries, ordered by creation time.
   */
  async getAll(): Promise<OutboxEntry[]> {
    return execQuery<OutboxEntry>(
      'SELECT op_id as opId, entity_type as entityType, entity_id as entityId, operation, payload, created_at as createdAt, retries FROM sync_outbox ORDER BY created_at ASC;'
    );
  },

  /**
   * Get pending entries for a specific entity type.
   */
  async getByType(entityType: string): Promise<OutboxEntry[]> {
    return execQuery<OutboxEntry>(
      'SELECT op_id as opId, entity_type as entityType, entity_id as entityId, operation, payload, created_at as createdAt, retries FROM sync_outbox WHERE entity_type = ? ORDER BY created_at ASC;',
      [entityType]
    );
  },

  /**
   * Remove a successfully synced entry.
   */
  async remove(opId: string): Promise<void> {
    await execRun('DELETE FROM sync_outbox WHERE op_id = ?;', [opId]);
  },

  /**
   * Increment retry count for failed sync attempt.
   */
  async incrementRetries(opId: string): Promise<void> {
    await execRun('UPDATE sync_outbox SET retries = retries + 1 WHERE op_id = ?;', [opId]);
  },

  /**
   * Remove all entries for a specific entity (used when entity is deleted).
   */
  async removeForEntity(entityType: string, entityId: string): Promise<void> {
    await execRun('DELETE FROM sync_outbox WHERE entity_type = ? AND entity_id = ?;', [entityType, entityId]);
  },

  /**
   * Get the count of pending mutations.
   */
  async count(): Promise<number> {
    const result = await execQuery<{ cnt: number }>('SELECT COUNT(*) as cnt FROM sync_outbox;');
    return result[0]?.cnt ?? 0;
  },

  /**
   * Clear all outbox entries (used after full sync reset).
   */
  async clear(): Promise<void> {
    await execRun('DELETE FROM sync_outbox;');
  },
};
