/**
 * useBusinessStore — Enterprise Offline-First Architecture
 * * Optimized for local-first execution. 
 * UI state is managed in RAM (Zustand).
 * Entity data is persisted to SQLite via repositories.
 * Sync engine runs asynchronously in the background.
 */

import { create } from 'zustand';
import { auth } from './firebase';
import { Database } from '../db/sqlite';
import {
  inventoryRepo, inventoryPrivateRepo,
  salesRepo, customersRepo, customerPaymentsRepo,
  expensesRepo, staffRepo, staffPrivateRepo, attendanceRepo,
  outboxRepo,
} from '../db';
import { SyncWorker } from '../sync/SyncWorker';
import { tableEvents } from '../db/events';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

import type {
  InventoryItem, InventoryPrivate, Sale, Customer, ShopMetadata, ShopPrivate,
  Expense, Staff, StaffPrivate, Attendance, Invitation, CustomerPayment, SaleItem
} from './types';

// ─── CONFIGURATION ──────────────────────────────────────────

const SHOP_DEFAULTS: ShopMetadata = {
  name: 'Business Hub Pro',
  tagline: 'Intelligent Operations',
  address: '', phone: '', email: '', gst: '',
  footer: 'Thank you for your business! 😊',
  currency: 'INR',
  standardWorkingHours: 9,
  allowStaffAttendance: true,
};

const PRIVATE_DEFAULTS: ShopPrivate = {};
const DB_BOOT_TIMEOUT_MS = 15000;

// ─── UTILITIES ──────────────────────────────────────────────

/**
 * Centralized Sync Queue Helper
 * Guarantees consistent timestamping and eliminates JSON.stringify boilerplate.
 */
const enqueueSync = async (
  entityType: string, 
  entityId: string, 
  operation: 'CREATE' | 'UPDATE' | 'DELETE', 
  payload: Record<string, any> = {}
) => {
  const ts = Date.now();
  await outboxRepo.enqueue({
    opId: `${entityType}_${entityId}_${ts}`,
    entityType,
    entityId,
    operation,
    payload: operation === 'DELETE' ? '{}' : JSON.stringify({ ...payload, updatedAt: ts }),
    createdAt: ts
  });
  void SyncWorker.requestFlush();
};

const enqueueSyncMany = async (
  entries: Array<{
    entityType: string;
    entityId: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    payload?: Record<string, any>;
  }>,
) => {
  if (!entries.length) return;
  const ts = Date.now();
  await outboxRepo.enqueueMany(
    entries.map((entry, index) => ({
      opId: `${entry.entityType}_${entry.entityId}_${ts}_${index}`,
      entityType: entry.entityType,
      entityId: entry.entityId,
      operation: entry.operation,
      payload: entry.operation === 'DELETE' ? '{}' : JSON.stringify({ ...(entry.payload || {}), updatedAt: ts }),
      createdAt: ts + index,
    })),
  );
  void SyncWorker.requestFlush();
};

const getInventoryDeltaForSaleItem = (item: SaleItem): number => {
  if (item.itemId.startsWith('custom-') || item.itemId === 'payment-received') return 0;
  return item.isReturn ? item.quantity : -item.quantity;
};

const getInventoryDeltasForSale = (items: SaleItem[]): Record<string, number> => {
  return items.reduce<Record<string, number>>((acc, item) => {
    const delta = getInventoryDeltaForSaleItem(item);
    if (delta === 0) return acc;
    acc[item.itemId] = (acc[item.itemId] || 0) + delta;
    return acc;
  }, {});
};

// ─── STATE INTERFACE ────────────────────────────────────────

interface BusinessState {
  // 📦 UI State
  shop: ShopMetadata;
  shopPrivate: ShopPrivate;
  theme: 'dark' | 'light';
  activeTab: string;
  inventorySearchTerm: string;
  role: 'admin' | 'staff' | 'manager' | 'suspended' | null;
  shopId: string | null;
  lastBackupDate: string | null;
  invitations: Invitation[];
  currentStaff: Staff | null;
  dbReady: boolean;
  dbError: string | null;
  isLocked: boolean;
  sidebarOpen: boolean;

  // 🚀 Lifecycle & Navigation
  initStore: (shopId: string, role: 'admin' | 'staff' | 'manager' | 'suspended') => () => void;
  setRole: (role: 'admin' | 'staff' | 'manager' | 'suspended' | null, persistLock?: boolean) => void;
  logout: () => void;
  setActiveTab: (tab: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setInventorySearchTerm: (term: string) => void;
  updateShop: (data: Partial<ShopMetadata>) => Promise<void>;
  setLastBackupDate: (value: string | null) => void;
  setTheme: (theme: 'dark' | 'light') => void;

  // ⚡ Mutations (SQLite + Outbox Delegation)
  addInventoryItem: (item: InventoryItem & { costPrice?: number }) => Promise<void>;
  updateInventoryItem: (item: InventoryItem & { costPrice?: number }) => Promise<void>;
  updateStock: (id: string, delta: number) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  clearInventory: () => Promise<void>;
  
  addSale: (sale: Sale) => Promise<void>;
  importHistoricalSale: (sale: Sale) => Promise<void>;
  importHistoricalSalesBatch: (sales: Sale[]) => Promise<void>;
  updateSale: (sale: Sale) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  
  upsertCustomer: (customer: Customer) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  addCustomerPayment: (customerId: string, amount: number) => Promise<void>;
  rebuildCustomerTotalsFromSales: () => Promise<void>;
  
  addExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  
  restockItem: (id: string, newQty: number, newPurchasePrice: number) => Promise<void>;
  upsertStaff: (staff: Staff & { salary?: number; pin?: string }) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  recordAttendance: (entry: Attendance) => Promise<void>;
}

// ─── STORE IMPLEMENTATION ───────────────────────────────────

export const useBusinessStore = create<BusinessState>((set, get) => ({
  shop: SHOP_DEFAULTS,
  shopPrivate: PRIVATE_DEFAULTS,
  theme: (localStorage.getItem('hub_theme') as 'dark' | 'light') || 'dark',
  activeTab: 'dashboard',
  inventorySearchTerm: '',
  role: null,
  isLocked: localStorage.getItem('hub_is_locked') === 'true',
  shopId: null,
  lastBackupDate: null,
  invitations: [],
  currentStaff: null,
  dbReady: false,
  dbError: null,
  sidebarOpen: false,

  initStore: (shopId, role) => {
    const isLocked = localStorage.getItem('hub_is_locked') === 'true';
    const effectiveRole = (isLocked && role === 'admin') ? 'staff' : role;
    let isActive = true;
    let unsubStaff = () => {};
    
    set({ shopId, role: effectiveRole, isLocked, dbReady: false, dbError: null });

    const refreshCurrentStaff = async () => {
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) {
        if (isActive && get().shopId === shopId) set({ currentStaff: null });
        return;
      }

      const nextStaff = await staffRepo.getById(currentUid);
      if (isActive && get().shopId === shopId) {
        set({ currentStaff: nextStaff });
      }
    };

    let bootTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const bootTimeout = new Promise<void>((_, reject) => {
      bootTimeoutHandle = setTimeout(() => {
        reject(new Error('Database startup timed out on this device. Tap recovery to reset the local vault and reopen the app.'));
      }, DB_BOOT_TIMEOUT_MS);
    });

    Promise.race([Database.boot(), bootTimeout])
      .then(async () => {
        const [shopMeta] = await Promise.all([
          Database.query<{ value: string }>('SELECT value FROM shop_metadata WHERE key = ?;', ['settings']),
          Database.run('DELETE FROM shop_metadata WHERE key = ?;', ['credentials'])
        ]);

        let shopData = SHOP_DEFAULTS;
        let backupDate: string | null = null;

        if (shopMeta.length > 0) {
          try { shopData = { ...SHOP_DEFAULTS, ...JSON.parse(shopMeta[0].value) }; } catch (_) {}
        }
        const backupMeta = await Database.query<{ value: string }>('SELECT value FROM shop_metadata WHERE key = ?;', ['last_backup_at']);
        if (backupMeta.length > 0) {
          try { backupDate = JSON.parse(backupMeta[0].value)?.iso || null; } catch (_) {}
        }

        let currentStaffObj: Staff | null = null;
        if (auth.currentUser) {
          currentStaffObj = await staffRepo.getById(auth.currentUser.uid);
        }

        set({ 
          shop: shopData, 
          shopPrivate: PRIVATE_DEFAULTS,
          currentStaff: currentStaffObj, 
          dbReady: true,
          dbError: null,
          lastBackupDate: backupDate,
        });

        unsubStaff = tableEvents.on('staff', () => {
          void refreshCurrentStaff();
        });
        const unsubMeta = tableEvents.on('shop_metadata', async () => {
          const latestBackup = await Database.query<{ value: string }>('SELECT value FROM shop_metadata WHERE key = ?;', ['last_backup_at']);
          let nextBackupDate: string | null = null;
          if (latestBackup.length > 0) {
            try { nextBackupDate = JSON.parse(latestBackup[0].value)?.iso || null; } catch (_) {}
          }
          if (isActive && get().shopId === shopId) {
            set({ lastBackupDate: nextBackupDate });
          }
        });
        const priorUnsubStaff = unsubStaff;
        unsubStaff = () => {
          priorUnsubStaff();
          unsubMeta();
        };

        await SyncWorker.start();
      })
      .catch((err) => {
        console.error('[Store] Local Database Mount Failure:', err);
        if (isActive && get().shopId === shopId) {
          set({ dbReady: false, dbError: err.message || 'Storage engine unavailable.' });
        }
      })
      .finally(() => {
        if (bootTimeoutHandle) {
          clearTimeout(bootTimeoutHandle);
          bootTimeoutHandle = null;
        }
      });

    const inviteQuery = query(
      collection(db, `shops/${shopId}/invitations`),
      orderBy('createdAt', 'desc')
    );

    const unsubInv = onSnapshot(inviteQuery, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invitation));
      set({ invitations: docs });
    });

    return () => { 
      isActive = false;
      SyncWorker.stop(); 
      unsubStaff();
      unsubInv();
    };
  },

  setRole: (role, persistLock) => {
    if (persistLock !== undefined) {
      localStorage.setItem('hub_is_locked', persistLock ? 'true' : 'false');
      set({ role, isLocked: persistLock });
    } else {
      set({ role });
    }
  },

  logout: () => { 
    SyncWorker.stop(); 
    localStorage.removeItem('hub_is_locked');
    set({ role: null, shopId: null, dbReady: false, isLocked: false, currentStaff: null, invitations: [] }); 
  },

  setActiveTab: (tab) => set({ activeTab: tab, sidebarOpen: false }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setInventorySearchTerm: (term) => set({ inventorySearchTerm: term }),
  setLastBackupDate: (value) => set({ lastBackupDate: value }),

  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem('hub_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  },

  updateShop: async (data) => {
    const { shopId, shop } = get();
    if (!shopId) return;

    const ts = Date.now();
    const newShop = { ...shop, ...data };

    set({ shop: newShop });
    await Database.run('INSERT OR REPLACE INTO shop_metadata (key, value, updatedAt, dirty) VALUES (?, ?, ?, 1);', ['settings', JSON.stringify(newShop), ts]);
    tableEvents.emit('shop_metadata');

    await enqueueSync('shop', shopId, 'UPDATE', { 
      settings: data,
      name: data.name || shop.name 
    });
  },

  // ─── INVENTORY MUTATIONS ──────────────────────────────────

  addInventoryItem: async (item) => {
    const { shopId } = get(); if (!shopId) return;
    const { costPrice, ...pub } = item;
    
    await inventoryRepo.upsert(pub);
    await enqueueSync('inventory', item.id, 'CREATE', pub);

    if (costPrice !== undefined) {
      const p = { id: item.id, costPrice: Number(costPrice) };
      await inventoryPrivateRepo.upsert(p as InventoryPrivate);
      await enqueueSync('inventory_private', item.id, 'CREATE', p);
    }
  },

  updateInventoryItem: async (item) => {
    const { shopId } = get(); if (!shopId) return;
    const { costPrice, ...pub } = item;
    
    await inventoryRepo.upsert(pub);
    await enqueueSync('inventory', item.id, 'UPDATE', pub);

    if (costPrice !== undefined) {
      const p = { id: item.id, costPrice: Number(costPrice) };
      await inventoryPrivateRepo.upsert(p as InventoryPrivate);
      await enqueueSync('inventory_private', item.id, 'UPDATE', p);
    }
  },

  updateStock: async (id, delta) => {
    const { shopId } = get(); if (!shopId) return;
    await inventoryRepo.updateStock(id, delta);
    await enqueueSync('inventory', id, 'UPDATE', { stockDelta: delta });
  },

  deleteInventoryItem: async (id) => {
    const { shopId } = get(); if (!shopId) return;
    await Promise.all([
      inventoryRepo.softDelete(id),
      inventoryPrivateRepo.remove(id),
    ]);
    await Promise.all([
      enqueueSync('inventory', id, 'DELETE'),
      enqueueSync('inventory_private', id, 'DELETE'),
    ]);
  },

  clearInventory: async () => {
    const { shopId } = get(); if (!shopId) return;
    const all = await inventoryRepo.getAll();
    await inventoryRepo.clearAll();
    await Promise.all(all.map(item => inventoryPrivateRepo.remove(item.id)));

    // Prevent blocking the main thread by firing queue injections concurrently
    await Promise.all(
      all.flatMap(item => [
        enqueueSync('inventory', item.id, 'DELETE'),
        enqueueSync('inventory_private', item.id, 'DELETE'),
      ]),
    );
  },

  restockItem: async (id, newQty, newPurchasePrice) => {
    const { shopId } = get(); if (!shopId) return;
    
    const [currentItem, currentPriv] = await Promise.all([
      inventoryRepo.getById(id),
      inventoryPrivateRepo.getById(id)
    ]);
    
    if (!currentItem) return;

    const currentStock = currentItem.stock ?? 0;
    const currentCost = currentPriv?.costPrice ?? 0;
    const totalQuantity = currentStock + newQty;
    
    // Calculate Weighted Average Cost (WAC)
    const wac = totalQuantity > 0 
      ? ((currentStock * currentCost) + (newQty * newPurchasePrice)) / totalQuantity 
      : newPurchasePrice;

    const privData: InventoryPrivate = { 
      id, 
      costPrice: Number(wac.toFixed(2)), 
      lastPurchaseDate: new Date().toISOString().split('T')[0] 
    };

    await Promise.all([
      inventoryRepo.updateStock(id, newQty),
      inventoryPrivateRepo.upsert(privData)
    ]);

    const updatedItem = await inventoryRepo.getById(id);
    if (updatedItem) {
      await Promise.all([
        enqueueSync('inventory', id, 'UPDATE', updatedItem),
        enqueueSync('inventory_private', id, 'UPDATE', privData)
      ]);
    }
  },

  // ─── SALES MUTATIONS ──────────────────────────────────────

  addSale: async (sale) => {
    const { shopId } = get(); if (!shopId) return;
    
    const finalSale = { ...sale };
    const creditPayment = sale.payments.find(p => p.mode === 'CREDIT');
    const creditAmount = creditPayment ? creditPayment.amount : 0;

    // Concurrently verify customer existence and process stock reconciliation.
    await Promise.all(
      Object.entries(getInventoryDeltasForSale(finalSale.items)).map(async ([itemId, delta]) => {
        await inventoryRepo.updateStock(itemId, delta);
        return enqueueSync('inventory', itemId, 'UPDATE', { stockDelta: delta });
      }),
    );

    // Handle Customer Linkage & Balance
    if (creditAmount > 0 && finalSale.customerName && !finalSale.customerId) {
      const phoneToMatch = finalSale.customerPhone?.trim();
      const nameToMatch = finalSale.customerName?.trim().toLowerCase();
      const existing = await customersRepo.findByPhoneOrName(phoneToMatch, nameToMatch);

      if (existing) {
        finalSale.customerId = existing.id;
        await customersRepo.updateBalance(existing.id, finalSale.total, creditAmount);
        const updatedCust = await customersRepo.getById(existing.id);
        if (updatedCust) await enqueueSync('customers', existing.id, 'UPDATE', updatedCust);
      } else {
        const nid = `cust-${Date.now()}`;
        finalSale.customerId = nid;
        const nc: Customer = { 
          id: nid, name: finalSale.customerName, phone: finalSale.customerPhone || '-', 
          totalSpent: finalSale.total, balance: creditAmount, createdAt: new Date().toISOString() 
        };
        await customersRepo.upsert(nc);
        await enqueueSync('customers', nid, 'CREATE', nc);
      }
    } else if (finalSale.customerId) {
      await customersRepo.updateBalance(finalSale.customerId, finalSale.total, creditAmount);
      const updatedCust = await customersRepo.getById(finalSale.customerId);
      if (updatedCust) await enqueueSync('customers', finalSale.customerId, 'UPDATE', updatedCust);
    }

    await salesRepo.upsert(finalSale);
    await enqueueSync('sales', finalSale.id, 'CREATE', finalSale);
  },

  importHistoricalSale: async (sale) => {
    const { shopId } = get(); if (!shopId) return;
    const existing = await salesRepo.getById(sale.id);
    await salesRepo.upsert(sale);
    await enqueueSync('sales', sale.id, existing ? 'UPDATE' : 'CREATE', sale);
  },

  importHistoricalSalesBatch: async (sales) => {
    const { shopId } = get(); if (!shopId || !sales.length) return;
    await salesRepo.upsertMany(sales);
    await enqueueSyncMany(
      sales.map((sale) => ({
        entityType: 'sales',
        entityId: sale.id,
        operation: 'UPDATE',
        payload: sale,
      })),
    );
  },

  updateSale: async (newSale) => {
    const { shopId } = get(); if (!shopId) return;
    const oldSale = await salesRepo.getById(newSale.id);
    if (!oldSale) return;

    const oldDeltas = getInventoryDeltasForSale(oldSale.items);
    const newDeltas = getInventoryDeltasForSale(newSale.items);
    const itemIds = new Set([...Object.keys(oldDeltas), ...Object.keys(newDeltas)]);

    await Promise.all(
      Array.from(itemIds).map(async (itemId) => {
        const delta = (newDeltas[itemId] || 0) - (oldDeltas[itemId] || 0);
        if (delta === 0) return;
        await inventoryRepo.updateStock(itemId, delta);
        await enqueueSync('inventory', itemId, 'UPDATE', { stockDelta: delta });
      }),
    );

    // Reconcile customer balances
    const oldCredit = oldSale.payments.find(p => p.mode === 'CREDIT')?.amount || 0;
    const newCredit = newSale.payments.find(p => p.mode === 'CREDIT')?.amount || 0;
    
    if (oldSale.customerId === newSale.customerId && newSale.customerId) {
      await customersRepo.updateBalance(newSale.customerId, newSale.total - oldSale.total, newCredit - oldCredit);
    } else {
      if (oldSale.customerId) await customersRepo.updateBalance(oldSale.customerId, -oldSale.total, -oldCredit);
      if (newSale.customerId) await customersRepo.updateBalance(newSale.customerId, newSale.total, newCredit);
    }

    await Promise.all(
      Array.from(new Set([oldSale.customerId, newSale.customerId].filter(Boolean))).map(async (customerId) => {
        const updatedCustomer = await customersRepo.getById(customerId as string);
        if (updatedCustomer) {
          await enqueueSync('customers', updatedCustomer.id, 'UPDATE', updatedCustomer);
        }
      }),
    );

    await salesRepo.upsert(newSale);
    await enqueueSync('sales', newSale.id, 'UPDATE', newSale);
  },

  deleteSale: async (id) => {
    const { shopId } = get(); if (!shopId) return;
    const sale = await salesRepo.getById(id);
    if (!sale) return;
    
    const creditAmount = sale.payments.find(p => p.mode === 'CREDIT')?.amount || 0;
    
    await Promise.all(
      Object.entries(getInventoryDeltasForSale(sale.items)).map(async ([itemId, delta]) => {
        const reversalDelta = -delta;
        await inventoryRepo.updateStock(itemId, reversalDelta);
        await enqueueSync('inventory', itemId, 'UPDATE', { stockDelta: reversalDelta });
      }),
    );

    if (sale.customerId) {
      await customersRepo.updateBalance(sale.customerId, -sale.total, -creditAmount);
      const updatedCustomer = await customersRepo.getById(sale.customerId);
      if (updatedCustomer) {
        await enqueueSync('customers', sale.customerId, 'UPDATE', updatedCustomer);
      }
    }
    
    await salesRepo.softDelete(id);
    await enqueueSync('sales', id, 'DELETE');
  },

  // ─── ENTITY MUTATIONS ───────────────────────────────────────

  upsertCustomer: async (customer) => {
    const { shopId } = get(); if (!shopId) return;
    const exists = await customersRepo.getById(customer.id);
    await customersRepo.upsert(customer);
    await enqueueSync('customers', customer.id, exists ? 'UPDATE' : 'CREATE', customer);
  },

  deleteCustomer: async (id) => {
    const { shopId } = get(); if (!shopId) return;
    await customersRepo.softDelete(id);
    await enqueueSync('customers', id, 'DELETE');
  },

  addCustomerPayment: async (customerId, amount) => {
    const { shopId } = get(); if (!shopId) return;
    const paymentId = `PAY-${Date.now()}`;
    const payment: CustomerPayment = { 
      id: paymentId, customerId, amount, 
      date: new Date().toISOString().split('T')[0], 
      createdAt: new Date().toISOString() 
    };
    
    await Promise.all([
      customerPaymentsRepo.upsert(payment),
      customersRepo.updateBalance(customerId, 0, -amount)
    ]);

    await enqueueSync('customer_payments', paymentId, 'CREATE', payment);
    const updatedCust = await customersRepo.getById(customerId);
    if (updatedCust) await enqueueSync('customers', customerId, 'UPDATE', updatedCust);
  },

  rebuildCustomerTotalsFromSales: async () => {
    const { shopId } = get(); if (!shopId) return;
    const ts = Date.now();
    await Database.run(
      `UPDATE customers
         SET totalSpent = COALESCE((
           SELECT SUM(total)
           FROM sales
           WHERE sales.customerId = customers.id AND sales.tombstone = 0
         ), 0),
             updatedAt = ?,
             dirty = 1
       WHERE tombstone = 0;`,
      [ts],
    );
    tableEvents.emit('customers');

    const currentCustomers = await customersRepo.getAll();
    await enqueueSyncMany(
      currentCustomers.map((customer) => ({
        entityType: 'customers',
        entityId: customer.id,
        operation: 'UPDATE',
        payload: customer,
      })),
    );
  },

  addExpense: async (expense) => {
    const { shopId } = get(); if (!shopId) return;
    await expensesRepo.upsert(expense);
    await enqueueSync('expenses', expense.id, 'CREATE', expense);
  },

  deleteExpense: async (id) => {
    const { shopId } = get(); if (!shopId) return;
    await expensesRepo.softDelete(id);
    await enqueueSync('expenses', id, 'DELETE');
  },

  upsertStaff: async (staffMember) => {
    const { shopId } = get(); if (!shopId) return;
    const { salary, pin, ...publicData } = staffMember;
    
    const exists = await staffRepo.getById(staffMember.id);
    await staffRepo.upsert(publicData as Staff);
    await enqueueSync('staff', staffMember.id, exists ? 'UPDATE' : 'CREATE', publicData);

    if (salary !== undefined || pin !== undefined) {
      const priv: Partial<StaffPrivate> = { id: staffMember.id };
      if (salary !== undefined) priv.salary = Number(salary);
      if (pin !== undefined) priv.pin = pin;
      
      await staffPrivateRepo.upsert(priv as StaffPrivate);
      await enqueueSync('staff_private', staffMember.id, exists ? 'UPDATE' : 'CREATE', priv);
    }
  },

  deleteStaff: async (id) => {
    const { shopId } = get(); if (!shopId) return;
    const currentUid = auth.currentUser?.uid;
    if (id === currentUid) {
      throw new Error('You cannot remove the account that is currently signed in.');
    }

    const [targetStaff, allStaff] = await Promise.all([
      staffRepo.getById(id),
      staffRepo.getAll(),
    ]);

    if (targetStaff?.role === 'admin') {
      const remainingAdmins = allStaff.filter((staffMember) =>
        staffMember.id !== id && staffMember.role === 'admin' && staffMember.status === 'active',
      );
      if (remainingAdmins.length === 0) {
        throw new Error('At least one active admin must remain assigned to this workspace.');
      }
    }

    await Promise.all([
      staffRepo.remove(id),
      staffPrivateRepo.remove(id),
    ]);
    await Promise.all([
      enqueueSync('staff', id, 'DELETE'),
      enqueueSync('staff_private', id, 'DELETE'),
    ]);
  },

  recordAttendance: async (entry) => {
    const { shopId, shop } = get(); if (!shopId) return;
    const finalEntry = { ...entry };

    if (entry.clockIn && entry.clockOut) {
      try {
        const [inH, inM] = entry.clockIn.split(':').map(Number);
        const [outH, outM] = entry.clockOut.split(':').map(Number);
        const dur = (outH + outM / 60) - (inH + inM / 60);
        
        finalEntry.totalHours = Number(dur.toFixed(2));
        if (!finalEntry.status) {
          const std = shop.standardWorkingHours || 9;
          finalEntry.status = dur >= std ? 'PRESENT' : dur >= std / 2 ? 'HALF_DAY' : 'ABSENT';
        }
      } catch (_) {}
    }

    await attendanceRepo.upsert(finalEntry);
    await enqueueSync('attendance', finalEntry.id, 'UPDATE', finalEntry);
  },
}));
