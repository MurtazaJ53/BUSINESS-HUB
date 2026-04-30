export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  firebase_uid: string;
  timezone: string;
  is_platform_admin: boolean;
};

export type ShopMembership = {
  id: string;
  role: "owner" | "admin" | "staff" | "viewer";
  status: "active" | "invited" | "disabled";
  permissions_version: number;
  permissions_json: Record<string, unknown>;
  shop: {
    id: string;
    name: string;
    slug: string;
    currency_code: string;
    timezone: string;
    is_active: boolean;
  };
};

export type SessionPayload = {
  user: SessionUser;
  memberships: ShopMembership[];
  active_shop_id: string | null;
};

export type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  subcategory: string;
  size: string;
  description: string;
  sell_price: string;
  status: string;
  tombstone: boolean;
  source_meta_json: Record<string, unknown>;
  stock_on_hand: number;
  cost_price: string | null;
  supplier_id: string | null;
  last_purchase_date: string | null;
};

export type InventoryStats = {
  totalItems: number;
  activeItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  categories: number;
  projectedSellValue: number;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  total_spent: string;
  balance: string;
  notes: string;
  status: string;
  tombstone: boolean;
  source_meta_json: Record<string, unknown>;
};

export type CustomerStats = {
  totalCustomers: number;
  activeCredits: number;
  totalOutstanding: number;
  totalLifetimeSpend: number;
};

export type Expense = {
  id: string;
  category: string;
  amount: string;
  description: string;
  payment_method: "CASH" | "UPI" | "BANK" | "CARD" | "OTHER";
  payment_reference: string;
  expense_date: string;
  tombstone: boolean;
  actor_name: string | null;
};

export type ExpenseStats = {
  totalEntries: number;
  totalAmount: number;
  uniqueCategories: number;
  biggestCategory: string | null;
};

export type AttendanceSession = {
  id: string;
  membership_id: string;
  member_name: string;
  member_role: string;
  session_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";
  total_hours: string | null;
  overtime_hours: string;
  bonus_amount: string;
  note: string;
  tombstone: boolean;
};

export type AttendanceStats = {
  totalSessions: number;
  presentCount: number;
  leaveCount: number;
  activeWorkersToday: number;
};

export type SaleItem = {
  id: string;
  inventory_item_id: string | null;
  name: string;
  sku: string;
  size: string;
  quantity: number;
  unit_price: string;
  unit_cost: string | null;
  line_total: string;
  is_return: boolean;
};

export type SalePayment = {
  id: string;
  payment_method: "CASH" | "UPI" | "BANK" | "CARD" | "CREDIT" | "OTHER";
  amount: string;
  reference_code: string;
  note: string;
  occurred_at: string;
};

export type Sale = {
  id: string;
  receipt_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  subtotal_amount: string;
  discount_amount: string;
  total_amount: string;
  amount_received: string;
  amount_due: string;
  payment_mode: string;
  footer_note: string;
  note: string;
  sale_date: string;
  occurred_at: string;
  status: string;
  tombstone: boolean;
  source_meta_json: Record<string, unknown>;
  actor_name: string | null;
  item_count: number;
  payment_count: number;
  items: SaleItem[];
  payments: SalePayment[];
};

export type SalePaymentRecord = {
  id: string;
  sale_id: string;
  receipt_number: string;
  customer_name: string;
  sale_total_amount: string;
  payment_method: "CASH" | "UPI" | "BANK" | "CARD" | "CREDIT" | "OTHER";
  amount: string;
  reference_code: string;
  note: string;
  occurred_at: string;
  actor_name: string | null;
};

export type SalesStats = {
  totalSales: number;
  grossRevenue: number;
  outstandingRevenue: number;
  averageTicket: number;
};

export type PaymentStats = {
  paymentCount: number;
  totalCollected: number;
  creditCount: number;
  digitalShareCount: number;
};
