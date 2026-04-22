/**
 * useBusinessStore — Phase 2 Local-First Architecture
 * 
 * All reads come from SQLite (instant, synchronous-feeling via cached state).
 * All writes go to SQLite + outbox, then sync to Firestore in the background.
 * The sync engine's pull listener updates SQLite AND pushes new state into Zustand.
 */

import type { 
  InventoryItem, InventoryPrivate, Sale, Customer, ShopMetadata, ShopPrivate, 
  Expense, Staff, StaffPrivate, Attendance, Invitation, CustomerPayment, SaleItem
} from './types';
import { create } from 'zustand';
import { auth } from './firebase';

// Database imports
import {
  Database,
  inventoryRepo, inventoryPrivateRepo,
  salesRepo,
  customersRepo, customerPaymentsRepo,
  expensesRepo,
  staffRepo, staffPrivateRepo, attendanceRepo,
  outboxRepo,
  startSync, stopSync, onDataChange,
} from '../db';

const SHOP_DEFAULTS: ShopMetadata = {
  name: 'Business Hub Pro',
  tagline: 'Elite Shop Management',
  address: '',
  phone: '',
  email: '',
  gst: '',
  footer: 'Thank you for your business! 😊',
  currency: 'INR',
  standardWorkingHours: 9,
  allowStaffAttendance: true,
};

interface BusinessState {
  inventory: InventoryItem[];
  inventoryPrivate: InventoryPrivate[];
  sales: Sale[];
  customerPayments: CustomerPayment[];
  customers: Customer[];
  expenses: Expense[];
  staff: Staff[];
  staffPrivate: StaffPrivate[];
  attendance: Attendance[];
  loadingMore: boolean;
  canLoadMore: boolean;
  shop: ShopMetadata;
  shopPrivate: ShopPrivate | null;
  theme: 'dark' | 'light';
  activeTab: string;
  inventorySearchTerm: string;
  role: 'admin' | 'staff' | null;
  shopId: string | null;
  lastBackupDate: string | null;
  invitations: Invitation[];
  currentStaff: Staff | null;
  dbReady: boolean;

  // Initialization
  initStore: (shopId: string, role: 'admin' | 'staff') => () => void;

  // Auth
  setRole: (role: 'admin' | 'staff' | null) => void;
  logout: () => void;

  // Navigation
  setActiveTab: (tab: string) => void;
  setInventorySearchTerm: (term: string) => void;

  // Shop & Theme
  updateShop: (data: Partial<ShopMetadata>) => Promise<void>;
  setTheme: (theme: 'dark' | 'light') => void;

  // Inventory
  addInventoryItem: (item: InventoryItem) => Promise<void>;
  updateInventoryItem: (item: InventoryItem) => Promise<void>;
  updateStock: (id: string, delta: number) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  clearInventory: () => Promise<void>;

  // Sales
  addSale: (sale: Sale) => Promise<void>;
  updateSale: (sale: Sale) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  
  // Sales Pagination
  loadMoreSales: () => Promise<void>;
  
  // Financial Utilities
  upsertCustomer: (customer: Customer) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  addCustomerPayment: (customerId: string, amount: number) => Promise<void>;

  // Expenses
  addExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  // Restock logic
  restockItem: (id: string, newQty: number, newPurchasePrice: number) => Promise<void>;

  // Staff & Attendance
  upsertStaff: (staff: Staff) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  recordAttendance: (entry: Attendance) => Promise<void>;
}

export const useBusinessStore = create<BusinessState>((set, get) => ({
  inventory: [],
  inventoryPrivate: [],
  sales: [],
  customerPayments: [],
  customers: [],
  expenses: [],
  staff: [],
  staffPrivate: [],
  attendance: [],
  loadingMore: false,
  canLoadMore: true,
  shop: SHOP_DEFAULTS,
  shopPrivate: null,
  theme: 'dark',
  activeTab: 'dashboard',
  inventorySearchTerm: '',
  role: null,
  shopId: null,
  lastBackupDate: null,
  invitations: [],
  currentStaff: null,
  dbReady: false,

  initStore: (shopId: string, role: 'admin' | 'staff') => {
    set({ shopId, role });

    // 1. Initialize SQLite database
    Database.boot()
      .then(async () => {
        // 2. Load cached data from SQLite immediately (INSTANT UI)
        const [inv, invPriv, salesData, custs, custPay, exps, staffData, staffPriv, att, shopMeta] = await Promise.all([
          inventoryRepo.getAll(),
          role === 'admin' ? inventoryPrivateRepo.getAll() : Promise.resolve([]),
          salesRepo.getAll(100),
          customersRepo.getAll(),
          customerPaymentsRepo.getAll(),
          expensesRepo.getAll(),
          staffRepo.getAll(),
          role === 'admin' ? staffPrivateRepo.getAll() : Promise.resolve([]),
          attendanceRepo.getAll(getMonthStart()),
          Database.query<{ value: string }>('SELECT value FROM shop_metadata WHERE key = ?;', ['settings']),
        ]);

        // Parse shop metadata from KV store
        let shopData = SHOP_DEFAULTS;
        if (shopMeta.length > 0) {
          try {
            shopData = { ...SHOP_DEFAULTS, ...JSON.parse(shopMeta[0].value) };
          } catch (_) { /* use defaults */ }
        }

        // Resolve current staff for staff role
        let currentStaffObj: Staff | null = null;
        if (role === 'staff' && auth.currentUser) {
          currentStaffObj = await staffRepo.getById(auth.currentUser.uid);
        }

        set({
          inventory: inv,
          inventoryPrivate: invPriv,
          sales: salesData,
          customers: custs,
          customerPayments: custPay,
          expenses: exps,
          staff: staffData,
          staffPrivate: staffPriv,
          attendance: att,
          shop: shopData,
          currentStaff: currentStaffObj,
          dbReady: true,
        });

        // 3. Start the sync engine (Firestore ↔ SQLite background synchronization)
        const unsubData = onDataChange((entityType: string, data: any[]) => {
          // When the sync engine merges remote data, update Zustand state
          switch (entityType) {
            case 'inventory': set({ inventory: data as InventoryItem[] }); break;
            case 'inventoryPrivate': set({ inventoryPrivate: data as InventoryPrivate[] }); break;
            case 'sales': set({ sales: data as Sale[] }); break;
            case 'customerPayments': set({ customerPayments: data as CustomerPayment[] }); break;
            case 'customers': set({ customers: data as Customer[] }); break;
            case 'expenses': set({ expenses: data as Expense[] }); break;
            case 'staff': {
              set({ staff: data as Staff[] });
              // Update currentStaff if role is staff
              if (get().role === 'staff' && auth.currentUser) {
                const me = (data as Staff[]).find(s => s.id === auth.currentUser?.uid);
                if (me) set({ currentStaff: me });
              }
              break;
            }
            case 'staffPrivate': set({ staffPrivate: data as StaffPrivate[] }); break;
            case 'attendance': set({ attendance: data as Attendance[] }); break;
            case 'shop': {
              if (data.length > 0) {
                set({ shop: { ...SHOP_DEFAULTS, ...data[0] } as ShopMetadata });
              }
              break;
            }
          }
        });

        await startSync(shopId, role);

        // Store cleanup function
        (window as any).__syncCleanup = () => {
          unsubData();
          stopSync();
        };
      })
      .catch((err) => {
        console.error('[Store] Failed to initialize database:', err);
        set({ dbReady: true }); // Allow UI to render even if DB fails
      });

    // Return cleanup function
    return () => {
      if ((window as any).__syncCleanup) {
        (window as any).__syncCleanup();
        delete (window as any).__syncCleanup;
      }
    };
  },

  setRole: (role: 'admin' | 'staff' | null) => set({ role }),
  logout: () => {
    stopSync();
    set({ role: null, shopId: null, dbReady: false });
  },

  setActiveTab: (tab: string) => set({ activeTab: tab }),
  setInventorySearchTerm: (term: string) => set({ inventorySearchTerm: term }),

  // ─── SHOP ──────────────────────────────────────────────────

  updateShop: async (data: Partial<ShopMetadata>) => {
    const { shopId, shop } = get();
    if (!shopId) return;

    const { adminPin, staffPin, ...metadata } = data as any;
    const newShop = { ...shop, ...metadata };
    set({ shop: newShop });

    // Write to SQLite
    const ts = Date.now();
    await Database.run(
      'INSERT OR REPLACE INTO shop_metadata (key, value, updated_at, dirty) VALUES (?, ?, ?, 1);',
      ['settings', JSON.stringify(newShop), ts]
    );

    // Enqueue for sync
    await outboxRepo.enqueue({
      opId: `shop_${ts}`,
      entityType: 'shop',
      entityId: shopId,
      operation: 'UPDATE',
      payload: JSON.stringify({ settings: metadata, name: metadata.name || shop.name }),
      createdAt: ts,
    });
  },

  setTheme: (theme: 'dark' | 'light') => {
    set({ theme });
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  },

  // ─── INVENTORY ─────────────────────────────────────────────

  addInventoryItem: async (item: InventoryItem) => {
    const { shopId, inventory } = get();
    if (!shopId) return;

    const { costPrice, ...publicData } = item as any;
    const ts = Date.now();

    // 1. Write to SQLite (instant)
    await inventoryRepo.upsert(item);
    set({ inventory: [...inventory, item] });

    // 2. Enqueue public data for sync
    await outboxRepo.enqueue({
      opId: `inv_${item.id}_${ts}`,
      entityType: 'inventory',
      entityId: item.id,
      operation: 'CREATE',
      payload: JSON.stringify({ ...publicData, updatedAt: ts }),
      createdAt: ts,
    });

    // 3. If costPrice exists, write private data too
    if (costPrice !== undefined) {
      const privData = { id: item.id, costPrice: Number(costPrice) };
      await inventoryPrivateRepo.upsert(privData as InventoryPrivate);

      await outboxRepo.enqueue({
        opId: `invp_${item.id}_${ts}`,
        entityType: 'inventory_private',
        entityId: item.id,
        operation: 'CREATE',
        payload: JSON.stringify({ ...privData, updatedAt: ts }),
        createdAt: ts,
      });
    }
  },

  updateInventoryItem: async (item: InventoryItem) => {
    const { shopId, inventory } = get();
    if (!shopId) return;

    const { costPrice, ...publicData } = item as any;
    const ts = Date.now();

    await inventoryRepo.upsert(item);
    set({ inventory: inventory.map(i => i.id === item.id ? item : i) });

    await outboxRepo.enqueue({
      opId: `inv_${item.id}_${ts}`,
      entityType: 'inventory',
      entityId: item.id,
      operation: 'UPDATE',
      payload: JSON.stringify({ ...publicData, updatedAt: ts }),
      createdAt: ts,
    });

    if (costPrice !== undefined) {
      const privData = { id: item.id, costPrice: Number(costPrice) };
      await inventoryPrivateRepo.upsert(privData as InventoryPrivate);

      await outboxRepo.enqueue({
        opId: `invp_${item.id}_${ts}`,
        entityType: 'inventory_private',
        entityId: item.id,
        operation: 'UPDATE',
        payload: JSON.stringify({ ...privData, updatedAt: ts }),
        createdAt: ts,
      });
    }
  },

  updateStock: async (id: string, delta: number) => {
    const { shopId, inventory } = get();
    if (!shopId) return;

    const ts = Date.now();
    await inventoryRepo.updateStock(id, delta);

    // Optimistic update
    set({
      inventory: inventory.map(i => 
        i.id === id ? { ...i, stock: (i.stock ?? 0) + delta } : i
      ),
    });

    // Read updated stock for sync payload
    const updated = await inventoryRepo.getById(id);
    if (updated) {
      await outboxRepo.enqueue({
        opId: `stock_${id}_${ts}`,
        entityType: 'inventory',
        entityId: id,
        operation: 'UPDATE',
        payload: JSON.stringify({ ...updated, updatedAt: ts }),
        createdAt: ts,
      });
    }
  },

  deleteInventoryItem: async (id: string) => {
    const { shopId, inventory } = get();
    if (!shopId) return;

    const ts = Date.now();
    await inventoryRepo.softDelete(id);
    set({ inventory: inventory.filter(i => i.id !== id) });

    await outboxRepo.enqueue({
      opId: `invdel_${id}_${ts}`,
      entityType: 'inventory',
      entityId: id,
      operation: 'DELETE',
      payload: '{}',
      createdAt: ts,
    });
  },

  clearInventory: async () => {
    const { shopId, inventory } = get();
    if (!shopId) return;

    const ts = Date.now();
    await inventoryRepo.clearAll();
    
    // Enqueue delete for each item
    for (const item of inventory) {
      await outboxRepo.enqueue({
        opId: `invclr_${item.id}_${ts}`,
        entityType: 'inventory',
        entityId: item.id,
        operation: 'DELETE',
        payload: '{}',
        createdAt: ts,
      });
    }
    
    set({ inventory: [] });
  },

  // ─── SALES ─────────────────────────────────────────────────

  addSale: async (sale: Sale) => {
    const { shopId, customers, sales } = get();
    if (!shopId) return;

    const ts = Date.now();
    let finalSale = { ...sale };

    const creditPayment = sale.payments.find((p: any) => p.mode === 'CREDIT');
    const creditAmount = creditPayment ? creditPayment.amount : 0;

    // 1. Resolve Customer linking
    if (creditAmount > 0 && finalSale.customerName && !finalSale.customerId) {
      const phoneToMatch = finalSale.customerPhone?.trim();
      const nameToMatch = finalSale.customerName?.trim().toLowerCase();

      const existing = customers.find((c: Customer) => 
        (phoneToMatch && c.phone === phoneToMatch) ||
        (nameToMatch && c.name.toLowerCase() === nameToMatch)
      );

      if (existing) {
        finalSale.customerId = existing.id;
        await customersRepo.updateBalance(existing.id, finalSale.total, creditAmount);
        
        await outboxRepo.enqueue({
          opId: `custbal_${existing.id}_${ts}`,
          entityType: 'customers',
          entityId: existing.id,
          operation: 'UPDATE',
          payload: JSON.stringify({
            ...(await customersRepo.getById(existing.id)),
            updatedAt: ts,
          }),
          createdAt: ts,
        });
      } else {
        const newCustomerId = `cust-${Date.now()}`;
        finalSale.customerId = newCustomerId;
        const newCust: Customer = {
          id: newCustomerId,
          name: finalSale.customerName,
          phone: finalSale.customerPhone || '-',
          totalSpent: finalSale.total,
          balance: creditAmount,
          createdAt: new Date(ts).toISOString(),
        };
        await customersRepo.upsert(newCust);
        
        await outboxRepo.enqueue({
          opId: `custnew_${newCustomerId}_${ts}`,
          entityType: 'customers',
          entityId: newCustomerId,
          operation: 'CREATE',
          payload: JSON.stringify({ ...newCust, updatedAt: ts }),
          createdAt: ts,
        });
      }
    } else if (finalSale.customerId) {
      await customersRepo.updateBalance(finalSale.customerId, finalSale.total, creditAmount);
      
      await outboxRepo.enqueue({
        opId: `custbal_${finalSale.customerId}_${ts}`,
        entityType: 'customers',
        entityId: finalSale.customerId,
        operation: 'UPDATE',
        payload: JSON.stringify({
          ...(await customersRepo.getById(finalSale.customerId)),
          updatedAt: ts,
        }),
        createdAt: ts,
      });
    }

    // 2. Write sale to SQLite
    await salesRepo.upsert(finalSale);
    set({ sales: [finalSale, ...sales] });

    // 3. Deduct stock locally
    for (const item of finalSale.items) {
      if (!item.itemId.startsWith('custom-') && item.itemId !== 'payment-received') {
        await inventoryRepo.updateStock(item.itemId, -item.quantity);
      }
    }
    // Refresh inventory state
    const updatedInv = await inventoryRepo.getAll();
    set({ inventory: updatedInv });

    // 4. Enqueue sale for sync (Firestore format: items + payments as arrays)
    await outboxRepo.enqueue({
      opId: `sale_${finalSale.id}_${ts}`,
      entityType: 'sales',
      entityId: finalSale.id,
      operation: 'CREATE',
      payload: JSON.stringify({ ...finalSale, updatedAt: ts }),
      createdAt: ts,
    });

    // Refresh customers
    const updatedCusts = await customersRepo.getAll();
    set({ customers: updatedCusts });
  },

  updateSale: async (newSale: Sale) => {
    const { shopId, sales } = get();
    if (!shopId) return;

    const oldSale = sales.find((s: Sale) => s.id === newSale.id);
    if (!oldSale) return;
    const ts = Date.now();

    // 1. Reconcile stock deltas locally
    const itemIds = new Set([
      ...oldSale.items.map((i: SaleItem) => i.itemId),
      ...newSale.items.map((i: SaleItem) => i.itemId),
    ]);

    for (const itemId of itemIds) {
      if (itemId.startsWith('custom-') || itemId === 'payment-received') continue;
      const oldQty = oldSale.items.find((i: SaleItem) => i.itemId === itemId)?.quantity || 0;
      const newQty = newSale.items.find((i: SaleItem) => i.itemId === itemId)?.quantity || 0;
      const delta = newQty - oldQty;
      if (delta !== 0) {
        await inventoryRepo.updateStock(itemId, -delta);
      }
    }

    // 2. Reconcile customer balance
    const oldCredit = oldSale.payments.find((p: any) => p.mode === 'CREDIT')?.amount || 0;
    const newCredit = newSale.payments.find((p: any) => p.mode === 'CREDIT')?.amount || 0;

    if (oldSale.customerId === newSale.customerId && newSale.customerId) {
      await customersRepo.updateBalance(newSale.customerId, newSale.total - oldSale.total, newCredit - oldCredit);
    } else {
      if (oldSale.customerId) {
        await customersRepo.updateBalance(oldSale.customerId, -oldSale.total, -oldCredit);
      }
      if (newSale.customerId) {
        await customersRepo.updateBalance(newSale.customerId, newSale.total, newCredit);
      }
    }

    // 3. Update sale in SQLite
    await salesRepo.upsert(newSale);
    set({ sales: sales.map(s => s.id === newSale.id ? newSale : s) });

    // 4. Enqueue for sync
    await outboxRepo.enqueue({
      opId: `sale_${newSale.id}_${ts}`,
      entityType: 'sales',
      entityId: newSale.id,
      operation: 'UPDATE',
      payload: JSON.stringify({ ...newSale, updatedAt: ts }),
      createdAt: ts,
    });

    // Refresh derived state
    const [updatedInv, updatedCusts] = await Promise.all([
      inventoryRepo.getAll(),
      customersRepo.getAll(),
    ]);
    set({ inventory: updatedInv, customers: updatedCusts });
  },

  deleteSale: async (id: string) => {
    const { shopId, sales } = get();
    if (!shopId) return;

    const sale = sales.find((s: Sale) => s.id === id);
    if (!sale) return;
    const ts = Date.now();

    const creditPayment = sale.payments.find((p: any) => p.mode === 'CREDIT');
    const creditAmount = creditPayment ? creditPayment.amount : 0;

    // 1. Restore stock locally
    for (const item of sale.items) {
      if (!item.itemId.startsWith('custom-') && item.itemId !== 'payment-received') {
        await inventoryRepo.updateStock(item.itemId, item.quantity);
      }
    }

    // 2. Revert customer stats
    if (sale.customerId) {
      await customersRepo.updateBalance(sale.customerId, -sale.total, -creditAmount);
    }

    // 3. Soft-delete sale
    await salesRepo.softDelete(id);
    set({ sales: sales.filter(s => s.id !== id) });

    await outboxRepo.enqueue({
      opId: `saledel_${id}_${ts}`,
      entityType: 'sales',
      entityId: id,
      operation: 'DELETE',
      payload: '{}',
      createdAt: ts,
    });

    const [updatedInv, updatedCusts] = await Promise.all([
      inventoryRepo.getAll(),
      customersRepo.getAll(),
    ]);
    set({ inventory: updatedInv, customers: updatedCusts });
  },

  // ─── CUSTOMERS ─────────────────────────────────────────────

  upsertCustomer: async (customer: Customer) => {
    const { shopId, customers } = get();
    if (!shopId) return;

    const ts = Date.now();
    await customersRepo.upsert(customer);

    const exists = customers.find(c => c.id === customer.id);
    set({
      customers: exists
        ? customers.map(c => c.id === customer.id ? customer : c)
        : [...customers, customer],
    });

    await outboxRepo.enqueue({
      opId: `cust_${customer.id}_${ts}`,
      entityType: 'customers',
      entityId: customer.id,
      operation: exists ? 'UPDATE' : 'CREATE',
      payload: JSON.stringify({ ...customer, updatedAt: ts }),
      createdAt: ts,
    });
  },

  deleteCustomer: async (id: string) => {
    const { shopId, customers } = get();
    if (!shopId) return;

    const ts = Date.now();
    await customersRepo.softDelete(id);
    set({ customers: customers.filter(c => c.id !== id) });

    await outboxRepo.enqueue({
      opId: `custdel_${id}_${ts}`,
      entityType: 'customers',
      entityId: id,
      operation: 'DELETE',
      payload: '{}',
      createdAt: ts,
    });
  },

  addCustomerPayment: async (customerId: string, amount: number) => {
    const { shopId } = get();
    if (!shopId) return;

    const ts = Date.now();
    const paymentId = `PAY-${Date.now()}`;
    const payment: CustomerPayment = {
      id: paymentId,
      customerId,
      amount,
      date: new Date(ts).toISOString().split('T')[0],
      createdAt: new Date(ts).toISOString(),
    };

    // 1. Write payment to SQLite
    await customerPaymentsRepo.upsert(payment);

    // 2. Reduce customer balance
    await customersRepo.updateBalance(customerId, 0, -amount);

    // 3. Enqueue both for sync
    await outboxRepo.enqueue({
      opId: `pay_${paymentId}_${ts}`,
      entityType: 'customer_payments',
      entityId: paymentId,
      operation: 'CREATE',
      payload: JSON.stringify({ ...payment, updatedAt: ts }),
      createdAt: ts,
    });

    const updatedCust = await customersRepo.getById(customerId);
    if (updatedCust) {
      await outboxRepo.enqueue({
        opId: `custpay_${customerId}_${ts}`,
        entityType: 'customers',
        entityId: customerId,
        operation: 'UPDATE',
        payload: JSON.stringify({ ...updatedCust, updatedAt: ts }),
        createdAt: ts,
      });
    }

    // Refresh state
    const [custs, payments] = await Promise.all([
      customersRepo.getAll(),
      customerPaymentsRepo.getAll(),
    ]);
    set({ customers: custs, customerPayments: payments });
  },

  // ─── EXPENSES ──────────────────────────────────────────────

  addExpense: async (expense: Expense) => {
    const { shopId, expenses } = get();
    if (!shopId) return;

    const ts = Date.now();
    await expensesRepo.upsert(expense);
    set({ expenses: [...expenses, expense] });

    await outboxRepo.enqueue({
      opId: `exp_${expense.id}_${ts}`,
      entityType: 'expenses',
      entityId: expense.id,
      operation: 'CREATE',
      payload: JSON.stringify({ ...expense, updatedAt: ts }),
      createdAt: ts,
    });
  },

  deleteExpense: async (id: string) => {
    const { shopId, expenses } = get();
    if (!shopId) return;

    const ts = Date.now();
    await expensesRepo.softDelete(id);
    set({ expenses: expenses.filter(e => e.id !== id) });

    await outboxRepo.enqueue({
      opId: `expdel_${id}_${ts}`,
      entityType: 'expenses',
      entityId: id,
      operation: 'DELETE',
      payload: '{}',
      createdAt: ts,
    });
  },

  // ─── SALES PAGINATION ─────────────────────────────────────

  loadMoreSales: async () => {
    const { loadingMore } = get();
    if (loadingMore) return;

    set({ loadingMore: true });
    try {
      // Load all from SQLite (no pagination needed locally — it's instant)
      const allSales = await salesRepo.getAll(10000);
      set({ sales: allSales, canLoadMore: false });
    } catch (e) {
      console.error('Pagination Error:', e);
    } finally {
      set({ loadingMore: false });
    }
  },

  // ─── RESTOCK ─────────────────────────────────────────────

  restockItem: async (id: string, newQty: number, newPurchasePrice: number) => {
    const { shopId, inventory, inventoryPrivate } = get();
    if (!shopId) return;

    const ts = Date.now();

    // Local calculation (mirrors the old Firestore transaction logic)
    const currentItem = inventory.find(i => i.id === id);
    if (!currentItem) return;

    const currentStock = currentItem.stock ?? 0;
    const currentPriv = inventoryPrivate.find(p => p.id === id);
    const currentCost = currentPriv?.costPrice ?? 0;

    const totalQuantity = currentStock + newQty;
    const weightedAverageCost = totalQuantity > 0
      ? ((currentStock * currentCost) + (newQty * newPurchasePrice)) / totalQuantity
      : newPurchasePrice;

    // Update inventory stock locally
    await inventoryRepo.updateStock(id, newQty);

    // Update private cost data
    const privData: InventoryPrivate = {
      id,
      costPrice: Number(weightedAverageCost.toFixed(2)),
      lastPurchaseDate: new Date(ts).toISOString().split('T')[0],
    };
    await inventoryPrivateRepo.upsert(privData);

    // Optimistic state update
    set({
      inventory: inventory.map(i => i.id === id ? { ...i, stock: totalQuantity } : i),
      inventoryPrivate: inventoryPrivate.map(p =>
        p.id === id ? privData : p
      ).concat(currentPriv ? [] : [privData]),
    });

    // Enqueue for sync
    const updatedItem = await inventoryRepo.getById(id);
    if (updatedItem) {
      await outboxRepo.enqueue({
        opId: `restock_${id}_${ts}`,
        entityType: 'inventory',
        entityId: id,
        operation: 'UPDATE',
        payload: JSON.stringify({ ...updatedItem, updatedAt: ts }),
        createdAt: ts,
      });
    }

    await outboxRepo.enqueue({
      opId: `restockp_${id}_${ts}`,
      entityType: 'inventory_private',
      entityId: id,
      operation: 'UPDATE',
      payload: JSON.stringify({ ...privData, updatedAt: ts }),
      createdAt: ts,
    });
  },

  // ─── STAFF ─────────────────────────────────────────────────

  upsertStaff: async (staffMember: Staff) => {
    const { shopId, staff } = get();
    if (!shopId) return;

    const { salary, pin, ...publicData } = staffMember as any;
    const ts = Date.now();

    await staffRepo.upsert(staffMember);

    const exists = staff.find(s => s.id === staffMember.id);
    set({
      staff: exists
        ? staff.map(s => s.id === staffMember.id ? staffMember : s)
        : [...staff, staffMember],
    });

    await outboxRepo.enqueue({
      opId: `staff_${staffMember.id}_${ts}`,
      entityType: 'staff',
      entityId: staffMember.id,
      operation: exists ? 'UPDATE' : 'CREATE',
      payload: JSON.stringify({ ...publicData, updatedAt: ts }),
      createdAt: ts,
    });

    if (salary !== undefined || pin !== undefined) {
      const privateData: any = { id: staffMember.id };
      if (salary !== undefined) privateData.salary = Number(salary);
      if (pin !== undefined) privateData.pin = pin;

      await staffPrivateRepo.upsert(privateData as StaffPrivate);

      await outboxRepo.enqueue({
        opId: `staffp_${staffMember.id}_${ts}`,
        entityType: 'staff_private',
        entityId: staffMember.id,
        operation: exists ? 'UPDATE' : 'CREATE',
        payload: JSON.stringify({ ...privateData, updatedAt: ts }),
        createdAt: ts,
      });
    }
  },

  deleteStaff: async (id: string) => {
    const { shopId, staff } = get();
    if (!shopId) return;

    const ts = Date.now();
    await staffRepo.remove(id);
    set({ staff: staff.filter(s => s.id !== id) });

    await outboxRepo.enqueue({
      opId: `staffdel_${id}_${ts}`,
      entityType: 'staff',
      entityId: id,
      operation: 'DELETE',
      payload: '{}',
      createdAt: ts,
    });
  },

  recordAttendance: async (entry: Attendance) => {
    const { shopId, shop, attendance } = get();
    if (!shopId) return;

    const ts = Date.now();
    let finalEntry = { ...entry };

    // Smart logic for clock-out: Calculate hours
    if (entry.clockIn && entry.clockOut) {
      try {
        const [inH, inM] = entry.clockIn.split(':').map(Number);
        const [outH, outM] = entry.clockOut.split(':').map(Number);
        const durationHours = (outH + outM / 60) - (inH + inM / 60);
        finalEntry.totalHours = Number(durationHours.toFixed(2));

        if (!finalEntry.status) {
          const standard = shop.standardWorkingHours || 9;
          if (durationHours >= standard) {
            finalEntry.status = 'PRESENT';
          } else if (durationHours >= standard / 2) {
            finalEntry.status = 'HALF_DAY';
          } else {
            finalEntry.status = 'ABSENT';
          }
        }
      } catch (e) {
        console.error('Error calculating attendance duration', e);
      }
    }

    await attendanceRepo.upsert(finalEntry);

    set({
      attendance: attendance.some(a => a.id === finalEntry.id)
        ? attendance.map(a => a.id === finalEntry.id ? finalEntry : a)
        : [...attendance, finalEntry],
    });

    await outboxRepo.enqueue({
      opId: `att_${finalEntry.id}_${ts}`,
      entityType: 'attendance',
      entityId: finalEntry.id,
      operation: 'UPDATE',
      payload: JSON.stringify({ ...finalEntry, updatedAt: ts }),
      createdAt: ts,
    });
  },
}));

// ─── HELPERS ────────────────────────────────────────────────

function getMonthStart(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}
