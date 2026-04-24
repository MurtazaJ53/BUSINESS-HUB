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

const PRIVATE_DEFAULTS: ShopPrivate = {
  adminPin: '5253',
  staffPin: '1234',
};

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
  updateShop: (data: Partial<ShopMetadata & ShopPrivate>) => Promise<void>;
  setTheme: (theme: 'dark' | 'light') => void;

  // ⚡ Mutations (SQLite + Outbox Delegation)
  addInventoryItem: (item: InventoryItem & { costPrice?: number }) => Promise<void>;
  updateInventoryItem: (item: InventoryItem & { costPrice?: number }) => Promise<void>;
  updateStock: (id: string, delta: number) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  clearInventory: () => Promise<void>;
  
  addSale: (sale: Sale) => Promise<void>;
  updateSale: (sale: Sale) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  
  upsertCustomer: (customer: Customer) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  addCustomerPayment: (customerId: string, amount: number) => Promise<void>;
  
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
    
    set({ shopId, role: effectiveRole, isLocked });

    Database.boot()
      .then(async () => {
        const [shopMeta, privateMeta] = await Promise.all([
          Database.query<{ value: string }>('SELECT value FROM shop_metadata WHERE key = ?;', ['settings']),
          Database.query<{ value: string }>('SELECT value FROM shop_metadata WHERE key = ?;', ['credentials'])
        ]);

        let shopData = SHOP_DEFAULTS;
        let privateData = PRIVATE_DEFAULTS;

        if (shopMeta.length > 0) {
          try { shopData = { ...SHOP_DEFAULTS, ...JSON.parse(shopMeta[0].value) }; } catch (_) {}
        }
        if (privateMeta.length > 0) {
          try { privateData = { ...PRIVATE_DEFAULTS, ...JSON.parse(privateMeta[0].value) }; } catch (_) {}
        }

        let currentStaffObj: Staff | null = null;
        if (auth.currentUser) {
          currentStaffObj = await staffRepo.getById(auth.currentUser.uid);
        }

        set({ 
          shop: shopData, 
          shopPrivate: privateData,
          currentStaff: currentStaffObj, 
          dbReady: true,
          dbError: null
        });

        await SyncWorker.start();
      })
      .catch((err) => {
        console.error('[Store] Local Database Mount Failure:', err);
        set({ dbReady: false, dbError: err.message || 'Storage engine unavailable.' });
      });

    return () => { SyncWorker.stop(); };
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
    set({ role: null, shopId: null, dbReady: false, isLocked: false, currentStaff: null }); 
  },

  setActiveTab: (tab) => set({ activeTab: tab, sidebarOpen: false }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setInventorySearchTerm: (term) => set({ inventorySearchTerm: term }),

  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem('hub_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  },

  updateShop: async (data) => {
    const { shopId, shop, shopPrivate } = get();
    if (!shopId) return;

    const { adminPin, staffPin, ...metadata } = data;
    const ts = Date.now();
    const newShop = { ...shop, ...metadata };

    set({ shop: newShop });
    await Database.run('INSERT OR REPLACE INTO shop_metadata (key, value, updated_at, dirty) VALUES (?, ?, ?, 1);', ['settings', JSON.stringify(newShop), ts]);

    if (adminPin || staffPin) {
      const newPrivate = { ...shopPrivate, ...(adminPin && { adminPin }), ...(staffPin && { staffPin }) };
      set({ shopPrivate: newPrivate });
      await Database.run('INSERT OR REPLACE INTO shop_metadata (key, value, updated_at, dirty) VALUES (?, ?, ?, 1);', ['credentials', JSON.stringify(newPrivate), ts]);
    }

    await enqueueSync('shop', shopId, 'UPDATE', { 
      settings: metadata, 
      adminPin, 
      staffPin,
      name: metadata.name || shop.name 
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
    await inventoryRepo.softDelete(id);
    await enqueueSync('inventory', id, 'DELETE');
  },

  clearInventory: async () => {
    const { shopId } = get(); if (!shopId) return;
    const all = await inventoryRepo.getAll();
    await inventoryRepo.clearAll();

    // Prevent blocking the main thread by firing queue injections concurrently
    await Promise.all(all.map(item => enqueueSync('inventory', item.id, 'DELETE')));
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

    // Concurrently verify customer existence and process stock reduction
    const [custs] = await Promise.all([
      customersRepo.getAll(),
      ...finalSale.items
        .filter(item => !item.itemId.startsWith('custom-') && item.itemId !== 'payment-received')
        .map(async item => {
          await inventoryRepo.updateStock(item.itemId, -item.quantity);
          return enqueueSync('inventory', item.itemId, 'UPDATE', { stockDelta: -item.quantity });
        })
    ]);

    // Handle Customer Linkage & Balance
    if (creditAmount > 0 && finalSale.customerName && !finalSale.customerId) {
      const phoneToMatch = finalSale.customerPhone?.trim();
      const nameToMatch = finalSale.customerName?.trim().toLowerCase();
      const existing = custs.find(c => 
        (phoneToMatch && c.phone === phoneToMatch) || 
        (nameToMatch && c.name.toLowerCase() === nameToMatch)
      );

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

  updateSale: async (newSale) => {
    const { shopId } = get(); if (!shopId) return;
    const oldSale = await salesRepo.getById(newSale.id);
    if (!oldSale) return;

    const itemIds = new Set([
      ...oldSale.items.map(i => i.itemId), 
      ...newSale.items.map(i => i.itemId)
    ]);

    // Concurrently process all stock reconciliations
    const stockPromises = Array.from(itemIds).map(async (itemId) => {
      if (itemId.startsWith('custom-') || itemId === 'payment-received') return;
      const oldQty = oldSale.items.find(i => i.itemId === itemId)?.quantity || 0;
      const newQty = newSale.items.find(i => i.itemId === itemId)?.quantity || 0;
      const delta = -(newQty - oldQty);
      
      if (delta !== 0) {
        await inventoryRepo.updateStock(itemId, delta);
        await enqueueSync('inventory', itemId, 'UPDATE', { stockDelta: delta });
      }
    });

    await Promise.all(stockPromises);

    // Reconcile customer balances
    const oldCredit = oldSale.payments.find(p => p.mode === 'CREDIT')?.amount || 0;
    const newCredit = newSale.payments.find(p => p.mode === 'CREDIT')?.amount || 0;
    
    if (oldSale.customerId === newSale.customerId && newSale.customerId) {
      await customersRepo.updateBalance(newSale.customerId, newSale.total - oldSale.total, newCredit - oldCredit);
    } else {
      if (oldSale.customerId) await customersRepo.updateBalance(oldSale.customerId, -oldSale.total, -oldCredit);
      if (newSale.customerId) await customersRepo.updateBalance(newSale.customerId, newSale.total, newCredit);
    }

    await salesRepo.upsert(newSale);
    await enqueueSync('sales', newSale.id, 'UPDATE', newSale);
  },

  deleteSale: async (id) => {
    const { shopId } = get(); if (!shopId) return;
    const sale = await salesRepo.getById(id);
    if (!sale) return;
    
    const creditAmount = sale.payments.find(p => p.mode === 'CREDIT')?.amount || 0;
    
    // Concurrently restore all inventory stock
    await Promise.all(sale.items.map(async (item) => {
      if (!item.itemId.startsWith('custom-') && item.itemId !== 'payment-received') {
        await inventoryRepo.updateStock(item.itemId, item.quantity);
        await enqueueSync('inventory', item.itemId, 'UPDATE', { stockDelta: item.quantity });
      }
    }));

    if (sale.customerId) {
      await customersRepo.updateBalance(sale.customerId, -sale.total, -creditAmount);
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
    await staffRepo.remove(id);
    await enqueueSync('staff', id, 'DELETE');
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
