import { create } from 'zustand';
import type { InventoryItem, Sale, Customer, ShopMetadata, Expense } from './types';
import { db } from './firebase';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  collection, 
  updateDoc, 
  deleteDoc, 
  arrayUnion, 
  query, 
  where 
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
  adminPin: '9999',
  staffPin: '0000',
};

interface BusinessState {
  inventory: InventoryItem[];
  sales: Sale[];
  customers: Customer[];
  expenses: Expense[];
  shop: ShopMetadata;
  theme: 'dark' | 'light';
  activeTab: string;
  inventorySearchTerm: string;
  role: 'admin' | 'staff' | null;
  shopId: string | null;
  lastBackupDate: string | null;

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

  // Customers
  upsertCustomer: (customer: Customer) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  addCustomerPayment: (customerId: string, amount: number) => Promise<void>;

  // Expenses
  addExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
}

export const useBusinessStore = create<BusinessState>((set, get) => ({
  inventory: [],
  sales: [],
  customers: [],
  expenses: [],
  shop: SHOP_DEFAULTS,
  theme: 'dark',
  activeTab: 'dashboard',
  inventorySearchTerm: '',
  role: null,
  shopId: null,
  lastBackupDate: null,

  initStore: (shopId, role) => {
    set({ shopId, role });

    // 1. Subscribe to Shop Metadata
    const unsubShop = onSnapshot(doc(db, 'shops', shopId), (s) => {
      if (s.exists()) {
        const data = s.data();
        set({ shop: { ...SHOP_DEFAULTS, ...data.settings, name: data.name } });
      }
    });

    // 2. Subscribe to Inventory
    const unsubInv = onSnapshot(collection(db, `shops/${shopId}/inventory`), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
      set({ inventory: items });
    });

    // 3. Subscribe to Sales (Recent 100)
    const unsubSales = onSnapshot(collection(db, `shops/${shopId}/sales`), (snap) => {
      const sales = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Sale))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      set({ sales });
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

    return () => {
      unsubShop();
      unsubInv();
      unsubSales();
      unsubCust();
      unsubExp();
    };
  },

  setRole: (role) => set({ role }),
  logout: () => set({ role: null, shopId: null }),

  setActiveTab: (tab) => set({ activeTab: tab }),
  setInventorySearchTerm: (term) => set({ inventorySearchTerm: term }),

  updateShop: async (data) => {
    const { shopId } = get();
    if (!shopId) return;
    await updateDoc(doc(db, 'shops', shopId), {
      settings: data,
      name: data.name || get().shop.name
    });
  },

  setTheme: (theme) => {
    set({ theme });
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  },

  addInventoryItem: async (item) => {
    const { shopId } = get();
    if (!shopId) throw new Error('Sync Error: Shop ID not found. Please refresh.');
    await setDoc(doc(db, `shops/${shopId}/inventory`, item.id), item);
  },

  updateInventoryItem: async (item) => {
    const { shopId } = get();
    if (!shopId) return;
    await setDoc(doc(db, `shops/${shopId}/inventory`, item.id), item);
  },

  updateStock: async (id, delta) => {
    const { shopId, inventory } = get();
    if (!shopId) return;
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    await updateDoc(doc(db, `shops/${shopId}/inventory`, id), {
      stock: Math.max(0, (item.stock || 0) + delta)
    });
  },

  deleteInventoryItem: async (id) => {
    const { shopId } = get();
    if (!shopId) return;
    await deleteDoc(doc(db, `shops/${shopId}/inventory`, id));
  },

  clearInventory: async () => {
    // Note: Batch deletion would be better, but for now simple clear
    const { shopId, inventory } = get();
    if (!shopId) return;
    for (const item of inventory) {
      await deleteDoc(doc(db, `shops/${shopId}/inventory`, item.id));
    }
  },

  addSale: async (sale) => {
    const { shopId, customers } = get();
    if (!shopId) return;

    let finalSale = { ...sale };
    let customerAction: Promise<any> | null = null;

    const creditPayment = finalSale.payments.find(p => p.mode === 'CREDIT');
    const creditAmount = creditPayment ? creditPayment.amount : 0;

    if (creditAmount > 0 && customerName && !finalSale.customerId) {
      // SMART MATCH: Try Phone first, then Name
      const phoneToMatch = finalSale.customerPhone?.trim();
      const nameToMatch = finalSale.customerName?.trim().toLowerCase();
      
      const existing = customers.find(c => 
        (phoneToMatch && c.phone === phoneToMatch) || 
        (nameToMatch && c.name.toLowerCase() === nameToMatch)
      );

      if (existing) {
        finalSale.customerId = existing.id;
        // If they matching but name/phone was slightly different, keep current for the sale but link them
        customerAction = updateDoc(doc(db, `shops/${get().shopId}/customers`, existing.id), {
          totalSpent: existing.totalSpent + finalSale.total,
          balance: existing.balance + creditAmount
        });
      } else {
        const newCustomerId = `cust-${Date.now()}`;
        finalSale.customerId = newCustomerId;
        customerAction = setDoc(doc(db, `shops/${get().shopId}/customers`, newCustomerId), {
          id: newCustomerId,
          name: finalSale.customerName,
          phone: finalSale.customerPhone || '-',
          totalSpent: finalSale.total,
          balance: creditAmount,
          createdAt: new Date().toISOString()
        });
      }
    } else if (finalSale.customerId) {
      const customer = customers.find(c => c.id === finalSale.customerId);
      if (customer) {
        customerAction = updateDoc(doc(db, `shops/${shopId}/customers`, customer.id), {
          totalSpent: customer.totalSpent + finalSale.total,
          balance: customer.balance + creditAmount
        });
      }
    }

    await setDoc(doc(db, `shops/${shopId}/sales`, finalSale.id), finalSale);
    if (customerAction) await customerAction;

    // Deduct stock
    for (const item of finalSale.items) {
      if (!item.itemId.startsWith('custom-') && item.itemId !== 'payment-received') {
        await get().updateStock(item.itemId, -item.quantity);
      }
    }
  },

  updateSale: async (sale) => {
    const { shopId } = get();
    if (!shopId) return;
    await setDoc(doc(db, `shops/${shopId}/sales`, sale.id), sale);
  },

  deleteSale: async (id) => {
    const { shopId, sales, inventory } = get();
    if (!shopId) return;
    const sale = sales.find(s => s.id === id);
    if (!sale) return;

    // Restore stock
    for (const item of sale.items) {
      if (!item.itemId.startsWith('custom-') && item.itemId !== 'payment-received') {
        await get().updateStock(item.itemId, item.quantity);
      }
    }

    await deleteDoc(doc(db, `shops/${shopId}/sales`, id));
  },

  upsertCustomer: async (customer) => {
    const { shopId } = get();
    if (!shopId) return;
    await setDoc(doc(db, `shops/${shopId}/customers`, customer.id), customer);
  },

  deleteCustomer: async (id) => {
    const { shopId } = get();
    if (!shopId) return;
    await deleteDoc(doc(db, `shops/${shopId}/customers`, id));
  },

  addCustomerPayment: async (customerId, amount) => {
    const { customers } = get();
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const today = new Date().toISOString().split('T')[0];
    const newPaymentSale: Sale = {
      id: `PAY-${Date.now()}`,
      items: [{
        itemId: 'payment-received',
        name: `Udhaar Payment: ${customer.name}`,
        quantity: 1,
        price: amount
      }],
      total: amount,
      discount: 0,
      discountType: 'fixed',
      discountValue: '0',
      paymentMode: 'CASH',
      payments: [{ mode: 'CASH', amount: amount }],
      customerId: customer.id,
      customerName: customer.name,
      date: today,
      createdAt: new Date().toISOString()
    };

    await get().addSale(newPaymentSale);
  },

  addExpense: async (expense) => {
    const { shopId } = get();
    if (!shopId) return;
    await setDoc(doc(db, `shops/${shopId}/expenses`, expense.id), expense);
  },

  deleteExpense: async (id) => {
    const { shopId } = get();
    if (!shopId) return;
    await deleteDoc(doc(db, `shops/${shopId}/expenses`, id));
  },
}));
