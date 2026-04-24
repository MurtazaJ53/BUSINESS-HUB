/**
 * useBusinessStore — Phase 0.5 Lean Architecture
 *
 * ONLY UI state lives here: currentStaff, role, shop metadata, theme, active tab,
 * search terms, modal toggles, and thin action wrappers that delegate to repos.
 *
 * Entity data (inventory, sales, customers, etc.) is fetched via useSqlQuery/useLiveQuery
 * directly in the pages that need them. The sync engine runs independently.
 */

import type {
  InventoryItem, InventoryPrivate, Sale, Customer, ShopMetadata, ShopPrivate,
  Expense, Staff, StaffPrivate, Attendance, Invitation, CustomerPayment, SaleItem
} from './types';
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

const SHOP_DEFAULTS: ShopMetadata = {
  name: 'Business Hub Pro',
  tagline: 'Elite Shop Management',
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

// ─── STATE INTERFACE ─────────────────────────────────────────

interface BusinessState {
  // UI-only state
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

  // Lifecycle
  initStore: (shopId: string, role: 'admin' | 'staff' | 'manager' | 'suspended') => () => void;
  setRole: (role: 'admin' | 'staff' | 'manager' | 'suspended' | null, persistLock?: boolean) => void;
  logout: () => void;

  // Navigation
  setActiveTab: (tab: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setInventorySearchTerm: (term: string) => void;

  // Shop & Theme
  updateShop: (data: Partial<ShopMetadata & ShopPrivate>) => Promise<void>;
  setTheme: (theme: 'dark' | 'light') => void;

  // Thin action wrappers (delegate to repos + outbox)
  addInventoryItem: (item: InventoryItem) => Promise<void>;
  updateInventoryItem: (item: InventoryItem) => Promise<void>;
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
  upsertStaff: (staff: Staff) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  recordAttendance: (entry: Attendance) => Promise<void>;
}

// ─── STORE ──────────────────────────────────────────────────

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
    // SECURITY: Use the staff role if manually locked, otherwise use the claim role
    const isLocked = localStorage.getItem('hub_is_locked') === 'true';
    const effectiveRole = (isLocked && role === 'admin') ? 'staff' : role;
    
    set({ shopId, role: effectiveRole, isLocked });

    Database.boot()
      .then(async () => {
        // Load shop metadata from SQLite
        const shopMeta = await Database.query<{ value: string }>(
          'SELECT value FROM shop_metadata WHERE key = ?;', ['settings']
        );
        let shopData = SHOP_DEFAULTS;
        if (shopMeta.length > 0) {
          try { shopData = { ...SHOP_DEFAULTS, ...JSON.parse(shopMeta[0].value) }; } catch (_) {}
        }

        // Load private credentials if they exist
        const privateMeta = await Database.query<{ value: string }>(
          'SELECT value FROM shop_metadata WHERE key = ?;', ['credentials']
        );
        let privateData = PRIVATE_DEFAULTS;
        if (privateMeta.length > 0) {
          try { privateData = { ...PRIVATE_DEFAULTS, ...JSON.parse(privateMeta[0].value) }; } catch (_) {}
        }

        // Resolve current staff (Required for permission checks)
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

        // Start sync engine ONLY on success
        await SyncWorker.start();
      })
      .catch((err) => {
        console.error('[Store] DB boot failed:', err);
        set({ dbReady: false, dbError: err.message || 'Database connection failed.' });
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
    set({ role: null, shopId: null, dbReady: false, isLocked: false }); 
  },
  setActiveTab: (tab) => set({ activeTab: tab, sidebarOpen: false }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setInventorySearchTerm: (term) => set({ inventorySearchTerm: term }),

  // ─── SHOP ─────
  updateShop: async (data) => {
    const { shopId, shop, shopPrivate } = get();
    if (!shopId) return;

    const { adminPin, staffPin, ...metadata } = data as any;
    const ts = Date.now();

    // 1. Update Public Metadata
    const newShop = { ...shop, ...metadata };
    set({ shop: newShop });
    await Database.run(
      'INSERT OR REPLACE INTO shop_metadata (key, value, updated_at, dirty) VALUES (?, ?, ?, 1);',
      ['settings', JSON.stringify(newShop), ts]
    );

    // 2. Update Private Credentials (if provided)
    if (adminPin || staffPin) {
      const newPrivate = { ...shopPrivate };
      if (adminPin) newPrivate.adminPin = adminPin;
      if (staffPin) newPrivate.staffPin = staffPin;
      set({ shopPrivate: newPrivate });
      
      await Database.run(
        'INSERT OR REPLACE INTO shop_metadata (key, value, updated_at, dirty) VALUES (?, ?, ?, 1);',
        ['credentials', JSON.stringify(newPrivate), ts]
      );
    }

    await outboxRepo.enqueue({ 
      opId: `shop_${ts}`, 
      entityType: 'shop', 
      entityId: shopId, 
      operation: 'UPDATE', 
      payload: JSON.stringify({ 
        settings: metadata, 
        adminPin, 
        staffPin,
        name: metadata.name || shop.name 
      }), 
      createdAt: ts 
    });
  },

  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem('hub_theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  },

  // ─── THIN ACTION WRAPPERS ─────
  // All mutations write to SQLite repos + outbox. No Zustand entity arrays.

  addInventoryItem: async (item) => {
    const { shopId } = get(); if (!shopId) return;
    const { costPrice, ...pub } = item as any; const ts = Date.now();
    await inventoryRepo.upsert(item);
    await outboxRepo.enqueue({ opId: `inv_${item.id}_${ts}`, entityType: 'inventory', entityId: item.id, operation: 'CREATE', payload: JSON.stringify({ ...pub, updatedAt: ts }), createdAt: ts });
    if (costPrice !== undefined) {
      const p = { id: item.id, costPrice: Number(costPrice) };
      await inventoryPrivateRepo.upsert(p as InventoryPrivate);
      await outboxRepo.enqueue({ opId: `invp_${item.id}_${ts}`, entityType: 'inventory_private', entityId: item.id, operation: 'CREATE', payload: JSON.stringify({ ...p, updatedAt: ts }), createdAt: ts });
    }
  },

  updateInventoryItem: async (item) => {
    const { shopId } = get(); if (!shopId) return;
    const { costPrice, ...pub } = item as any; const ts = Date.now();
    await inventoryRepo.upsert(item);
    await outboxRepo.enqueue({ opId: `inv_${item.id}_${ts}`, entityType: 'inventory', entityId: item.id, operation: 'UPDATE', payload: JSON.stringify({ ...pub, updatedAt: ts }), createdAt: ts });
    if (costPrice !== undefined) {
      const p = { id: item.id, costPrice: Number(costPrice) };
      await inventoryPrivateRepo.upsert(p as InventoryPrivate);
      await outboxRepo.enqueue({ opId: `invp_${item.id}_${ts}`, entityType: 'inventory_private', entityId: item.id, operation: 'UPDATE', payload: JSON.stringify({ ...p, updatedAt: ts }), createdAt: ts });
    }
  },

  updateStock: async (id, delta) => {
    const { shopId } = get(); if (!shopId) return;
    const ts = Date.now();
    await inventoryRepo.updateStock(id, delta);
    await outboxRepo.enqueue({ 
      opId: `stock_${id}_${ts}`, 
      entityType: 'inventory', 
      entityId: id, 
      operation: 'UPDATE', 
      payload: JSON.stringify({ stockDelta: delta, updatedAt: ts }), 
      createdAt: ts 
    });
  },

  deleteInventoryItem: async (id) => {
    const { shopId } = get(); if (!shopId) return;
    const ts = Date.now();
    await inventoryRepo.softDelete(id);
    await outboxRepo.enqueue({ opId: `invdel_${id}_${ts}`, entityType: 'inventory', entityId: id, operation: 'DELETE', payload: '{}', createdAt: ts });
  },

  clearInventory: async () => {
    const { shopId } = get(); if (!shopId) return;
    const ts = Date.now();
    const all = await inventoryRepo.getAll();
    await inventoryRepo.clearAll();
    for (const item of all) {
      await outboxRepo.enqueue({ opId: `invclr_${item.id}_${ts}`, entityType: 'inventory', entityId: item.id, operation: 'DELETE', payload: '{}', createdAt: ts });
    }
  },

  addSale: async (sale) => {
    const { shopId } = get(); if (!shopId) return;
    const ts = Date.now();
    let finalSale = { ...sale };
    const creditPayment = sale.payments.find((p: any) => p.mode === 'CREDIT');
    const creditAmount = creditPayment ? creditPayment.amount : 0;

    // Customer linking
    if (creditAmount > 0 && finalSale.customerName && !finalSale.customerId) {
      const custs = await customersRepo.getAll();
      const phoneToMatch = finalSale.customerPhone?.trim();
      const nameToMatch = finalSale.customerName?.trim().toLowerCase();
      const existing = custs.find((c: Customer) => (phoneToMatch && c.phone === phoneToMatch) || (nameToMatch && c.name.toLowerCase() === nameToMatch));
      if (existing) {
        finalSale.customerId = existing.id;
        await customersRepo.updateBalance(existing.id, finalSale.total, creditAmount);
        await outboxRepo.enqueue({ opId: `custbal_${existing.id}_${ts}`, entityType: 'customers', entityId: existing.id, operation: 'UPDATE', payload: JSON.stringify({ ...(await customersRepo.getById(existing.id)), updatedAt: ts }), createdAt: ts });
      } else {
        const nid = `cust-${Date.now()}`;
        finalSale.customerId = nid;
        const nc: Customer = { id: nid, name: finalSale.customerName, phone: finalSale.customerPhone || '-', totalSpent: finalSale.total, balance: creditAmount, createdAt: new Date(ts).toISOString() };
        await customersRepo.upsert(nc);
        await outboxRepo.enqueue({ opId: `custnew_${nid}_${ts}`, entityType: 'customers', entityId: nid, operation: 'CREATE', payload: JSON.stringify({ ...nc, updatedAt: ts }), createdAt: ts });
      }
    } else if (finalSale.customerId) {
      await customersRepo.updateBalance(finalSale.customerId, finalSale.total, creditAmount);
      await outboxRepo.enqueue({ opId: `custbal_${finalSale.customerId}_${ts}`, entityType: 'customers', entityId: finalSale.customerId, operation: 'UPDATE', payload: JSON.stringify({ ...(await customersRepo.getById(finalSale.customerId)), updatedAt: ts }), createdAt: ts });
    }

    await salesRepo.upsert(finalSale);
    for (const item of finalSale.items) {
      if (!item.itemId.startsWith('custom-') && item.itemId !== 'payment-received') {
        await inventoryRepo.updateStock(item.itemId, -item.quantity);
        await outboxRepo.enqueue({ 
          opId: `stock_${item.itemId}_${ts}_${finalSale.id}`, 
          entityType: 'inventory', 
          entityId: item.itemId, 
          operation: 'UPDATE', 
          payload: JSON.stringify({ stockDelta: -item.quantity, updatedAt: ts }), 
          createdAt: ts 
        });
      }
    }
    await outboxRepo.enqueue({ opId: `sale_${finalSale.id}_${ts}`, entityType: 'sales', entityId: finalSale.id, operation: 'CREATE', payload: JSON.stringify({ ...finalSale, updatedAt: ts }), createdAt: ts });
  },

  updateSale: async (newSale) => {
    const { shopId } = get(); if (!shopId) return;
    const ts = Date.now();
    const oldSale = await salesRepo.getById(newSale.id);
    if (!oldSale) return;

    // Reconcile stock deltas
    const itemIds = new Set([...oldSale.items.map((i: SaleItem) => i.itemId), ...newSale.items.map((i: SaleItem) => i.itemId)]);
    for (const itemId of itemIds) {
      if (itemId.startsWith('custom-') || itemId === 'payment-received') continue;
      const oldQty = oldSale.items.find((i: SaleItem) => i.itemId === itemId)?.quantity || 0;
      const newQty = newSale.items.find((i: SaleItem) => i.itemId === itemId)?.quantity || 0;
      const delta = -(newQty - oldQty);
      if (delta !== 0) {
        await inventoryRepo.updateStock(itemId, delta);
        await outboxRepo.enqueue({ 
          opId: `stock_rec_${itemId}_${ts}_${newSale.id}`, 
          entityType: 'inventory', 
          entityId: itemId, 
          operation: 'UPDATE', 
          payload: JSON.stringify({ stockDelta: delta, updatedAt: ts }), 
          createdAt: ts 
        });
      }
    }

    // Reconcile customer balance
    const oldCredit = oldSale.payments.find((p: any) => p.mode === 'CREDIT')?.amount || 0;
    const newCredit = newSale.payments.find((p: any) => p.mode === 'CREDIT')?.amount || 0;
    if (oldSale.customerId === newSale.customerId && newSale.customerId) {
      await customersRepo.updateBalance(newSale.customerId, newSale.total - oldSale.total, newCredit - oldCredit);
    } else {
      if (oldSale.customerId) await customersRepo.updateBalance(oldSale.customerId, -oldSale.total, -oldCredit);
      if (newSale.customerId) await customersRepo.updateBalance(newSale.customerId, newSale.total, newCredit);
    }

    await salesRepo.upsert(newSale);
    await outboxRepo.enqueue({ opId: `sale_${newSale.id}_${ts}`, entityType: 'sales', entityId: newSale.id, operation: 'UPDATE', payload: JSON.stringify({ ...newSale, updatedAt: ts }), createdAt: ts });
  },

  deleteSale: async (id) => {
    const { shopId } = get(); if (!shopId) return;
    const ts = Date.now();
    const sale = await salesRepo.getById(id);
    if (!sale) return;
    const creditAmount = sale.payments.find((p: any) => p.mode === 'CREDIT')?.amount || 0;
    for (const item of sale.items) {
      if (!item.itemId.startsWith('custom-') && item.itemId !== 'payment-received') {
        await inventoryRepo.updateStock(item.itemId, item.quantity);
        await outboxRepo.enqueue({ 
          opId: `stock_res_${item.itemId}_${ts}_${id}`, 
          entityType: 'inventory', 
          entityId: item.itemId, 
          operation: 'UPDATE', 
          payload: JSON.stringify({ stockDelta: item.quantity, updatedAt: ts }), 
          createdAt: ts 
        });
      }
    }
    if (sale.customerId) await customersRepo.updateBalance(sale.customerId, -sale.total, -creditAmount);
    await salesRepo.softDelete(id);
    await outboxRepo.enqueue({ opId: `saledel_${id}_${ts}`, entityType: 'sales', entityId: id, operation: 'DELETE', payload: '{}', createdAt: ts });
  },

  upsertCustomer: async (customer) => {
    const { shopId } = get(); if (!shopId) return;
    const ts = Date.now();
    const exists = await customersRepo.getById(customer.id);
    await customersRepo.upsert(customer);
    await outboxRepo.enqueue({ opId: `cust_${customer.id}_${ts}`, entityType: 'customers', entityId: customer.id, operation: exists ? 'UPDATE' : 'CREATE', payload: JSON.stringify({ ...customer, updatedAt: ts }), createdAt: ts });
  },

  deleteCustomer: async (id) => {
    const { shopId } = get(); if (!shopId) return;
    const ts = Date.now();
    await customersRepo.softDelete(id);
    await outboxRepo.enqueue({ opId: `custdel_${id}_${ts}`, entityType: 'customers', entityId: id, operation: 'DELETE', payload: '{}', createdAt: ts });
  },

  addCustomerPayment: async (customerId, amount) => {
    const { shopId } = get(); if (!shopId) return;
    const ts = Date.now();
    const paymentId = `PAY-${Date.now()}`;
    const payment: CustomerPayment = { id: paymentId, customerId, amount, date: new Date(ts).toISOString().split('T')[0], createdAt: new Date(ts).toISOString() };
    await customerPaymentsRepo.upsert(payment);
    await customersRepo.updateBalance(customerId, 0, -amount);
    await outboxRepo.enqueue({ opId: `pay_${paymentId}_${ts}`, entityType: 'customer_payments', entityId: paymentId, operation: 'CREATE', payload: JSON.stringify({ ...payment, updatedAt: ts }), createdAt: ts });
    const updatedCust = await customersRepo.getById(customerId);
    if (updatedCust) await outboxRepo.enqueue({ opId: `custpay_${customerId}_${ts}`, entityType: 'customers', entityId: customerId, operation: 'UPDATE', payload: JSON.stringify({ ...updatedCust, updatedAt: ts }), createdAt: ts });
  },

  addExpense: async (expense) => {
    const { shopId } = get(); if (!shopId) return;
    const ts = Date.now();
    await expensesRepo.upsert(expense);
    await outboxRepo.enqueue({ opId: `exp_${expense.id}_${ts}`, entityType: 'expenses', entityId: expense.id, operation: 'CREATE', payload: JSON.stringify({ ...expense, updatedAt: ts }), createdAt: ts });
  },

  deleteExpense: async (id) => {
    const { shopId } = get(); if (!shopId) return;
    const ts = Date.now();
    await expensesRepo.softDelete(id);
    await outboxRepo.enqueue({ opId: `expdel_${id}_${ts}`, entityType: 'expenses', entityId: id, operation: 'DELETE', payload: '{}', createdAt: ts });
  },

  restockItem: async (id, newQty, newPurchasePrice) => {
    const { shopId } = get(); if (!shopId) return;
    const ts = Date.now();
    const currentItem = await inventoryRepo.getById(id);
    if (!currentItem) return;
    const currentStock = currentItem.stock ?? 0;
    const currentPriv = await inventoryPrivateRepo.getById(id);
    const currentCost = currentPriv?.costPrice ?? 0;
    const totalQuantity = currentStock + newQty;
    const wac = totalQuantity > 0 ? ((currentStock * currentCost) + (newQty * newPurchasePrice)) / totalQuantity : newPurchasePrice;

    await inventoryRepo.updateStock(id, newQty);
    const privData: InventoryPrivate = { id, costPrice: Number(wac.toFixed(2)), lastPurchaseDate: new Date(ts).toISOString().split('T')[0] };
    await inventoryPrivateRepo.upsert(privData);
    const updatedItem = await inventoryRepo.getById(id);
    if (updatedItem) await outboxRepo.enqueue({ opId: `restock_${id}_${ts}`, entityType: 'inventory', entityId: id, operation: 'UPDATE', payload: JSON.stringify({ ...updatedItem, updatedAt: ts }), createdAt: ts });
    await outboxRepo.enqueue({ opId: `restockp_${id}_${ts}`, entityType: 'inventory_private', entityId: id, operation: 'UPDATE', payload: JSON.stringify({ ...privData, updatedAt: ts }), createdAt: ts });
  },

  upsertStaff: async (staffMember) => {
    const { shopId } = get(); if (!shopId) return;
    const { salary, pin, ...publicData } = staffMember as any; const ts = Date.now();
    const exists = await staffRepo.getById(staffMember.id);
    await staffRepo.upsert(staffMember);
    await outboxRepo.enqueue({ opId: `staff_${staffMember.id}_${ts}`, entityType: 'staff', entityId: staffMember.id, operation: exists ? 'UPDATE' : 'CREATE', payload: JSON.stringify({ ...publicData, updatedAt: ts }), createdAt: ts });
    if (salary !== undefined || pin !== undefined) {
      const priv: any = { id: staffMember.id };
      if (salary !== undefined) priv.salary = Number(salary);
      if (pin !== undefined) priv.pin = pin;
      await staffPrivateRepo.upsert(priv as StaffPrivate);
      await outboxRepo.enqueue({ opId: `staffp_${staffMember.id}_${ts}`, entityType: 'staff_private', entityId: staffMember.id, operation: exists ? 'UPDATE' : 'CREATE', payload: JSON.stringify({ ...priv, updatedAt: ts }), createdAt: ts });
    }
  },

  deleteStaff: async (id) => {
    const { shopId } = get(); if (!shopId) return;
    const ts = Date.now();
    await staffRepo.remove(id);
    await outboxRepo.enqueue({ opId: `staffdel_${id}_${ts}`, entityType: 'staff', entityId: id, operation: 'DELETE', payload: '{}', createdAt: ts });
  },

  recordAttendance: async (entry) => {
    const { shopId, shop } = get(); if (!shopId) return;
    const ts = Date.now();
    let finalEntry = { ...entry };
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
    await outboxRepo.enqueue({ opId: `att_${finalEntry.id}_${ts}`, entityType: 'attendance', entityId: finalEntry.id, operation: 'UPDATE', payload: JSON.stringify({ ...finalEntry, updatedAt: ts }), createdAt: ts });
  },
}));
