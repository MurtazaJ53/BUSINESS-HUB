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
  standardWorkingHours: number;
  allowStaffAttendance: boolean;
}

export interface SaleItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  costPrice?: number;
  size?: string;
  isReturn?: boolean;
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
  customerPhone?: string;
  customerId?: string;
  footerNote?: string;
  date: string;
  createdAt: string;
}

export type StaffPermission = 
  | 'dashboard'
  | 'inventory'
  | 'sell'
  | 'customers'
  | 'history'
  | 'expenses'
  | 'stock-alerts'
  | 'analytics'
  | 'team';

export interface Staff {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  salary: number; // Base monthly salary
  joinedAt: string;
  pin?: string;
  status: 'active' | 'inactive';
  permissions?: StaffPermission[];
}

export interface Attendance {
  id: string; // staffId_date
  staffId: string;
  date: string; // YYYY-MM-DD
  clockIn?: string; // ISO string or HH:mm
  clockOut?: string;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE';
  totalHours?: number;
  overtime?: number; // Extra hours
  bonus?: number; // Custom bonus amount
  note?: string;
}

export interface Invitation {
  id: string;
  code: string;
  createdAt: string;
  expiresAt?: string;
  usedBy?: string[];
}
