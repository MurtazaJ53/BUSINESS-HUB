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
