import "server-only";

import { cache } from "react";

import type {
  AttendanceSession,
  AttendanceStats,
  Customer,
  CustomerStats,
  DashboardSnapshot,
  Expense,
  ExpenseStats,
  InventoryItem,
  InventoryStats,
  MigrationDomainControl,
  MigrationBridgeReceipt,
  MigrationJobRun,
  MigrationPilotReadiness,
  MigrationReconciliationEvent,
  MigrationShadowSummary,
  MigrationStats,
  PaymentStats,
  Sale,
  SalePaymentRecord,
  SalesStats,
  SessionPayload,
  ShopMembership,
} from "@/lib/types";

type FetchOptions = {
  query?: Record<string, string | undefined>;
};

const API_BASE_URL =
  process.env.BUSINESS_HUB_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api/v1";

function buildHeaders() {
  const headers = new Headers({
    Accept: "application/json",
  });

  const devEmail = process.env.BUSINESS_HUB_DEV_USER_EMAIL?.trim();
  if (devEmail) {
    headers.set("X-Dev-User-Email", devEmail);
  }

  const devName = process.env.BUSINESS_HUB_DEV_USER_NAME?.trim();
  if (devName) {
    headers.set("X-Dev-User-Name", devName);
  }

  const devPlatformAdmin = process.env.BUSINESS_HUB_DEV_PLATFORM_ADMIN?.trim();
  if (devPlatformAdmin) {
    headers.set("X-Dev-Platform-Admin", devPlatformAdmin);
  }

  return headers;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url, {
    headers: buildHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Business Hub API request failed (${response.status}) for ${path}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export const getSession = cache(async (): Promise<SessionPayload> => {
  return apiFetch<SessionPayload>("/session/");
});

export const getMemberships = cache(async (): Promise<ShopMembership[]> => {
  return apiFetch<ShopMembership[]>("/shops/");
});

export const getInventory = cache(async (shopId: string, query?: string): Promise<InventoryItem[]> => {
  return apiFetch<InventoryItem[]>(`/shops/${shopId}/inventory/`, {
    query: {
      q: query,
    },
  });
});

export const getDashboardSnapshot = cache(async (shopId: string): Promise<DashboardSnapshot> => {
  return apiFetch<DashboardSnapshot>(`/shops/${shopId}/projections/dashboard/`);
});

export const getCustomers = cache(async (shopId: string, query?: string): Promise<Customer[]> => {
  return apiFetch<Customer[]>(`/shops/${shopId}/customers/`, {
    query: {
      q: query,
    },
  });
});

export const getExpenses = cache(async (shopId: string, query?: string): Promise<Expense[]> => {
  return apiFetch<Expense[]>(`/shops/${shopId}/expenses/`, {
    query: {
      q: query,
    },
  });
});

export const getAttendanceSessions = cache(
  async (shopId: string, query?: { dateFrom?: string; dateTo?: string }): Promise<AttendanceSession[]> => {
    return apiFetch<AttendanceSession[]>(`/shops/${shopId}/attendance/`, {
      query: {
        date_from: query?.dateFrom,
        date_to: query?.dateTo,
      },
    });
  },
);

export const getSales = cache(
  async (
    shopId: string,
    query?: { q?: string; dateFrom?: string; dateTo?: string; customerId?: string },
  ): Promise<Sale[]> => {
    return apiFetch<Sale[]>(`/shops/${shopId}/sales/`, {
      query: {
        q: query?.q,
        date_from: query?.dateFrom,
        date_to: query?.dateTo,
        customer_id: query?.customerId,
      },
    });
  },
);

export const getPayments = cache(
  async (
    shopId: string,
    query?: { saleId?: string; dateFrom?: string; dateTo?: string },
  ): Promise<SalePaymentRecord[]> => {
    return apiFetch<SalePaymentRecord[]>(`/shops/${shopId}/payments/`, {
      query: {
        sale_id: query?.saleId,
        date_from: query?.dateFrom,
        date_to: query?.dateTo,
      },
    });
  },
);

export const getMigrationControls = cache(async (): Promise<MigrationDomainControl[]> => {
  return apiFetch<MigrationDomainControl[]>("/migration/domains/");
});

export const getMigrationJobRuns = cache(async (): Promise<MigrationJobRun[]> => {
  return apiFetch<MigrationJobRun[]>("/migration/jobs/");
});

export const getMigrationBridgeReceipts = cache(async (): Promise<MigrationBridgeReceipt[]> => {
  return apiFetch<MigrationBridgeReceipt[]>("/migration/bridge-receipts/");
});

export const getMigrationShadowSummaries = cache(async (): Promise<MigrationShadowSummary[]> => {
  return apiFetch<MigrationShadowSummary[]>("/migration/shadow-summaries/");
});

export const getMigrationPilotReadiness = cache(async (): Promise<MigrationPilotReadiness[]> => {
  return apiFetch<MigrationPilotReadiness[]>("/migration/pilot-readiness/");
});

export const getMigrationReconciliationEvents = cache(
  async (): Promise<MigrationReconciliationEvent[]> => {
    return apiFetch<MigrationReconciliationEvent[]>("/migration/reconciliation/");
  },
);

export function resolveActiveShop(session: SessionPayload): ShopMembership | null {
  if (!session.active_shop_id) {
    return session.memberships[0] ?? null;
  }

  return (
    session.memberships.find((membership) => membership.shop.id === session.active_shop_id) ??
    session.memberships[0] ??
    null
  );
}

export function buildInventoryStats(items: InventoryItem[]): InventoryStats {
  const categorySet = new Set(
    items
      .map((item) => item.category.trim())
      .filter(Boolean),
  );

  const projectedSellValue = items.reduce((total, item) => {
    const price = Number(item.sell_price);
    return total + (Number.isFinite(price) ? price : 0) * item.stock_on_hand;
  }, 0);

  return {
    totalItems: items.length,
    activeItems: items.filter((item) => item.status === "active" && !item.tombstone).length,
    lowStockItems: items.filter((item) => item.stock_on_hand > 0 && item.stock_on_hand <= 5).length,
    outOfStockItems: items.filter((item) => item.stock_on_hand <= 0).length,
    categories: categorySet.size,
    projectedSellValue,
  };
}

export function buildCustomerStats(customers: Customer[]): CustomerStats {
  return {
    totalCustomers: customers.length,
    activeCredits: customers.filter((customer) => Number(customer.balance) > 0).length,
    totalOutstanding: customers.reduce((total, customer) => total + Number(customer.balance || 0), 0),
    totalLifetimeSpend: customers.reduce((total, customer) => total + Number(customer.total_spent || 0), 0),
  };
}

export function buildExpenseStats(expenses: Expense[]): ExpenseStats {
  const totalsByCategory = new Map<string, number>();

  for (const expense of expenses) {
    const amount = Number(expense.amount || 0);
    totalsByCategory.set(expense.category, (totalsByCategory.get(expense.category) ?? 0) + amount);
  }

  let biggestCategory: string | null = null;
  let biggestAmount = -1;
  for (const [category, total] of totalsByCategory.entries()) {
    if (total > biggestAmount) {
      biggestAmount = total;
      biggestCategory = category;
    }
  }

  return {
    totalEntries: expenses.length,
    totalAmount: expenses.reduce((total, expense) => total + Number(expense.amount || 0), 0),
    uniqueCategories: totalsByCategory.size,
    biggestCategory,
  };
}

export function buildAttendanceStats(
  sessions: AttendanceSession[],
  today: string,
): AttendanceStats {
  return {
    totalSessions: sessions.length,
    presentCount: sessions.filter((session) => session.status === "PRESENT").length,
    leaveCount: sessions.filter((session) => session.status === "LEAVE").length,
    activeWorkersToday: sessions.filter(
      (session) =>
        session.session_date === today &&
        (session.status === "PRESENT" || session.status === "HALF_DAY"),
    ).length,
  };
}

export function buildSalesStats(sales: Sale[]): SalesStats {
  const grossRevenue = sales.reduce((total, sale) => total + Number(sale.total_amount || 0), 0);
  const outstandingRevenue = sales.reduce((total, sale) => total + Number(sale.amount_due || 0), 0);

  return {
    totalSales: sales.length,
    grossRevenue,
    outstandingRevenue,
    averageTicket: sales.length ? grossRevenue / sales.length : 0,
  };
}

export function buildPaymentStats(payments: SalePaymentRecord[]): PaymentStats {
  return {
    paymentCount: payments.length,
    totalCollected: payments.reduce((total, payment) => total + Number(payment.amount || 0), 0),
    creditCount: payments.filter((payment) => payment.payment_method === "CREDIT").length,
    digitalShareCount: payments.filter((payment) =>
      ["UPI", "BANK", "CARD"].includes(payment.payment_method),
    ).length,
  };
}

export function buildMigrationStats(
  controls: MigrationDomainControl[],
  jobs: MigrationJobRun[],
  receipts: MigrationBridgeReceipt[],
  readiness: MigrationPilotReadiness[],
  events: MigrationReconciliationEvent[],
): MigrationStats {
  return {
    totalControls: controls.length,
    postgresPrimaryDomains: controls.filter((control) => control.write_master === "postgres").length,
    activeBridgeDomains: controls.filter((control) => control.bridge_mode !== "disabled").length,
    bridgeReceipts: receipts.length,
    pilotReadyDomains: readiness.filter((item) => item.ready_for_pilot).length,
    openCriticalEvents: events.filter(
      (event) => event.severity === "critical" && ["open", "acknowledged"].includes(event.status),
    ).length,
    openStaleEpochEvents: events.filter(
      (event) => event.issue_code === "stale_bridge_epoch" && ["open", "acknowledged"].includes(event.status),
    ).length,
    runningJobs: jobs.filter((job) => job.status === "running").length,
  };
}
