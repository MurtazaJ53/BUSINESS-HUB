/**
 * SyncWorker — Enterprise Background Sync Engine
 * * Optimized for high-throughput offline-first capabilities.
 * Implements Network Debouncing, UI Thread Preservation, and Atomic Pushes.
 */

import { db as firestoreDb } from '../lib/firebase';
import {
  collection, doc, onSnapshot, writeBatch, increment,
  query, where, Unsubscribe
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

import type { AppRole } from '../lib/useAuthStore';

// ─── TYPES & CONFIG ─────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'backoff';

const CONFIG = {
  BATCH_LIMIT: 400,          // Firestore maximum is 500
  PUSH_INTERVAL_MS: 1500,
  NETWORK_DEBOUNCE_MS: 2000, // Prevent thrashing on unstable cell connections
  MAX_RETRIES: 5
};

class SyncWorkerEngine {
  private currentStatus: SyncStatus = 'idle';
  private statusListeners = new Set<(status: SyncStatus) => void>();
  private unsubscribers: Unsubscribe[] = [];
  private pullUnsubscribers: Unsubscribe[] = [];
  
  private pushIntervalId: ReturnType<typeof setInterval> | null = null;
  private networkTimeoutId: ReturnType<typeof setTimeout> | null = null;
  
  private isOnline = true;
  private isPushing = false;
  private currentShopId: string | null = null;
  private currentRole: AppRole = null;

  get status() { return this.currentStatus; }

  onStatusChange(listener: (status: SyncStatus) => void) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  async requestFlush(shopId = this.currentShopId) {
    if (!shopId || !this.isOnline || this.isPushing) return;
    await this.drainQueue(shopId);
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

  // ─── LIFECYCLE ────────────────────────────────────────────

  async start() {
    this.stop();

    const net = await Network.getStatus();
    this.isOnline = net.connected;

    // Dynamic import to prevent circular state dependencies
    const { useAuthStore } = await import('../lib/useAuthStore');
    // 1. Debounced Network Listener
    const networkHandle = await Network.addListener('networkStatusChange', (status) => {
      if (this.networkTimeoutId) clearTimeout(this.networkTimeoutId);
      
      this.networkTimeoutId = setTimeout(async () => {
        const wasOffline = !this.isOnline;
        this.isOnline = status.connected;
        
        if (status.connected) {
          this.setStatus('syncing');
          if (wasOffline && this.currentShopId) await this.drainQueue(this.currentShopId);
          this.setStatus('idle');
        } else {
          this.setStatus('offline');
        }
      }, CONFIG.NETWORK_DEBOUNCE_MS);
    });

    this.unsubscribers.push(() => networkHandle.remove());

    // 2. Auth State Reactor
    const unsubAuth = useAuthStore.subscribe(async (state) => {
      if (state.shopId && state.role && (state.shopId !== this.currentShopId || state.role !== this.currentRole)) {
        this.currentShopId = state.shopId;
        this.currentRole = state.role;
        this.setStatus(this.isOnline ? 'syncing' : 'offline');
        
        await this.startPull(state.shopId, state.role);
        
        if (this.pushIntervalId) clearInterval(this.pushIntervalId);
        this.pushIntervalId = setInterval(async () => {
          if (this.isOnline && this.currentShopId) await this.drainQueue(this.currentShopId);
        }, CONFIG.PUSH_INTERVAL_MS);

        if (this.isOnline) {
          await this.drainQueue(state.shopId);
          this.setStatus('idle');
        }
      } else if (!state.shopId && this.currentShopId) {
        // Logout sequence
        this.currentShopId = null;
        this.currentRole = null;
        if (this.pushIntervalId) clearInterval(this.pushIntervalId);
        this.pushIntervalId = null;
        this.stop(); 
      }
    });

    this.unsubscribers.push(unsubAuth);
  }

  stop() {
    this.stopPull();

    for (const unsub of this.unsubscribers) { 
      try { unsub(); } catch (e) { console.warn('Unsubscribe failed', e); } 
    }
    this.unsubscribers.length = 0;
    
    if (this.pushIntervalId) clearInterval(this.pushIntervalId);
    if (this.networkTimeoutId) clearTimeout(this.networkTimeoutId);
    
    this.pushIntervalId = null;
    this.networkTimeoutId = null;
    this.currentShopId = null;
    this.currentRole = null;
    this.setStatus('idle');
  }

  private stopPull() {
    for (const unsub of this.pullUnsubscribers) {
      try { unsub(); } catch (e) { console.warn('Pull unsubscribe failed', e); }
    }
    this.pullUnsubscribers.length = 0;
  }

  // ─── PUSH: OUTBOX TO FIRESTORE ────────────────────────────

  private async drainQueue(shopId: string) {
    if (this.isPushing || !this.isOnline) return;
    this.isPushing = true;

    try {
      const entries = await outboxRepo.getAll();
      if (!entries.length) return;

      this.setStatus('syncing');
      const base = `shops/${shopId}`;

      // Chunk processing to respect Firestore batch limits
      for (let i = 0; i < entries.length; i += CONFIG.BATCH_LIMIT) {
        const chunk = entries.slice(i, i + CONFIG.BATCH_LIMIT);
        const batch = writeBatch(firestoreDb);
        const processedOpIds: string[] = [];

        for (const entry of chunk) {
          if (entry.retries >= CONFIG.MAX_RETRIES) {
            console.warn(`[Sync] Operation ${entry.opId} exceeded max retries. Moving to dead-letter.`);
            continue; // In a full ERP, you'd move this to a DLQ table
          }
          
          try {
            const path = this.collectionPath(base, entry.entityType);
            const docRef = doc(firestoreDb, path, entry.entityId);

            if (entry.operation === 'DELETE') {
              batch.delete(docRef);
              processedOpIds.push(entry.opId);
            } else {
              const payload = JSON.parse(entry.payload);
              
              // CRDT Resolution: Transform delta to array-safe Firestore increment
              if (entry.entityType === 'inventory' && payload.stockDelta !== undefined) {
                const delta = payload.stockDelta;
                delete payload.stockDelta;
                if ('stock' in payload) delete payload.stock; 
                payload.stock = increment(delta);
              }

              batch.set(docRef, payload, { merge: true });
              processedOpIds.push(entry.opId);
            }
          } catch (parseError) {
            console.error(`[Sync] Malformed payload for ${entry.opId}:`, parseError);
            await outboxRepo.incrementRetries(entry.opId);
          }
        }

        if (processedOpIds.length > 0) {
          await batch.commit();
          // Atomic cleanup
          await Promise.all(processedOpIds.map(opId => outboxRepo.remove(opId)));
          
          await Database.run(
            `INSERT OR REPLACE INTO sync_state (entityType, lastSyncedAt) VALUES ('_lastPush', ?);`, 
            [Date.now()]
          );
        }
      }
    } catch (err: any) {
      console.error('[Sync] Drain failed:', err);
      if (err?.code === 'unavailable' || err?.message?.includes('network')) {
        this.setStatus('offline');
      } else {
        this.setStatus('backoff');
      }
    } finally {
      this.isPushing = false;
      if (this.currentStatus === 'syncing') this.setStatus('idle');
    }
  }

  // ─── PULL: FIRESTORE TO SQLITE ────────────────────────────

  private async getWatermark(entityType: string): Promise<number> {
    const rows = await Database.query<{ lastSyncedAt: number }>(
      `SELECT lastSyncedAt FROM sync_state WHERE entityType = ?`, [entityType]
    );
    return rows[0]?.lastSyncedAt ?? 0;
  }

  private async updateWatermark(entityType: string, ts: number) {
    await Database.run(
      `INSERT OR REPLACE INTO sync_state (entityType, lastSyncedAt) VALUES (?, ?);`,
      [entityType, ts]
    );
  }

  private async startPull(shopId: string, role: AppRole) {
    this.stopPull();
    const base = `shops/${shopId}`;

    const collections = [
      { key: 'inventory', subCol: 'inventory', repo: inventoryRepo },
      { key: 'sales', subCol: 'sales', repo: salesRepo },
      { key: 'customers', subCol: 'customers', repo: customersRepo },
      { key: 'customer_payments', subCol: 'customer_payments', repo: customerPaymentsRepo },
      { key: 'expenses', subCol: 'expenses', repo: expensesRepo },
      { key: 'staff', subCol: 'staff', repo: staffRepo },
      { key: 'attendance', subCol: 'attendance', repo: attendanceRepo },
    ];

    if (role === 'admin') {
      collections.push({ key: 'inventory_private', subCol: 'inventory_private', repo: inventoryPrivateRepo as any });
      collections.push({ key: 'staff_private', subCol: 'staff_private', repo: staffPrivateRepo as any });
    }

    // 1. Meta Subscription
    this.pullUnsubscribers.push(
      onSnapshot(doc(firestoreDb, 'shops', shopId), async (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const settings = { ...data.settings, name: data.name };
        
        // Strip sensitive fields before local caching in general settings
        delete settings.adminPin; 
        delete settings.staffPin;

        await Database.run(`DELETE FROM shop_metadata WHERE key = 'credentials';`);

        await Database.run(
          `INSERT OR REPLACE INTO shop_metadata (key, value, updatedAt, dirty) VALUES ('settings', ?, ?, 0);`,
          [JSON.stringify(settings), Date.now()]
        );
        tableEvents.emit('shop_metadata');
      })
    );

    // 2. Collection Subscriptions
    for (const coll of collections) {
      let watermark = await this.getWatermark(coll.key);
      const collRef = collection(firestoreDb, `${base}/${coll.subCol}`);
      const q = (watermark === 0 || coll.key === 'staff' || coll.key === 'staff_private')
        ? query(collRef)
        : query(collRef, where('updatedAt', '>', watermark));

      this.pullUnsubscribers.push(
        onSnapshot(q, { includeMetadataChanges: true }, async (snap) => {
          let latestSeenTimestamp = watermark;
          let hasChanges = false;

          // Group promises to prevent blocking the UI thread on large initial pulls
          const writePromises: Promise<any>[] = [];

          for (const ch of snap.docChanges()) {
            if (ch.doc.metadata.hasPendingWrites) continue;

            hasChanges = true;
            const d = ch.doc.data();
            const ts = this.toEpoch(d.updatedAt || d.createdAt || 0);
            const isTombstone = ch.type === 'removed' || d.tombstone === true;

            // Secure Payload Stripping
            if (coll.key === 'inventory') delete d.costPrice;
            if (coll.key === 'staff') { delete d.salary; delete d.pin; }

            if (isTombstone) {
              writePromises.push(
                coll.key === 'staff' 
                  ? staffRepo.hardDelete(ch.doc.id)
                  : Database.run(`UPDATE ${coll.key} SET tombstone=1, updatedAt=? WHERE id=? AND dirty=0;`, [ts, ch.doc.id])
              );
            } else {
              writePromises.push(coll.repo.mergeRemote({ id: ch.doc.id, ...d } as any, ts));
            }

            if (ts > latestSeenTimestamp) latestSeenTimestamp = ts;
          }

          if (hasChanges) {
            // Await all local SQLite transactions concurrently
            await Promise.all(writePromises);
            
            if (latestSeenTimestamp > watermark) {
              watermark = latestSeenTimestamp; // Update local memory watermark
              await this.updateWatermark(coll.key, latestSeenTimestamp);
            }

            // Throttled UI Event Emission (Fires ONCE per snapshot, not per document)
            tableEvents.emit(coll.key);
            if (coll.key === 'sales') tableEvents.emit(['sale_items', 'sale_payments']);
          }
        })
      );
    }
  }

  private collectionPath(base: string, entityType: string): string {
    const map: Record<string, string> = {
      shop: 'shops',
    };
    return map[entityType] || `${base}/${entityType}`;
  }
}

export const SyncWorker = new SyncWorkerEngine();
