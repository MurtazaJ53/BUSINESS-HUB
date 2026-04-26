export interface InventoryItem {
  id: string;
  name: string;
  price: number;
  sku?: string;
  category: string;
  subcategory?: string;
  size?: string;
  description?: string;
  stock?: number;
  velocity?: {
    last7d: number;
    last30d: number;
    last90d: number;
    dailyAvg: number;
    daysOfCover: number;
    reorderPoint: number;
    eoq: number;
    status: 'fast' | 'medium' | 'slow' | 'dead';
    abc: 'A' | 'B' | 'C';
    xyz: 'X' | 'Y' | 'Z';
  };
  createdAt: string;
  [key: string]: any; // allow dynamic deletion of undefined keys
}

export interface InventoryPrivate {
  id: string;
  costPrice: number;
  supplierId?: string;
  lastPurchaseDate?: string;
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
  paymentMethod?: 'CASH' | 'UPI' | 'BANK' | 'CARD' | 'OTHER';
  paymentReference?: string;
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
  standardWorkingHours: number;
  allowStaffAttendance: boolean;
  recoveryEmail?: string;
}

export interface ShopPrivate {
  [key: string]: any;
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
  staffId?: string;
}

export type Action = 'view'|'create'|'edit'|'delete'|'export'|'override_price'|'void_sale'|'view_cost'|'view_profit'|'approve_credit';
export type Module = 'inventory'|'sales'|'customers'|'expenses'|'analytics'|'team'|'settings';
export type LimitedAction = boolean | { max?: number; requiresApproval?: boolean };
export type PermissionMatrix = { [M in Module]?: Partial<Record<Action, LimitedAction>> };

export interface Staff {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  joinedAt: string;
  status: 'active' | 'inactive' | 'suspended';
  permissions?: PermissionMatrix;
}

export interface StaffPrivate {
  id: string;
  salary: number;
  pin?: string;
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

export interface CustomerPayment {
  id: string;
  customerId: string;
  amount: number;
  date: string;
  createdAt: string;
}

// --- PHASE 5: AGENTIC WORKFLOWS ---

export interface PurchaseOrder {
  id: string;
  items: {
    itemId: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  total: number;
  status: 'draft' | 'approved' | 'sent' | 'cancelled';
  supplierName?: string;
  createdAt: string;
  createdBy: string;
}

export interface AgentAlert {
  id: string;
  type: 'VOID' | 'DISCOUNT' | 'MARGIN' | 'TIME' | 'OTHER';
  severity: 'low' | 'medium' | 'high';
  message: string;
  data: any;
  status: 'new' | 'dismissed' | 'resolved';
  createdAt: string;
}

export interface DailyBriefing {
  id: string; // YYYY-MM-DD
  summary: string;
  bullets: string[];
  metrics: {
    revenue: number;
    profit: number;
    growth: number;
  };
  createdAt: string;
}

export interface AgentRun {
  id: string;
  agentName: string;
  status: 'running' | 'completed' | 'failed';
  startedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentEvent {
  id: string;
  type: 'thinking' | 'tool_call' | 'response' | 'error';
  message: string;
  data?: any;
  timestamp: string;
}
