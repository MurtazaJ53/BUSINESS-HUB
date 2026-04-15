import { create } from 'zustand';
import type { InventoryItem, Sale, Customer, ShopMetadata } from './types';

// ── Persistence helpers ────────────────────────────────────────────────────
const LS_INVENTORY = 'biz_inventory';
const LS_SALES = 'biz_sales';
const LS_CUSTOMERS = 'biz_customers';
const LS_EXPENSES = 'biz_expenses';
const LS_SHOP = 'biz_shop_settings';
const LS_THEME = 'biz_theme';

const SHOP_DEFAULTS: ShopMetadata = {
  name: 'Business Hub Pro',
  tagline: 'Elite Shop Management',
  address: '',
  phone: '',
  email: '',
  gst: '',
  footer: 'Thank you for your business! 😊',
  currency: 'INR',
};

function loadFromLS<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToLS<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

// ── Store ──────────────────────────────────────────────────────────────────
interface BusinessState {
  inventory: InventoryItem[];
  sales: Sale[];
  customers: Customer[];
  expenses: Expense[];
  shop: ShopMetadata;
  theme: 'dark' | 'light';
  activeTab: string;
  inventorySearchTerm: string;

  // Navigation
  setActiveTab: (tab: string) => void;
  setInventorySearchTerm: (term: string) => void;

  // Shop & Theme
  updateShop: (data: Partial<ShopMetadata>) => void;
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

  // System
  importData: (data: { 
    inventory: InventoryItem[]; 
    sales: Sale[]; 
    customers: Customer[]; 
    expenses?: Expense[];
    shop?: ShopMetadata 
  }) => Promise<void>;
}

export const useBusinessStore = create<BusinessState>((set, get) => ({
  inventory: loadFromLS<InventoryItem[]>(LS_INVENTORY, []),
  sales: loadFromLS<Sale[]>(LS_SALES, []),
  customers: loadFromLS<Customer[]>(LS_CUSTOMERS, []),
  expenses: loadFromLS<Expense[]>(LS_EXPENSES, []),
  shop: loadFromLS<ShopMetadata>(LS_SHOP, SHOP_DEFAULTS),
  theme: loadFromLS<'dark' | 'light'>(LS_THEME, 'dark'),
  activeTab: 'dashboard',
  inventorySearchTerm: '',

  setActiveTab: (tab) => set({ activeTab: tab }),
  setInventorySearchTerm: (term) => set({ inventorySearchTerm: term }),

  updateShop: (data) => {
    const next = { ...get().shop, ...data };
    saveToLS(LS_SHOP, next);
    set({ shop: next });
  },

  setTheme: (theme) => {
    saveToLS(LS_THEME, theme);
    set({ theme });
    // Apply to DOM
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  addInventoryItem: async (item) => {
    const next = [...get().inventory, item];
    saveToLS(LS_INVENTORY, next);
    set({ inventory: next });
  },

  updateInventoryItem: async (item) => {
    const next = get().inventory.map((i) => (i.id === item.id ? item : i));
    saveToLS(LS_INVENTORY, next);
    set({ inventory: next });
  },

  updateStock: async (id, delta) => {
    const next = get().inventory.map((i) => 
      i.id === id ? { ...i, stock: Math.max(0, (i.stock || 0) + delta) } : i
    );
    saveToLS(LS_INVENTORY, next);
    set({ inventory: next });
  },

  deleteInventoryItem: async (id) => {
    const next = get().inventory.filter((i) => i.id !== id);
    saveToLS(LS_INVENTORY, next);
    set({ inventory: next });
  },

  clearInventory: async () => {
    saveToLS(LS_INVENTORY, []);
    set({ inventory: [] });
  },

  addSale: async (sale) => {
    let nextCustomers = [...get().customers];
    let finalSale = { ...sale };

    if (finalSale.paymentMode === 'CREDIT' && finalSale.customerName && !finalSale.customerId) {
      const existing = nextCustomers.find(c => c.name.toLowerCase() === finalSale.customerName?.toLowerCase());
      if (existing) {
        finalSale.customerId = existing.id;
        nextCustomers = nextCustomers.map(c => {
          if (c.id === existing.id) {
            return {
              ...c,
              totalSpent: c.totalSpent + finalSale.total,
              balance: c.balance + finalSale.total
            };
          }
          return c;
        });
      } else {
        const newCustomerId = `cust-${Date.now()}`;
        const newCustomer: Customer = {
          id: newCustomerId,
          name: finalSale.customerName,
          phone: '-', 
          totalSpent: finalSale.total,
          balance: finalSale.total,
          createdAt: new Date().toISOString()
        };
        nextCustomers.push(newCustomer);
        finalSale.customerId = newCustomerId;
      }
    } else if (finalSale.customerId) {
      nextCustomers = nextCustomers.map(c => {
        if (c.id === finalSale.customerId) {
          return {
            ...c,
            totalSpent: c.totalSpent + finalSale.total,
            balance: finalSale.paymentMode === 'CREDIT' ? c.balance + finalSale.total : c.balance
          };
        }
        return c;
      });
    }

    const nextSales = [...get().sales, finalSale];
    saveToLS(LS_SALES, nextSales);
    saveToLS(LS_CUSTOMERS, nextCustomers);

    set({ sales: nextSales, customers: nextCustomers });
  },

  updateSale: async (sale) => {
    const next = get().sales.map((s) => (s.id === sale.id ? sale : s));
    saveToLS(LS_SALES, next);
    set({ sales: next });
  },

  deleteSale: async (id) => {
    const state = get();
    const sale = state.sales.find((s) => s.id === id);
    if (!sale) return;

    // 1. Inventory Restoration (Only for product sales)
    const updatedInventory = [...state.inventory];
    if (!id.startsWith('PAY-')) {
      for (const item of sale.items) {
        if (item.itemId.startsWith('custom-') || item.itemId === 'payment-received') continue;
        const invIdx = updatedInventory.findIndex((i) => i.id === item.itemId);
        if (invIdx > -1) {
          updatedInventory[invIdx] = {
            ...updatedInventory[invIdx],
            stock: (updatedInventory[invIdx].stock ?? 0) + item.quantity,
          };
        }
      }
    }

    // 2. Customer Ledger Reversal
    let nextCustomers = [...state.customers];
    if (sale.customerId) {
      nextCustomers = nextCustomers.map(c => {
        if (c.id === sale.customerId) {
          if (id.startsWith('PAY-')) {
            // Reversing a payment means the debt comes back
            return {
              ...c,
              balance: c.balance + sale.total
            };
          } else {
            // Reversing a sale means spending goes down, and debt goes down (if it was credit)
            return {
              ...c,
              totalSpent: Math.max(0, c.totalSpent - sale.total),
              balance: sale.paymentMode === 'CREDIT' ? Math.max(0, c.balance - sale.total) : c.balance
            };
          }
        }
        return c;
      });
    }

    const nextSales = state.sales.filter((s) => s.id !== id);

    saveToLS(LS_INVENTORY, updatedInventory);
    saveToLS(LS_SALES, nextSales);
    if (sale.customerId) saveToLS(LS_CUSTOMERS, nextCustomers);

    set({ inventory: updatedInventory, sales: nextSales, customers: nextCustomers });
  },

  upsertCustomer: async (customer) => {
    const exists = get().customers.find(c => c.id === customer.id);
    const next = exists 
      ? get().customers.map(c => c.id === customer.id ? customer : c)
      : [...get().customers, customer];
    saveToLS(LS_CUSTOMERS, next);
    set({ customers: next });
  },

  deleteCustomer: async (id) => {
    const next = get().customers.filter(c => c.id !== id);
    saveToLS(LS_CUSTOMERS, next);
    set({ customers: next });
  },

  addCustomerPayment: async (customerId, amount) => {
    const state = get();
    const customer = state.customers.find(c => c.id === customerId);
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
      paymentMode: 'CASH', // Defaulting to CASH for ledger, User can edit later if needed
      customerId: customer.id,
      customerName: customer.name,
      date: today,
      createdAt: new Date().toISOString()
    };

    const nextCustomers = state.customers.map(c => 
      c.id === customerId ? { ...c, balance: Math.max(0, c.balance - amount) } : c
    );
    const nextSales = [...state.sales, newPaymentSale];

    saveToLS(LS_CUSTOMERS, nextCustomers);
    saveToLS(LS_SALES, nextSales);
    set({ customers: nextCustomers, sales: nextSales });
  },

  addExpense: async (expense) => {
    const next = [...get().expenses, expense];
    saveToLS(LS_EXPENSES, next);
    set({ expenses: next });
  },

  deleteExpense: async (id) => {
    const next = get().expenses.filter((e) => e.id !== id);
    saveToLS(LS_EXPENSES, next);
    set({ expenses: next });
  },

  importData: async (data) => {
    if (data.inventory) {
      saveToLS(LS_INVENTORY, data.inventory);
      set({ inventory: data.inventory });
    }
    if (data.sales) {
      saveToLS(LS_SALES, data.sales);
      set({ sales: data.sales });
    }
    if (data.customers) {
      saveToLS(LS_CUSTOMERS, data.customers);
      set({ customers: data.customers });
    }
    if (data.expenses) {
      saveToLS(LS_EXPENSES, data.expenses);
      set({ expenses: data.expenses });
    }
    if (data.shop) {
      saveToLS(LS_SHOP, data.shop);
      set({ shop: data.shop });
    }
  },
}));
