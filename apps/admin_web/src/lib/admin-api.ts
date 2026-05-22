import "server-only";

import { cache } from "react";

import type {
  AttendanceSession,
  AttendanceStats,
  Customer,
  CustomerSummaryPayload,
  CustomerStats,
  DashboardSnapshot,
  Expense,
  ExpenseStats,
  InventoryItem,
  InventoryStats,
  ERPNextDocumentLink,
  ERPNextHealthPayload,
  ERPNextMetaPayload,
  ERPNextPocSummary,
  ERPNextPurchaseMirror,
  ERPNextShopBinding,
  ERPNextSupplierMirror,
  ERPNextSupplierPaymentMirror,
  ERPNextSyncState,
  MigrationDomainControl,
  MigrationBridgeReceipt,
  MigrationControlEvent,
  MigrationGoLiveCheckpointEvent,
  MigrationGoLiveReadiness,
  MigrationJobRun,
  MigrationLaunchCheckpointEvent,
  MigrationPhaseCheckpointEvent,
  MigrationPilotReadiness,
  MigrationPhaseReadiness,
  MigrationPilotSignoff,
  MigrationPilotShopScorecard,
  MigrationReconciliationEvent,
  MigrationRetirementReadiness,
  MigrationRolloutCheckpointEvent,
  MigrationRolloutReadiness,
  MigrationSteadyStateCheckpointEvent,
  MigrationSteadyStateReadiness,
  MigrationShopCheckpointEvent,
  MigrationShadowSummary,
  MigrationStats,
  PaymentStats,
  Sale,
  SalePaymentRecord,
  SalesSummaryPayload,
  SalesStats,
  SessionPayload,
  ShopDomainState,
  ShopMembership,
} from "@/lib/types";

type FetchOptions = {
  query?: Record<string, string | undefined>;
};

type MutationOptions = {
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
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

export async function apiMutation<T>(path: string, options: MutationOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  const headers = buildHeaders();
  const init: RequestInit = {
    method: options.method ?? "POST",
    headers,
    cache: "no-store",
  };

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, init);
  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(`Business Hub API mutation failed (${response.status}) for ${path}: ${bodyText}`);
  }

  if (!bodyText) {
    return undefined as T;
  }

  return JSON.parse(bodyText) as T;
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

export const getShopDomainState = cache(
  async (shopId: string, domain: string): Promise<ShopDomainState> => {
    return apiFetch<ShopDomainState>(`/shops/${shopId}/domain-state/${domain}/`);
  },
);

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

export const getCustomerSummary = cache(async (shopId: string): Promise<CustomerSummaryPayload> => {
  return apiFetch<CustomerSummaryPayload>(`/shops/${shopId}/customers/summary/`);
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

export const getSalesSummary = cache(async (shopId: string): Promise<SalesSummaryPayload> => {
  return apiFetch<SalesSummaryPayload>(`/shops/${shopId}/sales/summary/`);
});

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

export const getMigrationControlEvents = cache(async (): Promise<MigrationControlEvent[]> => {
  return apiFetch<MigrationControlEvent[]>("/migration/activity/");
});

export const getMigrationShopCheckpointEvents = cache(
  async (): Promise<MigrationShopCheckpointEvent[]> => {
    return apiFetch<MigrationShopCheckpointEvent[]>("/migration/pilot-shop-checkpoints/");
  },
);

export const getMigrationPhaseCheckpointEvents = cache(
  async (): Promise<MigrationPhaseCheckpointEvent[]> => {
    return apiFetch<MigrationPhaseCheckpointEvent[]>("/migration/phase-checkpoints/");
  },
);

export const getMigrationLaunchCheckpointEvents = cache(
  async (): Promise<MigrationLaunchCheckpointEvent[]> => {
    return apiFetch<MigrationLaunchCheckpointEvent[]>("/migration/launch-checkpoints/");
  },
);

export const getMigrationGoLiveCheckpointEvents = cache(
  async (): Promise<MigrationGoLiveCheckpointEvent[]> => {
    return apiFetch<MigrationGoLiveCheckpointEvent[]>("/migration/go-live-checkpoints/");
  },
);

export const getMigrationRolloutCheckpointEvents = cache(
  async (): Promise<MigrationRolloutCheckpointEvent[]> => {
    return apiFetch<MigrationRolloutCheckpointEvent[]>("/migration/rollout-checkpoints/");
  },
);

export const getMigrationSteadyStateCheckpointEvents = cache(
  async (): Promise<MigrationSteadyStateCheckpointEvent[]> => {
    return apiFetch<MigrationSteadyStateCheckpointEvent[]>("/migration/steady-state-checkpoints/");
  },
);

export const getMigrationShadowSummaries = cache(async (): Promise<MigrationShadowSummary[]> => {
  return apiFetch<MigrationShadowSummary[]>("/migration/shadow-summaries/");
});

export const getMigrationPilotReadiness = cache(async (): Promise<MigrationPilotReadiness[]> => {
  return apiFetch<MigrationPilotReadiness[]>("/migration/pilot-readiness/");
});

export const getMigrationPilotSignoff = cache(async (): Promise<MigrationPilotSignoff[]> => {
  return apiFetch<MigrationPilotSignoff[]>("/migration/pilot-signoff/");
});

export const getMigrationPilotShopScorecards = cache(
  async (): Promise<MigrationPilotShopScorecard[]> => {
    return apiFetch<MigrationPilotShopScorecard[]>("/migration/pilot-shop-scorecards/");
  },
);

export const getMigrationPhaseReadiness = cache(async (): Promise<MigrationPhaseReadiness> => {
  return apiFetch<MigrationPhaseReadiness>("/migration/phase-readiness/");
});

export const getMigrationRetirementReadiness = cache(
  async (): Promise<MigrationRetirementReadiness> => {
    return apiFetch<MigrationRetirementReadiness>("/migration/retirement-readiness/");
  },
);

export const getMigrationGoLiveReadiness = cache(
  async (): Promise<MigrationGoLiveReadiness> => {
    return apiFetch<MigrationGoLiveReadiness>("/migration/go-live-readiness/");
  },
);

export const getMigrationRolloutReadiness = cache(
  async (): Promise<MigrationRolloutReadiness> => {
    return apiFetch<MigrationRolloutReadiness>("/migration/rollout-readiness/");
  },
);

export const getMigrationSteadyStateReadiness = cache(
  async (): Promise<MigrationSteadyStateReadiness> => {
    return apiFetch<MigrationSteadyStateReadiness>("/migration/steady-state-readiness/");
  },
);

export const getMigrationReconciliationEvents = cache(
  async (): Promise<MigrationReconciliationEvent[]> => {
    return apiFetch<MigrationReconciliationEvent[]>("/migration/reconciliation/");
  },
);

export const getERPNextMeta = cache(async (): Promise<ERPNextMetaPayload> => {
  return apiFetch<ERPNextMetaPayload>("/erpnext/meta/");
});

export const getERPNextHealth = cache(async (): Promise<ERPNextHealthPayload> => {
  return apiFetch<ERPNextHealthPayload>("/erpnext/health/");
});

export const getERPNextBinding = cache(async (shopId: string): Promise<ERPNextShopBinding> => {
  return apiFetch<ERPNextShopBinding>(`/shops/${shopId}/erpnext/binding/`);
});

export const getERPNextSyncState = cache(async (shopId: string): Promise<ERPNextSyncState> => {
  return apiFetch<ERPNextSyncState>(`/shops/${shopId}/erpnext/sync-state/`);
});

export const getERPNextPocSummary = cache(async (shopId: string): Promise<ERPNextPocSummary> => {
  return apiFetch<ERPNextPocSummary>(`/shops/${shopId}/erpnext/poc-summary/`);
});

export const getERPNextSuppliers = cache(async (shopId: string): Promise<ERPNextSupplierMirror[]> => {
  return apiFetch<ERPNextSupplierMirror[]>(`/shops/${shopId}/erpnext/suppliers/`);
});

export const getERPNextPurchases = cache(async (shopId: string): Promise<ERPNextPurchaseMirror[]> => {
  return apiFetch<ERPNextPurchaseMirror[]>(`/shops/${shopId}/erpnext/purchases/`);
});

export const getERPNextSupplierPayments = cache(
  async (shopId: string): Promise<ERPNextSupplierPaymentMirror[]> => {
    return apiFetch<ERPNextSupplierPaymentMirror[]>(`/shops/${shopId}/erpnext/supplier-payments/`);
  },
);

export const getERPNextDocumentLinks = cache(async (shopId: string): Promise<ERPNextDocumentLink[]> => {
  return apiFetch<ERPNextDocumentLink[]>(`/shops/${shopId}/erpnext/document-links/`);
});

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
