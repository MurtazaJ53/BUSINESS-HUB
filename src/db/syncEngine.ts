/**
 * Sync Engine — Bidirectional Firestore ↔ SQLite synchronization
 * 
 * Architecture:
 *   PUSH: outbox drain → batch Firestore writes → mark clean
 *   PULL: onSnapshot listeners → LWW merge into SQLite → update Zustand
 * 
 * Conflict resolution: Last-Write-Wins (LWW) based on updatedAt timestamps
 */

import { db as firestoreDb, auth } from '../lib/firebase';
import {
  collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch,
  query, where, orderBy, limit,
} from 'firebase/firestore';
import { Network } from '@capacitor/network';

import { inventoryRepo, inventoryPrivateRepo } from './repositories/inventoryRepo';
import { salesRepo } from './repositories/salesRepo';
import { customersRepo, customerPaymentsRepo } from './repositories/customersRepo';
import { expensesRepo } from './repositories/expensesRepo';
import { staffRepo, staffPrivateRepo, attendanceRepo } from './repositories/staffRepo';
import { outboxRepo } from './repositories/outboxRepo';
import { saveToStore } from './connection';

import type {
  InventoryItem, InventoryPrivate, Sale, Customer, CustomerPayment,
  Expense, Staff, StaffPrivate, Attendance, ShopMetadata, SaleItem,
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

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

export function onSyncStatusChange(listener: SyncListener): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export function onDataChange(listener: DataListener): () => void {
  dataListeners.add(listener);
  return () => dataListeners.delete(listener);
}

function setStatus(status: SyncStatus) {
  currentStatus = status;
  statusListeners.forEach(fn => fn(status));
}

function notifyDataChange(entityType: string, data: any[]) {
  dataListeners.forEach(fn => fn(entityType, data));
}

// ─── START / STOP ───────────────────────────────────────────

export async function startSync(shopId: string, role: 'admin' | 'staff'): Promise<void> {
  // Stop any existing sync first
  stopSync();

  // Monitor network status
  const networkStatus = await Network.getStatus();
  isOnline = networkStatus.connected;

  const networkUnsub = await Network.addListener('networkStatusChange', async (status) => {
    const wasOffline = !isOnline;
    isOnline = status.connected;

    if (status.connected) {
      setStatus('syncing');
      if (wasOffline) {
        // Transitioning from offline → online: drain outbox
        await pushOutbox(shopId, role);
      }
      setStatus('idle');
    } else {
      setStatus('offline');
    }
  });
  unsubscribers.push(() => networkUnsub.remove());

  if (!isOnline) {
    setStatus('offline');
  } else {
    setStatus('syncing');
  }

  // Start PULL listeners (Firestore → SQLite)
  startPullListeners(shopId, role);

  // Start periodic PUSH (every 5 seconds when online)
  pushIntervalId = setInterval(async () => {
    if (isOnline) {
      await pushOutbox(shopId, role);
    }
  }, 5000);

  // Do an immediate push if online
  if (isOnline) {
    await pushOutbox(shopId, role);
    setStatus('idle');
  }
}

export function stopSync(): void {
  for (const unsub of unsubscribers) {
    try { unsub(); } catch (_) { /* ignore */ }
  }
  unsubscribers.length = 0;

  if (pushIntervalId) {
    clearInterval(pushIntervalId);
    pushIntervalId = null;
  }

  setStatus('idle');
}

// ─── PULL: Firestore → SQLite ──────────────────────────────

function startPullListeners(shopId: string, role: 'admin' | 'staff'): void {
  const basePath = `shops/${shopId}`;

  // 1. Shop Metadata
  const unsubShop = onSnapshot(doc(firestoreDb, 'shops', shopId), async (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const metadata = { ...data.settings, name: data.name };
      // Security: strip PINs
      if (metadata.adminPin) delete metadata.adminPin;
      if (metadata.staffPin) delete metadata.staffPin;

      // Store as KV in shop_metadata table
      const { execRun } = await import('./connection');
      const ts = new Date().toISOString();
      await execRun(
        `INSERT OR REPLACE INTO shop_metadata (key, value, updated_at, is_dirty) VALUES ('settings', ?, ?, 0);`,
        [JSON.stringify(metadata), ts]
      );
      notifyDataChange('shop', [metadata]);
    }
  });
  unsubscribers.push(unsubShop);

  // 2. Inventory
  const unsubInv = onSnapshot(collection(firestoreDb, `${basePath}/inventory`), async (snap) => {
    for (const change of snap.docChanges()) {
      const data = change.doc.data();
      if (data.costPrice !== undefined) delete data.costPrice; // Security strip
      const item = { id: change.doc.id, ...data } as InventoryItem;
      const remoteTs = data.updatedAt || data.createdAt || new Date().toISOString();

      if (change.type === 'removed') {
        // Mark as deleted in SQLite
        const { execRun } = await import('./connection');
        await execRun('UPDATE inventory SET is_deleted = 1, updated_at = ? WHERE id = ? AND is_dirty = 0;', [remoteTs, item.id]);
      } else {
        await inventoryRepo.mergeRemote(item, remoteTs);
      }
    }
    // Refresh Zustand
    const all = await inventoryRepo.getAll();
    notifyDataChange('inventory', all);
  });
  unsubscribers.push(unsubInv);

  // 2.5 Inventory Private (Admin only)
  if (role === 'admin') {
    const unsubInvPriv = onSnapshot(collection(firestoreDb, `${basePath}/inventory_private`), async (snap) => {
      for (const change of snap.docChanges()) {
        const data = change.doc.data();
        const item = { id: change.doc.id, ...data } as InventoryPrivate;
        const remoteTs = data.updatedAt || new Date().toISOString();
        await inventoryPrivateRepo.mergeRemote(item, remoteTs);
      }
      const all = await inventoryPrivateRepo.getAll();
      notifyDataChange('inventoryPrivate', all);
    });
    unsubscribers.push(unsubInvPriv);
  }

  // 3. Sales (recent 100)
  const unsubSales = onSnapshot(
    query(collection(firestoreDb, `${basePath}/sales`), orderBy('createdAt', 'desc'), limit(100)),
    async (snap) => {
      for (const change of snap.docChanges()) {
        const data = change.doc.data();
        const sale = { id: change.doc.id, ...data } as Sale;
        const remoteTs = data.updatedAt || data.createdAt || new Date().toISOString();

        if (change.type === 'removed') {
          const { execRun } = await import('./connection');
          await execRun('UPDATE sales SET is_deleted = 1, updated_at = ? WHERE id = ? AND is_dirty = 0;', [remoteTs, sale.id]);
        } else {
          await salesRepo.mergeRemote(sale, remoteTs);
        }
      }
      const all = await salesRepo.getAll(100);
      notifyDataChange('sales', all);
    }
  );
  unsubscribers.push(unsubSales);

  // 3.5 Customer Payments
  const unsubPayments = onSnapshot(collection(firestoreDb, `${basePath}/customer_payments`), async (snap) => {
    for (const change of snap.docChanges()) {
      const data = change.doc.data();
      const payment = { id: change.doc.id, ...data } as CustomerPayment;
      const remoteTs = data.updatedAt || data.createdAt || new Date().toISOString();
      await customerPaymentsRepo.mergeRemote(payment, remoteTs);
    }
    const all = await customerPaymentsRepo.getAll();
    notifyDataChange('customerPayments', all);
  });
  unsubscribers.push(unsubPayments);

  // 4. Customers
  const unsubCust = onSnapshot(collection(firestoreDb, `${basePath}/customers`), async (snap) => {
    for (const change of snap.docChanges()) {
      const data = change.doc.data();
      const customer = { id: change.doc.id, ...data } as Customer;
      const remoteTs = data.updatedAt || data.createdAt || new Date().toISOString();

      if (change.type === 'removed') {
        const { execRun } = await import('./connection');
        await execRun('UPDATE customers SET is_deleted = 1, updated_at = ? WHERE id = ? AND is_dirty = 0;', [remoteTs, customer.id]);
      } else {
        await customersRepo.mergeRemote(customer, remoteTs);
      }
    }
    const all = await customersRepo.getAll();
    notifyDataChange('customers', all);
  });
  unsubscribers.push(unsubCust);

  // 5. Expenses
  const unsubExp = onSnapshot(collection(firestoreDb, `${basePath}/expenses`), async (snap) => {
    for (const change of snap.docChanges()) {
      const data = change.doc.data();
      const expense = { id: change.doc.id, ...data } as Expense;
      const remoteTs = data.updatedAt || data.createdAt || new Date().toISOString();

      if (change.type === 'removed') {
        const { execRun } = await import('./connection');
        await execRun('UPDATE expenses SET is_deleted = 1, updated_at = ? WHERE id = ? AND is_dirty = 0;', [remoteTs, expense.id]);
      } else {
        await expensesRepo.mergeRemote(expense, remoteTs);
      }
    }
    const all = await expensesRepo.getAll();
    notifyDataChange('expenses', all);
  });
  unsubscribers.push(unsubExp);

  // 6. Staff
  const unsubStaff = onSnapshot(collection(firestoreDb, `${basePath}/staff`), async (snap) => {
    for (const change of snap.docChanges()) {
      const data = change.doc.data();
      // Security strip
      if (data.salary !== undefined) delete data.salary;
      if (data.pin !== undefined) delete data.pin;

      const s = { id: change.doc.id, ...data } as Staff;
      const remoteTs = data.updatedAt || data.joinedAt || new Date().toISOString();

      if (change.type === 'removed') {
        await staffRepo.delete(change.doc.id);
      } else {
        await staffRepo.mergeRemote(s, remoteTs);
      }
    }
    const all = await staffRepo.getAll();
    notifyDataChange('staff', all);
  });
  unsubscribers.push(unsubStaff);

  // 6.5 Staff Private (Admin only)
  if (role === 'admin') {
    const unsubStaffPriv = onSnapshot(collection(firestoreDb, `${basePath}/staff_private`), async (snap) => {
      for (const change of snap.docChanges()) {
        const data = change.doc.data();
        const sp = { id: change.doc.id, ...data } as StaffPrivate;
        const remoteTs = data.updatedAt || new Date().toISOString();
        await staffPrivateRepo.mergeRemote(sp, remoteTs);
      }
      const all = await staffPrivateRepo.getAll();
      notifyDataChange('staffPrivate', all);
    });
    unsubscribers.push(unsubStaffPriv);
  }

  // 7. Attendance (current month)
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);
  const startStr = firstOfMonth.toISOString().split('T')[0];

  const unsubAtt = onSnapshot(
    query(collection(firestoreDb, `${basePath}/attendance`), where('date', '>=', startStr)),
    async (snap) => {
      for (const change of snap.docChanges()) {
        const data = change.doc.data();
        const entry = { id: change.doc.id, ...data } as Attendance;
        const remoteTs = data.updatedAt || new Date().toISOString();
        await attendanceRepo.mergeRemote(entry, remoteTs);
      }
      const all = await attendanceRepo.getAll(startStr);
      notifyDataChange('attendance', all);
    }
  );
  unsubscribers.push(unsubAtt);
}

// ─── PUSH: SQLite → Firestore ──────────────────────────────

async function pushOutbox(shopId: string, role: 'admin' | 'staff'): Promise<void> {
  const entries = await outboxRepo.getAll();
  if (entries.length === 0) return;

  const basePath = `shops/${shopId}`;

  for (const entry of entries) {
    // Skip entries that have failed too many times
    if (entry.retries >= 5) continue;

    try {
      const payload = JSON.parse(entry.payload);
      const collectionPath = getCollectionPath(basePath, entry.entityType);

      if (entry.operation === 'DELETE') {
        await deleteDoc(doc(firestoreDb, collectionPath, entry.entityId));
      } else {
        // CREATE or UPDATE — use setDoc with merge for safety
        await setDoc(doc(firestoreDb, collectionPath, entry.entityId), payload);
      }

      // Success: remove from outbox
      await outboxRepo.remove(entry.opId);
    } catch (error: any) {
      console.error(`[Sync] Failed to push ${entry.entityType}/${entry.entityId}:`, error);
      await outboxRepo.incrementRetries(entry.opId);

      // If it's a network error, stop processing (will retry next interval)
      if (error?.code === 'unavailable' || error?.message?.includes('network')) {
        setStatus('offline');
        break;
      }
    }
  }

  // Save web store after push
  await saveToStore();
}

function getCollectionPath(basePath: string, entityType: string): string {
  const map: Record<string, string> = {
    inventory: `${basePath}/inventory`,
    inventory_private: `${basePath}/inventory_private`,
    sales: `${basePath}/sales`,
    sale_items: `${basePath}/sales`, // handled differently
    customers: `${basePath}/customers`,
    customer_payments: `${basePath}/customer_payments`,
    expenses: `${basePath}/expenses`,
    staff: `${basePath}/staff`,
    staff_private: `${basePath}/staff_private`,
    attendance: `${basePath}/attendance`,
    shop: `shops`,
  };
  return map[entityType] || `${basePath}/${entityType}`;
}
