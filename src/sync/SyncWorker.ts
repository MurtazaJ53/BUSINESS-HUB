/**
 * SyncWorker — Background Sync Engine for Firebase <-> SQLite
 *
 * Runs as a logical background worker in the main thread (to share SQLite memory lock).
 * PUSH: Drains sync_queue using writeBatch (chunks of 400). Supports CRDT increment for stockDelta.
 * PULL: Subscribes using LWW rule `updatedAt > last_synced_at`.
 */

import { db as firestoreDb } from '../lib/firebase';
import {
  collection, doc, onSnapshot, writeBatch, increment,
  query, where, orderBy, limit, deleteDoc, getDoc, setDoc
} from 'firebase/firestore';
import { Network } from '@capacitor/network';
import { Database } from '../db/sqlite';
import { tableEvents } from '../db/events';

import { inventoryRepo, inventoryPrivateRepo } from '../db/repositories/inventoryRepo';
import { salesRepo } from '../db/repositories/salesRepo';
import { customersRepo, customerPaymentsRepo } from '../db/repositories/customersRepo';
import { expensesRepo } from '../db/repositories/expensesRepo';
import { staffRepo, staffPrivateRepo, attendanceRepo } from '../db/repositories/staffRepo';
import { outboxRepo } from '../db/repositories/outboxRepo';

import type {
  InventoryItem, InventoryPrivate, Sale, Customer, CustomerPayment,
  Expense, Staff, StaffPrivate, Attendance,
} from '../lib/types';

// ─── SYNC STATUS ────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

class SyncWorkerEngine {
  private currentStatus: SyncStatus = 'idle';
  private statusListeners = new Set<(status: SyncStatus) => void>();
  private unsubscribers: Array<() => void> = [];
  private pushIntervalId: ReturnType<typeof setInterval> | null = null;
  private isOnline = true;
  private isPushing = false;

  get status() { return this.currentStatus; }

  onStatusChange(listener: (status: SyncStatus) => void) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(s: SyncStatus) {
    if (this.currentStatus === s) return;
    this.currentStatus = s;
    this.statusListeners.forEach(fn => fn(s));
  }

  private toEpoch(val: any): number {
    if (typeof val === 'number') return val;
    if (val?.toMillis) return val.toMillis();
    if (typeof val === 'string') return new Date(val).getTime();
    return Date.now();
  }

  async start() {
    this.stop();

    const net = await Network.getStatus();
    this.isOnline = net.connected;

    // Use dynamic import to prevent circular dependency with stores
    const { useAuthStore } = await import('../lib/useAuthStore');

    let currentShopId: string | null = null;

    const networkHandle = await Network.addListener('networkStatusChange', async (status) => {
      const wasOffline = !this.isOnline;
      this.isOnline = status.connected;
      if (status.connected) {
        this.setStatus('syncing');
        if (wasOffline && currentShopId) await this.drainQueue(currentShopId);
        this.setStatus('idle');
      } else {
        this.setStatus('offline');
      }
    });

    this.unsubscribers.push(() => networkHandle.remove());

    const unsubAuth = useAuthStore.subscribe(async (state) => {
      if (state.shopId && state.role && state.shopId !== currentShopId) {
        currentShopId = state.shopId;
        this.setStatus(this.isOnline ? 'syncing' : 'offline');
        
        await this.startPull(state.shopId, state.role);
        
        if (this.pushIntervalId) clearInterval(this.pushIntervalId);
        this.pushIntervalId = setInterval(async () => {
          if (this.isOnline && currentShopId) await this.drainQueue(currentShopId);
        }, 5000);

        if (this.isOnline) {
          await this.drainQueue(state.shopId);
          this.setStatus('idle');
        }
      } else if (!state.shopId && currentShopId) {
        currentShopId = null;
        if (this.pushIntervalId) clearInterval(this.pushIntervalId);
        this.pushIntervalId = null;
        // Keep network listener active but stop acting
        this.setStatus('idle');
      }
    });

    this.unsubscribers.push(unsubAuth);
  }

  stop() {
    for (const u of this.unsubscribers) { try { u(); } catch (_) {} }
    this.unsubscribers.length = 0;
    if (this.pushIntervalId) {
      clearInterval(this.pushIntervalId);
      this.pushIntervalId = null;
    }
    this.setStatus('idle');
  }

  // ─── PUSH: SQLite → Firestore ──────────────────────────────

  private async drainQueue(shopId: string) {
    if (this.isPushing) return;
    this.isPushing = true;

    try {
      // Get all outbox entries
      const entries = await outboxRepo.getAll();
      if (!entries.length) return;

      this.setStatus('syncing');
      const base = `shops/${shopId}`;

      // Chunk max 400 for Firestore batched writes
      const MAX_BATCH_SIZE = 400;
      for (let i = 0; i < entries.length; i += MAX_BATCH_SIZE) {
        const chunk = entries.slice(i, i + MAX_BATCH_SIZE);
        const batch = writeBatch(firestoreDb);
        const processedOpIds: string[] = [];

        for (const entry of chunk) {
          if (entry.retries >= 5) continue;
          
          try {
            const path = this.collectionPath(base, entry.entityType);
            const docRef = doc(firestoreDb, path, entry.entityId);

            if (entry.operation === 'DELETE') {
              batch.delete(docRef);
              processedOpIds.push(entry.opId);
            } else {
              const payload = JSON.parse(entry.payload);
              
              // ─── CRDT Stock Conflict Resolution ───
              if (entry.entityType === 'inventory' && payload.stockDelta !== undefined) {
                const delta = payload.stockDelta;
                delete payload.stockDelta; // Remove from absolute object
                
                // Only use increment for stock, do not push absolute 'stock'
                if ('stock' in payload) delete payload.stock; 
                payload.stock = increment(delta);
              }

              batch.set(docRef, payload, { merge: true });
              processedOpIds.push(entry.opId);
            }
          } catch (e) {
            console.error(`Invalid payload for ${entry.opId}:`, e);
            await outboxRepo.incrementRetries(entry.opId);
          }
        }

        // Commit chunk
        if (processedOpIds.length > 0) {
          await batch.commit();
          // Delete from queue upon success
          for (const opId of processedOpIds) {
            await outboxRepo.remove(opId);
          }
          // Update Sync State Last Push (Optional since we use queue clear as success)
          await Database.run(
            `INSERT OR REPLACE INTO sync_state (entity_type, last_synced_at) VALUES ('_lastPush', ?);`, 
            [Date.now()]
          );
        }
      }
    } catch (err: any) {
      console.error('[SyncWorker] Drain failed:', err);
      if (err?.code === 'unavailable' || err?.message?.includes('network')) {
        this.setStatus('offline');
      } else {
        this.setStatus('error');
      }
    } finally {
      this.isPushing = false;
      if (this.currentStatus === 'syncing') this.setStatus('idle');
    }
  }

  // ─── PULL: Firestore → SQLite ──────────────────────────────

  private async getWatermark(entityType: string): Promise<number> {
    const rows = await Database.query<{ last_synced_at: number }>(
      `SELECT last_synced_at FROM sync_state WHERE entity_type = ?`, [entityType]
    );
    // If no watermark, start from beginning (0) to get full state
    return rows[0]?.last_synced_at ?? 0;
  }

  private async updateWatermark(entityType: string, ts: number) {
    await Database.run(
      `INSERT OR REPLACE INTO sync_state (entity_type, last_synced_at) VALUES (?, ?);`,
      [entityType, ts]
    );
  }

  private async startPull(shopId: string, role: 'admin' | 'staff') {
    const base = `shops/${shopId}`;

    const collectionsToSubscribe = [
      { key: 'inventory', subCol: 'inventory' },
      { key: 'sales', subCol: 'sales' },
      { key: 'customers', subCol: 'customers' },
      { key: 'customer_payments', subCol: 'customer_payments' },
      { key: 'expenses', subCol: 'expenses' },
      { key: 'staff', subCol: 'staff' },
      { key: 'attendance', subCol: 'attendance' },
    ];

    if (role === 'admin') {
      collectionsToSubscribe.push({ key: 'inventory_private', subCol: 'inventory_private' });
      collectionsToSubscribe.push({ key: 'staff_private', subCol: 'staff_private' });
    }

    // Shop metadata is a single doc, no watermark query needed for one doc
    this.unsubscribers.push(
      onSnapshot(doc(firestoreDb, 'shops', shopId), async (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        const meta = { ...d.settings, name: d.name };
        if (meta.adminPin) delete meta.adminPin;
        if (meta.staffPin) delete meta.staffPin;
        await Database.run(
          `INSERT OR REPLACE INTO shop_metadata (key, value, updated_at, dirty) VALUES ('settings', ?, ?, 0);`,
          [JSON.stringify(meta), Date.now()],
        );
        tableEvents.emit('shop_metadata');
      })
    );

    // Subscribe to all standard collections
    for (const coll of collectionsToSubscribe) {
        // Fetch last sync time for this collection
        let watermark = await this.getWatermark(coll.key);

        // Limit sales to 100 on initial fetch if timestamp is 0 to avoid massive pulls
        // Actually, the prompt says `where('updatedAt', '>', sync_state.lastPullAt)`
        // For sales, we might load an entire huge collection if watermark is 0.
        let q = query(
          collection(firestoreDb, `${base}/${coll.subCol}`), 
          where('updatedAt', '>', watermark)
        );

        this.unsubscribers.push(
          onSnapshot(q, { includeMetadataChanges: true }, async (snap) => {
            // IGNORE local optimistic writes from the snapshot to prevent echo loops
            if (snap.metadata.hasPendingWrites) return;

            let latestSeenTimestamp = watermark;

            for (const ch of snap.docChanges()) {
              const d = ch.doc.data();
              const ts = this.toEpoch(d.updatedAt || d.createdAt || 0);
              
              const isTombstone = ch.type === 'removed' || d.tombstone === true;

              switch (coll.key) {
                case 'inventory': {
                  delete d.costPrice;
                  if (isTombstone) await Database.run('UPDATE inventory SET tombstone=1, updated_at=? WHERE id=? AND dirty=0;', [ts, ch.doc.id]);
                  else await inventoryRepo.mergeRemote({ id: ch.doc.id, ...d } as InventoryItem, ts);
                  break;
                }
                case 'inventory_private': {
                  await inventoryPrivateRepo.mergeRemote({ id: ch.doc.id, ...d } as InventoryPrivate, ts);
                  break;
                }
                case 'sales': {
                  if (isTombstone) await Database.run('UPDATE sales SET tombstone=1, updated_at=? WHERE id=? AND dirty=0;', [ts, ch.doc.id]);
                  else await salesRepo.mergeRemote({ id: ch.doc.id, ...d } as Sale, ts);
                  break;
                }
                case 'customers': {
                  if (isTombstone) await Database.run('UPDATE customers SET tombstone=1, updated_at=? WHERE id=? AND dirty=0;', [ts, ch.doc.id]);
                  else await customersRepo.mergeRemote({ id: ch.doc.id, ...d } as Customer, ts);
                  break;
                }
                case 'customer_payments': {
                  await customerPaymentsRepo.mergeRemote({ id: ch.doc.id, ...d } as CustomerPayment, ts);
                  break;
                }
                case 'expenses': {
                  if (isTombstone) await Database.run('UPDATE expenses SET tombstone=1, updated_at=? WHERE id=? AND dirty=0;', [ts, ch.doc.id]);
                  else await expensesRepo.mergeRemote({ id: ch.doc.id, ...d } as Expense, ts);
                  break;
                }
                case 'staff': {
                  delete d.salary; delete d.pin;
                  if (isTombstone) await staffRepo.hardDelete(ch.doc.id); // Or soft delete
                  else await staffRepo.mergeRemote({ id: ch.doc.id, ...d } as Staff, ts);
                  break;
                }
                case 'staff_private': {
                  await staffPrivateRepo.mergeRemote({ id: ch.doc.id, ...d } as StaffPrivate, ts);
                  break;
                }
                case 'attendance': {
                  // Prompt requirement: LWW logic
                  await attendanceRepo.mergeRemote({ id: ch.doc.id, ...d } as Attendance, ts);
                  break;
                }
              }

              if (ts > latestSeenTimestamp) {
                latestSeenTimestamp = ts;
              }
            }

            // After processing the snapshot chunk, update the watermark
            if (latestSeenTimestamp > watermark) {
              watermark = latestSeenTimestamp;
              await this.updateWatermark(coll.key, watermark);
            }

            // Emit to UI
            tableEvents.emit(coll.key);
            if (coll.key === 'sales') tableEvents.emit(['sale_items', 'sale_payments']);
          })
        );
    }
  }

  private collectionPath(base: string, entityType: string): string {
    const map: Record<string, string> = {
      inventory: `${base}/inventory`,
      inventory_private: `${base}/inventory_private`,
      sales: `${base}/sales`,
      customers: `${base}/customers`,
      customer_payments: `${base}/customer_payments`,
      expenses: `${base}/expenses`,
      staff: `${base}/staff`,
      staff_private: `${base}/staff_private`,
      attendance: `${base}/attendance`,
      shop: 'shops',
    };
    return map[entityType] || `${base}/${entityType}`;
  }
}

export const SyncWorker = new SyncWorkerEngine();
