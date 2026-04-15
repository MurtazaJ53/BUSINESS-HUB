import { create } from 'zustand';
import type { InventoryItem, Sale, Customer, ShopMetadata } from './types';

// ── Persistence helpers ────────────────────────────────────────────────────
const LS_INVENTORY = 'biz_inventory';
const LS_SALES = 'biz_sales';
const LS_CUSTOMERS = 'biz_customers';
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

  // System
  importData: (data: { inventory: InventoryItem[]; sales: Sale[]; customers: Customer[]; shop?: ShopMetadata }) => Promise<void>;
}

export const useBusinessStore = create<BusinessState>((set, get) => ({
  inventory: loadFromLS<InventoryItem[]>(LS_INVENTORY, []),
  sales: loadFromLS<Sale[]>(LS_SALES, []),
  customers: loadFromLS<Customer[]>(LS_CUSTOMERS, []),
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
    const sale = get().sales.find((s) => s.id === id);
    if (!sale) return;

    const updatedInventory = [...get().inventory];
    for (const item of sale.items) {
      if (item.itemId.startsWith('custom-')) continue;
      const invIdx = updatedInventory.findIndex((i) => i.id === item.itemId);
      if (invIdx > -1) {
        updatedInventory[invIdx] = {
          ...updatedInventory[invIdx],
          stock: (updatedInventory[invIdx].stock ?? 0) + item.quantity,
        };
      }
    }

    const nextSales = get().sales.filter((s) => s.id !== id);
    let nextCustomers = [...get().customers];
    if (sale.customerId) {
      nextCustomers = nextCustomers.map(c => {
        if (c.id === sale.customerId) {
          return {
            ...c,
            totalSpent: Math.max(0, c.totalSpent - sale.total),
            balance: sale.paymentMode === 'CREDIT' ? Math.max(0, c.balance - sale.total) : c.balance
          };
        }
        return c;
      });
      saveToLS(LS_CUSTOMERS, nextCustomers);
    }

    saveToLS(LS_INVENTORY, updatedInventory);
    saveToLS(LS_SALES, nextSales);
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
    const next = get().customers.map(c => 
      c.id === customerId ? { ...c, balance: Math.max(0, c.balance - amount) } : c
    );
    saveToLS(LS_CUSTOMERS, next);
    set({ customers: next });
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
    if (data.shop) {
      saveToLS(LS_SHOP, data.shop);
      set({ shop: data.shop });
    }
  },
}));
