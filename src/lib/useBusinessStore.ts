import type { 
  InventoryItem, InventoryPrivate, Sale, Customer, ShopMetadata, ShopPrivate, 
  Expense, Staff, StaffPrivate, Attendance, Invitation, CustomerPayment, SaleItem
} from './types';
import { create } from 'zustand';
import { db, auth } from './firebase';
import { 
  getDocs,
  doc, 
  onSnapshot, 
  setDoc, 
  collection, 
  updateDoc, 
  deleteDoc, 
  arrayUnion, 
  query, 
  where,
  writeBatch,
  runTransaction,
  increment,
  limit,
  orderBy,
  startAfter,
} from 'firebase/firestore';

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

  initStore: (shopId: string, role: 'admin' | 'staff') => {
    set({ shopId, role });

    // 1. Subscribe to Shop Metadata
    const unsubShop = onSnapshot(doc(db, 'shops', shopId), (s) => {
      if (s.exists()) {
        const data = s.data();
        // CLEANUP: Ensure no sensitive keys leak into public shop metadata
        const metadata = { ...data.settings, name: data.name };
        if (metadata.adminPin) delete metadata.adminPin;
        if (metadata.staffPin) delete metadata.staffPin;
        
        set({ shop: { ...SHOP_DEFAULTS, ...metadata } });
      }
    });

    // 1.5 Subscribe to Shop Private Settings (Admin Only)
    let unsubShopPrivate = () => {};
    if (role === 'admin') {
      unsubShopPrivate = onSnapshot(doc(db, `shops/${shopId}/private`, 'settings'), (s) => {
        if (s.exists()) {
          set({ shopPrivate: s.data() as ShopPrivate });
        }
      });
    }

    // 2. Subscribe to Inventory
    const unsubInv = onSnapshot(collection(db, `shops/${shopId}/inventory`), (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data();
        // CLEANUP: Ensure no leaked costPrice in public collection
        if (data.costPrice !== undefined) delete data.costPrice;
        return { id: d.id, ...data } as InventoryItem;
      });
      set({ inventory: items });
    });

    // 2.5 Subscribe to Private Inventory (Admin Only)
    let unsubInvPrivate = () => {};
    if (role === 'admin') {
      unsubInvPrivate = onSnapshot(collection(db, `shops/${shopId}/inventory_private`), (snap) => {
        const privateItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryPrivate));
        set({ inventoryPrivate: privateItems });
      });
    }

    // 3. Subscribe to Sales (Recent 100 - Paginated)
    const unsubSales = onSnapshot(query(collection(db, `shops/${shopId}/sales`), orderBy('createdAt', 'desc'), limit(100)), (snap) => {
      const sales = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
      set({ sales });
    });

    // 3.5 Subscribe to Customer Payments
    const unsubPayments = onSnapshot(collection(db, `shops/${shopId}/customer_payments`), (snap) => {
      const payments = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerPayment));
      set({ customerPayments: payments });
    });

    // 4. Subscribe to Customers
    const unsubCust = onSnapshot(collection(db, `shops/${shopId}/customers`), (snap) => {
      const customers = snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
      set({ customers });
    });

    // 5. Subscribe to Expenses
    const unsubExp = onSnapshot(collection(db, `shops/${shopId}/expenses`), (snap) => {
      const expenses = snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
      set({ expenses });
    });

    // 6. Subscribe to Staff
    const unsubStaff = onSnapshot(collection(db, `shops/${shopId}/staff`), (snap) => {
      const staff = snap.docs.map(d => {
        const data = d.data();
        // CLEANUP: Ensure no sensitive data leaks if legacy fields still exist
        if (data.salary !== undefined) delete data.salary;
        if (data.pin !== undefined) delete data.pin;
        return { id: d.id, ...data } as Staff;
      });
      set({ staff });
    });

    // 6.5 Subscribe to Staff Private Data (Admin Only)
    let unsubStaffPrivate = () => {};
    if (role === 'admin') {
      unsubStaffPrivate = onSnapshot(collection(db, `shops/${shopId}/staff_private`), (snap) => {
        const privateItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as StaffPrivate));
        set({ staffPrivate: privateItems });
      });
    }

    // 6. Subscribe to Attendance (Current Month only for performance)
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0,0,0,0);
    const startStr = firstOfMonth.toISOString().split('T')[0];

    const unsubAtt = onSnapshot(
      query(collection(db, `shops/${shopId}/attendance`), where('date', '>=', startStr)), 
      (snap) => {
        const attendance = snap.docs.map(d => ({ id: d.id, ...d.data() } as Attendance));
        set({ attendance });
      }
    );

    // 8. Subscribe to Invitations
    const unsubInvites = onSnapshot(collection(db, `shops/${shopId}/invitations`), (snap) => {
      const invitations = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invitation));
      set({ invitations });
    });

    // 9. Subscribe to Current Staff Object (if role is staff)
    let unsubCurrentStaff = () => {};
    if (role === 'staff' && auth.currentUser) {
      unsubCurrentStaff = onSnapshot(doc(db, `shops/${shopId}/staff`, auth.currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          set({ currentStaff: { id: docSnap.id, ...docSnap.data() } as Staff });
        }
      });
    }

    return () => {
      unsubShop();
      unsubShopPrivate();
      unsubInv();
      unsubInvPrivate();
      unsubSales();
      unsubPayments();
      unsubCust();
      unsubExp();
      unsubStaff();
      unsubStaffPrivate();
      unsubAtt();
      unsubInvites();
      unsubCurrentStaff();
    };
  },

  setRole: (role: 'admin' | 'staff' | null) => set({ role }),
  logout: () => set({ role: null, shopId: null }),

  setActiveTab: (tab: string) => set({ activeTab: tab }),
  setInventorySearchTerm: (term: string) => set({ inventorySearchTerm: term }),

  updateShop: async (data: Partial<ShopMetadata>) => {
    const { shopId } = get();
    if (!shopId) return;
    
    const { adminPin, staffPin, ...metadata } = data as any;
    
    // Write public metadata
    await updateDoc(doc(db, 'shops', shopId), {
      settings: metadata,
      name: metadata.name || get().shop.name
    });
  },

  setTheme: (theme: 'dark' | 'light') => {
    set({ theme });
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  },

  addInventoryItem: async (item: InventoryItem) => {
    const { shopId } = get();
    if (!shopId) throw new Error('Sync Error: Shop ID not found. Please refresh.');
    
    const { costPrice, ...publicData } = item as any;
    
    // Write public data
    await setDoc(doc(db, `shops/${shopId}/inventory`, item.id), publicData);
    
    // Write private data if costPrice exists
    if (costPrice !== undefined) {
      await setDoc(doc(db, `shops/${shopId}/inventory_private`, item.id), {
        id: item.id,
        costPrice: Number(costPrice)
      });
    }
  },

  updateInventoryItem: async (item: InventoryItem) => {
    const { shopId } = get();
    if (!shopId) return;
    
    const { costPrice, ...publicData } = item as any;
    
    // Write public data
    await setDoc(doc(db, `shops/${shopId}/inventory`, item.id), publicData);
    
    // Write private data if costPrice exists
    if (costPrice !== undefined) {
      await setDoc(doc(db, `shops/${shopId}/inventory_private`, item.id), {
        id: item.id,
        costPrice: Number(costPrice)
      });
    }
  },

  updateStock: async (id: string, delta: number) => {
    const { shopId } = get();
    if (!shopId) return;
    await updateDoc(doc(db, `shops/${shopId}/inventory`, id), {
      stock: increment(delta)
    });
  },

  deleteInventoryItem: async (id: string) => {
    const { shopId } = get();
    if (!shopId) return;
    await deleteDoc(doc(db, `shops/${shopId}/inventory`, id));
  },

  clearInventory: async () => {
    const { shopId, inventory } = get();
    if (!shopId) return;
    
    // Chunked Batch Deletion (max 500 per batch)
    const chunks = [];
    for (let i = 0; i < inventory.length; i += 500) {
      chunks.push(inventory.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const item of chunk) {
        batch.delete(doc(db, `shops/${shopId}/inventory`, item.id));
        batch.delete(doc(db, `shops/${shopId}/inventory_private`, item.id));
      }
      await batch.commit();
    }
  },

  addSale: async (sale: Sale) => {
    const { shopId, customers } = get();
    if (!shopId) return;

    const batch = writeBatch(db);
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
        batch.update(doc(db, `shops/${shopId}/customers`, existing.id), {
          totalSpent: increment(finalSale.total),
          balance: increment(creditAmount)
        });
      } else {
        const newCustomerId = `cust-${Date.now()}`;
        finalSale.customerId = newCustomerId;
        batch.set(doc(db, `shops/${shopId}/customers`, newCustomerId), {
          id: newCustomerId,
          name: finalSale.customerName,
          phone: finalSale.customerPhone || '-',
          totalSpent: finalSale.total,
          balance: creditAmount,
          createdAt: new Date().toISOString()
        });
      }
    } else if (finalSale.customerId) {
      batch.update(doc(db, `shops/${shopId}/customers`, finalSale.customerId), {
        totalSpent: increment(finalSale.total),
        balance: increment(creditAmount)
      });
    }

    // 2. Set Sale doc
    batch.set(doc(db, `shops/${shopId}/sales`, finalSale.id), finalSale);

    // 3. Deduct stock using increment (atomic)
    for (const item of finalSale.items) {
      if (!item.itemId.startsWith('custom-') && item.itemId !== 'payment-received') {
        batch.update(doc(db, `shops/${shopId}/inventory`, item.itemId), {
          stock: increment(-item.quantity)
        });
      }
    }

    await batch.commit();
  },

  updateSale: async (newSale: Sale) => {
    const { shopId, sales } = get();
    if (!shopId) return;
    const oldSale = sales.find((s: Sale) => s.id === newSale.id);
    if (!oldSale) return;

    const batch = writeBatch(db);

    // 1. Reconcile Stock Deltas
    const itemIds = new Set([
      ...oldSale.items.map((i: SaleItem) => i.itemId),
      ...newSale.items.map((i: SaleItem) => i.itemId)
    ]);

    for (const itemId of itemIds) {
      if (itemId.startsWith('custom-') || itemId === 'payment-received') continue;
      const oldQty = oldSale.items.find((i: SaleItem) => i.itemId === itemId)?.quantity || 0;
      const newQty = newSale.items.find((i: SaleItem) => i.itemId === itemId)?.quantity || 0;
      const delta = newQty - oldQty;

      if (delta !== 0) {
        batch.update(doc(db, `shops/${shopId}/inventory`, itemId), {
          stock: increment(-delta)
        });
      }
    }

    // 2. Reconcile Customer Balance & Spending
    const oldCredit = oldSale.payments.find((p: any) => p.mode === 'CREDIT')?.amount || 0;
    const newCredit = newSale.payments.find((p: any) => p.mode === 'CREDIT')?.amount || 0;

    if (oldSale.customerId === newSale.customerId) {
      if (newSale.customerId) {
        batch.update(doc(db, `shops/${shopId}/customers`, newSale.customerId), {
          totalSpent: increment(newSale.total - oldSale.total),
          balance: increment(newCredit - oldCredit)
        });
      }
    } else {
      if (oldSale.customerId) {
        batch.update(doc(db, `shops/${shopId}/customers`, oldSale.customerId), {
          totalSpent: increment(-oldSale.total),
          balance: increment(-oldCredit)
        });
      }
      if (newSale.customerId) {
        batch.update(doc(db, `shops/${shopId}/customers`, newSale.customerId), {
          totalSpent: increment(newSale.total),
          balance: increment(newCredit)
        });
      }
    }

    // 3. Update Sale Doc
    batch.set(doc(db, `shops/${shopId}/sales`, newSale.id), newSale);
    await batch.commit();
  },

  deleteSale: async (id: string) => {
    const { shopId, sales } = get();
    if (!shopId) return;
    const sale = sales.find((s: Sale) => s.id === id);
    if (!sale) return;

    const batch = writeBatch(db);
    const creditPayment = sale.payments.find((p: any) => p.mode === 'CREDIT');
    const creditAmount = creditPayment ? creditPayment.amount : 0;

    // 1. Restore Stock
    for (const item of sale.items) {
      if (!item.itemId.startsWith('custom-') && item.itemId !== 'payment-received') {
        batch.update(doc(db, `shops/${shopId}/inventory`, item.itemId), {
          stock: increment(item.quantity)
        });
      }
    }

    // 2. Revert Customer Stats
    if (sale.customerId) {
      batch.update(doc(db, `shops/${shopId}/customers`, sale.customerId), {
        totalSpent: increment(-sale.total),
        balance: increment(-creditAmount)
      });
    }

    // 3. Delete doc
    batch.delete(doc(db, `shops/${shopId}/sales`, id));

    await batch.commit();
  },

  upsertCustomer: async (customer: Customer) => {
    const { shopId } = get();
    if (!shopId) return;
    await setDoc(doc(db, `shops/${shopId}/customers`, customer.id), customer);
  },

  deleteCustomer: async (id: string) => {
    const { shopId } = get();
    if (!shopId) return;
    await deleteDoc(doc(db, `shops/${shopId}/customers`, id));
  },

  addCustomerPayment: async (customerId: string, amount: number) => {
    const { shopId } = get();
    if (!shopId) return;

    const batch = writeBatch(db);
    const paymentId = `PAY-${Date.now()}`;
    
    // 1. Record payment in the new collection
    batch.set(doc(db, `shops/${shopId}/customer_payments`, paymentId), {
      id: paymentId,
      customerId,
      amount,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    });

    // 2. Reduce customer Udhaar balance
    batch.update(doc(db, `shops/${shopId}/customers`, customerId), {
      balance: increment(-amount)
    });

    await batch.commit();
  },

  addExpense: async (expense: Expense) => {
    const { shopId } = get();
    if (!shopId) return;
    await setDoc(doc(db, `shops/${shopId}/expenses`, expense.id), expense);
  },

  deleteExpense: async (id: string) => {
    const { shopId } = get();
    if (!shopId) return;
    await deleteDoc(doc(db, `shops/${shopId}/expenses`, id));
  },

  loadMoreSales: async () => {
    const { shopId, sales, loadingMore } = get();
    if (!shopId || loadingMore) return;

    set({ loadingMore: true });
    try {
      const lastSale = sales[sales.length - 1];
      if (!lastSale) return;

      const q = query(
        collection(db, `shops/${shopId}/sales`),
        orderBy('createdAt', 'desc'),
        startAfter(lastSale.createdAt),
        limit(100)
      );

      const snap = await getDocs(q);
      const newSales = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
      
      set((state: BusinessState) => ({ 
        sales: [...state.sales, ...newSales],
        canLoadMore: newSales.length === 100 
      }));
    } catch (e) {
      console.error('Pagination Error:', e);
    } finally {
      set({ loadingMore: false });
    }
  },

  restockItem: async (id: string, newQty: number, newPurchasePrice: number) => {
    const { shopId } = get();
    if (!shopId) return;

    await runTransaction(db, async (transaction) => {
      const invRef = doc(db, `shops/${shopId}/inventory`, id);
      const privRef = doc(db, `shops/${shopId}/inventory_private`, id);

      const [invSnap, privSnap] = await Promise.all([
        transaction.get(invRef),
        transaction.get(privRef)
      ]);

      if (!invSnap.exists()) return;

      const currentStock = invSnap.data().stock || 0;
      const currentCost = privSnap.exists() ? (privSnap.data().costPrice || 0) : 0;
      
      const totalQuantity = currentStock + newQty;
      const weightedAverageCost = totalQuantity > 0 
        ? ((currentStock * currentCost) + (newQty * newPurchasePrice)) / totalQuantity
        : newPurchasePrice;

      transaction.update(invRef, {
        stock: totalQuantity
      });

      transaction.set(privRef, {
        id,
        costPrice: Number(weightedAverageCost.toFixed(2)),
        lastPurchaseDate: new Date().toISOString().split('T')[0]
      }, { merge: true });
    });
  },

  upsertStaff: async (staff: Staff) => {
    const { shopId } = get();
    if (!shopId) return;

    const { salary, pin, ...publicData } = staff as any;

    // Write public data
    await setDoc(doc(db, `shops/${shopId}/staff`, staff.id), publicData);

    // Write private data if salary or pin exists
    if (salary !== undefined || pin !== undefined) {
      const privateData: any = { id: staff.id };
      if (salary !== undefined) privateData.salary = Number(salary);
      if (pin !== undefined) privateData.pin = pin;

      await setDoc(doc(db, `shops/${shopId}/staff_private`, staff.id), privateData, { merge: true });
    }
  },

  deleteStaff: async (id: string) => {
    const { shopId } = get();
    if (!shopId) return;
    
    // 1. Remove from shop roster
    await deleteDoc(doc(db, `shops/${shopId}/staff`, id));
    
    // 2. Clear global user profile if they are a logged-in user (prevents ghost access)
    try {
      await updateDoc(doc(db, 'users', id), {
        shopId: null,
        role: null
      });
    } catch (e) {
      // It's possible the id was a custom 'staff-xxx' ID for someone not yet joined, ignore errors
      console.log('No global user to clear for staff:', id);
    }
  },

  recordAttendance: async (entry: Attendance) => {
    const { shopId, shop, attendance } = get();
    if (!shopId) return;

    // Smart logic for clock-out: Calculate hours
    let finalEntry = { ...entry };
    if (entry.clockIn && entry.clockOut) {
      try {
        const [inH, inM] = entry.clockIn.split(':').map(Number);
        const [outH, outM] = entry.clockOut.split(':').map(Number);
        const durationHours = (outH + outM / 60) - (inH + inM / 60);
        finalEntry.totalHours = Number(durationHours.toFixed(2));

        // Auto-suggest status based on hours if not already explicitly set
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

    await setDoc(doc(db, `shops/${shopId}/attendance`, finalEntry.id), finalEntry);
  },
}));
