/**
 * Sync Engine — Bidirectional Firestore ↔ SQLite synchronization
 *
 * PUSH: sync_queue drain → batch Firestore writes → mark clean
 * PULL: onSnapshot listeners → LWW merge into SQLite → update Zustand
 *
 * Conflict resolution: Last-Write-Wins (LWW) on ms-epoch updatedAt
 */

import { db as firestoreDb } from '../lib/firebase';
import {
  collection, doc, onSnapshot, setDoc, deleteDoc,
  query, where, orderBy, limit,
} from 'firebase/firestore';
import { Network } from '@capacitor/network';
import { Database } from './sqlite';

import { inventoryRepo, inventoryPrivateRepo } from './repositories/inventoryRepo';
import { salesRepo } from './repositories/salesRepo';
import { customersRepo, customerPaymentsRepo } from './repositories/customersRepo';
import { expensesRepo } from './repositories/expensesRepo';
import { staffRepo, staffPrivateRepo, attendanceRepo } from './repositories/staffRepo';
import { outboxRepo } from './repositories/outboxRepo';

import type {
  InventoryItem, InventoryPrivate, Sale, Customer, CustomerPayment,
  Expense, Staff, StaffPrivate, Attendance,
} from '../lib/types';

// ─── SYNC STATUS ────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

type SyncListener = (status: SyncStatus) => void;
type DataListener = (entityType: string, data: any[]) => void;

let currentStatus: SyncStatus = 'idle';
const statusListeners: Set<SyncListener> = new Set();
const dataListeners: Set<DataListener> = new Set();
const unsubscribers: Array<() => void> = [];
let pushIntervalId: ReturnType<typeof setInterval> | null = null;
let isOnline = true;

export function getSyncStatus(): SyncStatus { return currentStatus; }

export function onSyncStatusChange(listener: SyncListener): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export function onDataChange(listener: DataListener): () => void {
  dataListeners.add(listener);
  return () => dataListeners.delete(listener);
}

function setStatus(s: SyncStatus) {
  currentStatus = s;
  statusListeners.forEach(fn => fn(s));
}

function notify(entityType: string, data: any[]) {
  dataListeners.forEach(fn => fn(entityType, data));
}

/** Convert any Firestore timestamp-ish value to ms epoch number. */
function toEpoch(val: any): number {
  if (typeof val === 'number') return val;
  if (val?.toMillis) return val.toMillis();                   // Firestore Timestamp
  if (typeof val === 'string') return new Date(val).getTime();
  return Date.now();
}

// ─── START / STOP ───────────────────────────────────────────

export async function startSync(shopId: string, role: 'admin' | 'staff'): Promise<void> {
  stopSync();

  const net = await Network.getStatus();
  isOnline = net.connected;

  const handle = await Network.addListener('networkStatusChange', async (status) => {
    const wasOffline = !isOnline;
    isOnline = status.connected;
    if (status.connected) {
      setStatus('syncing');
      if (wasOffline) await pushAll(shopId, role);
      setStatus('idle');
    } else {
      setStatus('offline');
    }
  });
  unsubscribers.push(() => handle.remove());

  setStatus(isOnline ? 'syncing' : 'offline');

  // Start pull listeners
  startPull(shopId, role);

  // Periodic push every 5s when online
  pushIntervalId = setInterval(async () => {
    if (isOnline) await pushAll(shopId, role);
  }, 5000);

  if (isOnline) {
    await pushAll(shopId, role);
    setStatus('idle');
  }
}

export function stopSync(): void {
  for (const u of unsubscribers) { try { u(); } catch (_) { /* ignore */ } }
  unsubscribers.length = 0;
  if (pushIntervalId) { clearInterval(pushIntervalId); pushIntervalId = null; }
  setStatus('idle');
}

// ─── PULL: Firestore → SQLite ──────────────────────────────

function startPull(shopId: string, role: 'admin' | 'staff'): void {
  const base = `shops/${shopId}`;

  // Shop metadata
  unsubscribers.push(
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
      notify('shop', [meta]);
    }),
  );

  // Inventory
  unsubscribers.push(
    onSnapshot(collection(firestoreDb, `${base}/inventory`), async (snap) => {
      for (const ch of snap.docChanges()) {
        const d = ch.doc.data();
        if (d.costPrice !== undefined) delete d.costPrice;
        const item = { id: ch.doc.id, ...d } as InventoryItem;
        const ts = toEpoch(d.updatedAt || d.createdAt);
        if (ch.type === 'removed') {
          await Database.run('UPDATE inventory SET tombstone=1, updated_at=? WHERE id=? AND dirty=0;', [ts, item.id]);
        } else {
          await inventoryRepo.mergeRemote(item, ts);
        }
      }
      notify('inventory', await inventoryRepo.getAll());
    }),
  );

  // Inventory Private (admin)
  if (role === 'admin') {
    unsubscribers.push(
      onSnapshot(collection(firestoreDb, `${base}/inventory_private`), async (snap) => {
        for (const ch of snap.docChanges()) {
          const d = ch.doc.data();
          await inventoryPrivateRepo.mergeRemote({ id: ch.doc.id, ...d } as InventoryPrivate, toEpoch(d.updatedAt));
        }
        notify('inventoryPrivate', await inventoryPrivateRepo.getAll());
      }),
    );
  }

  // Sales
  unsubscribers.push(
    onSnapshot(
      query(collection(firestoreDb, `${base}/sales`), orderBy('createdAt', 'desc'), limit(100)),
      async (snap) => {
        for (const ch of snap.docChanges()) {
          const d = ch.doc.data();
          const sale = { id: ch.doc.id, ...d } as Sale;
          const ts = toEpoch(d.updatedAt || d.createdAt);
          if (ch.type === 'removed') {
            await Database.run('UPDATE sales SET tombstone=1, updated_at=? WHERE id=? AND dirty=0;', [ts, sale.id]);
          } else {
            await salesRepo.mergeRemote(sale, ts);
          }
        }
        notify('sales', await salesRepo.getAll(100));
      },
    ),
  );

  // Customer Payments
  unsubscribers.push(
    onSnapshot(collection(firestoreDb, `${base}/customer_payments`), async (snap) => {
      for (const ch of snap.docChanges()) {
        const d = ch.doc.data();
        await customerPaymentsRepo.mergeRemote({ id: ch.doc.id, ...d } as CustomerPayment, toEpoch(d.updatedAt || d.createdAt));
      }
      notify('customerPayments', await customerPaymentsRepo.getAll());
    }),
  );

  // Customers
  unsubscribers.push(
    onSnapshot(collection(firestoreDb, `${base}/customers`), async (snap) => {
      for (const ch of snap.docChanges()) {
        const d = ch.doc.data();
        const cust = { id: ch.doc.id, ...d } as Customer;
        const ts = toEpoch(d.updatedAt || d.createdAt);
        if (ch.type === 'removed') {
          await Database.run('UPDATE customers SET tombstone=1, updated_at=? WHERE id=? AND dirty=0;', [ts, cust.id]);
        } else {
          await customersRepo.mergeRemote(cust, ts);
        }
      }
      notify('customers', await customersRepo.getAll());
    }),
  );

  // Expenses
  unsubscribers.push(
    onSnapshot(collection(firestoreDb, `${base}/expenses`), async (snap) => {
      for (const ch of snap.docChanges()) {
        const d = ch.doc.data();
        const exp = { id: ch.doc.id, ...d } as Expense;
        const ts = toEpoch(d.updatedAt || d.createdAt);
        if (ch.type === 'removed') {
          await Database.run('UPDATE expenses SET tombstone=1, updated_at=? WHERE id=? AND dirty=0;', [ts, exp.id]);
        } else {
          await expensesRepo.mergeRemote(exp, ts);
        }
      }
      notify('expenses', await expensesRepo.getAll());
    }),
  );

  // Staff
  unsubscribers.push(
    onSnapshot(collection(firestoreDb, `${base}/staff`), async (snap) => {
      for (const ch of snap.docChanges()) {
        const d = ch.doc.data();
        if (d.salary !== undefined) delete d.salary;
        if (d.pin !== undefined) delete d.pin;
        const s = { id: ch.doc.id, ...d } as Staff;
        const ts = toEpoch(d.updatedAt || d.joinedAt);
        if (ch.type === 'removed') {
          await staffRepo.hardDelete(ch.doc.id);
        } else {
          await staffRepo.mergeRemote(s, ts);
        }
      }
      notify('staff', await staffRepo.getAll());
    }),
  );

  // Staff Private (admin)
  if (role === 'admin') {
    unsubscribers.push(
      onSnapshot(collection(firestoreDb, `${base}/staff_private`), async (snap) => {
        for (const ch of snap.docChanges()) {
          const d = ch.doc.data();
          await staffPrivateRepo.mergeRemote({ id: ch.doc.id, ...d } as StaffPrivate, toEpoch(d.updatedAt));
        }
        notify('staffPrivate', await staffPrivateRepo.getAll());
      }),
    );
  }

  // Attendance (current month)
  const fom = new Date();
  fom.setDate(1); fom.setHours(0, 0, 0, 0);
  const dateStr = fom.toISOString().split('T')[0];

  unsubscribers.push(
    onSnapshot(
      query(collection(firestoreDb, `${base}/attendance`), where('date', '>=', dateStr)),
      async (snap) => {
        for (const ch of snap.docChanges()) {
          const d = ch.doc.data();
          await attendanceRepo.mergeRemote({ id: ch.doc.id, ...d } as Attendance, toEpoch(d.updatedAt));
        }
        notify('attendance', await attendanceRepo.getAll(dateStr));
      },
    ),
  );
}

// ─── PUSH: SQLite → Firestore ──────────────────────────────

async function pushAll(shopId: string, _role: 'admin' | 'staff'): Promise<void> {
  const entries = await outboxRepo.getAll();
  if (!entries.length) return;

  const base = `shops/${shopId}`;

  for (const entry of entries) {
    if (entry.retries >= 5) continue;
    try {
      const payload = JSON.parse(entry.payload);
      const path = collectionPath(base, entry.entityType);

      if (entry.operation === 'DELETE') {
        await deleteDoc(doc(firestoreDb, path, entry.entityId));
      } else {
        await setDoc(doc(firestoreDb, path, entry.entityId), payload);
      }
      await outboxRepo.remove(entry.opId);
    } catch (err: any) {
      console.error(`[Sync] Push failed ${entry.entityType}/${entry.entityId}:`, err);
      await outboxRepo.incrementRetries(entry.opId);
      if (err?.code === 'unavailable' || err?.message?.includes('network')) {
        setStatus('offline');
        break;
      }
    }
  }

  await Database.flush();
}

function collectionPath(base: string, entityType: string): string {
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
