export interface InventoryItem {
  id: string;
  name: string;
  price: number;
  costPrice?: number;
  sku?: string;
  category: string;
  subcategory?: string;
  size?: string;
  description?: string;
  stock?: number;
  createdAt: string;
  [key: string]: any; // allow dynamic deletion of undefined keys
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  totalSpent: number;
  balance: number; // For Udhaar/Credit
  createdAt: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  createdAt: string;
}

export interface ShopMetadata {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  gst: string;
  footer: string;
  currency: string;
  adminPin: string;
  staffPin: string;
}

export interface SaleItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  costPrice?: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  discount: number;
  discountValue: string;
  discountType: 'fixed' | 'percent';
  paymentMode: 'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'ONLINE' | 'OTHERS'; // Keeping for backwards compatibility
  payments: { mode: string; amount: number }[]; // New Multi-payment support
  customerName?: string;
  customerId?: string;
  date: string;
  createdAt: string;
}
