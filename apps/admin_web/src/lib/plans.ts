import type { BusinessHubPlanTier, ShopMembership } from "@/lib/types";

export const orderedPlanTiers: readonly BusinessHubPlanTier[] = [
  "starter",
  "growth",
  "pro",
] as const;

export type ShopFeatureKey =
  | "expenses"
  | "attendance"
  | "supplier_directory"
  | "purchase_workflow"
  | "advanced_reports"
  | "multi_branch"
  | "finance_summary"
  | "advanced_ops";

const fallbackFeaturesByTier: Record<BusinessHubPlanTier, Record<ShopFeatureKey, boolean>> = {
  starter: {
    expenses: false,
    attendance: false,
    supplier_directory: false,
    purchase_workflow: false,
    advanced_reports: false,
    multi_branch: false,
    finance_summary: false,
    advanced_ops: false,
  },
  growth: {
    expenses: true,
    attendance: true,
    supplier_directory: true,
    purchase_workflow: false,
    advanced_reports: false,
    multi_branch: false,
    finance_summary: false,
    advanced_ops: false,
  },
  pro: {
    expenses: true,
    attendance: true,
    supplier_directory: true,
    purchase_workflow: true,
    advanced_reports: true,
    multi_branch: true,
    finance_summary: true,
    advanced_ops: true,
  },
};

export function formatPlanTier(planTier: BusinessHubPlanTier): string {
  switch (planTier) {
    case "starter":
      return "Starter";
    case "growth":
      return "Growth";
    case "pro":
      return "Pro";
  }
}

export function hasShopFeature(
  activeShop: ShopMembership | null,
  featureKey: ShopFeatureKey,
): boolean {
  if (!activeShop) {
    return false;
  }

  const explicit = activeShop.shop.enabled_features?.[featureKey];
  if (typeof explicit === "boolean") {
    return explicit;
  }

  return fallbackFeaturesByTier[activeShop.shop.plan_tier][featureKey];
}

export function canAccessExpenses(activeShop: ShopMembership | null): boolean {
  return hasShopFeature(activeShop, "expenses");
}

export function canAccessAttendance(activeShop: ShopMembership | null): boolean {
  return hasShopFeature(activeShop, "attendance");
}

export function canAccessAdvancedReports(activeShop: ShopMembership | null): boolean {
  return hasShopFeature(activeShop, "advanced_reports");
}

export function canAccessFinanceSummary(activeShop: ShopMembership | null): boolean {
  return hasShopFeature(activeShop, "finance_summary");
}

export function canAccessSupplierDirectory(activeShop: ShopMembership | null): boolean {
  return hasShopFeature(activeShop, "supplier_directory");
}

export function canAccessPurchaseWorkflow(activeShop: ShopMembership | null): boolean {
  return hasShopFeature(activeShop, "purchase_workflow");
}

export function getPlanCompareSnapshot(planTier: BusinessHubPlanTier): {
  currentLabel: string;
  currentLines: string[];
  nextLabel: string;
  nextLines: string[];
} {
  switch (planTier) {
    case "starter":
      return {
        currentLabel: "Starter now",
        currentLines: [
          "POS and barcode selling",
          "Inventory and low-stock watch",
          "Customer balances and receipts",
        ],
        nextLabel: "Growth next",
        nextLines: [
          "Expenses and attendance",
          "Supplier-ready store operations",
          "More operational control without ERP clutter",
        ],
      };
    case "growth":
      return {
        currentLabel: "Growth now",
        currentLines: [
          "Everything in Starter",
          "Expenses and attendance",
          "Supplier directory basics",
        ],
        nextLabel: "Pro next",
        nextLines: [
          "Finance and owner summary rollups",
          "Advanced customer and sales insight",
          "Stronger owner/admin control surfaces",
        ],
      };
    case "pro":
      return {
        currentLabel: "Pro now",
        currentLines: [
          "Finance and advanced reporting",
          "Deeper owner/admin controls",
          "The full curated Business Hub stack",
        ],
        nextLabel: "Keep it curated",
        nextLines: [
          "Limit deep tools to owners and admins",
          "Keep daily screens simple for staff",
          "Avoid exposing raw ERP complexity",
        ],
      };
  }
}

export function getPlanIncludedNow(planTier: BusinessHubPlanTier): string[] {
  switch (planTier) {
    case "starter":
      return [
        "POS and barcode selling",
        "Inventory browsing and low-stock watch",
        "Customer balances and receipt history",
        "Simple store settings",
      ];
    case "growth":
      return [
        "Everything in Starter",
        "Expenses and attendance",
        "Supplier directory basics",
        "Daily store operations with less clutter",
      ];
    case "pro":
      return [
        "Everything in Growth",
        "Deeper customer and sales insights",
        "Finance and advanced reporting summaries",
        "Advanced owner/admin control surfaces",
      ];
  }
}

export function getPlanUnlockNext(planTier: BusinessHubPlanTier): {
  title: string;
  body: string;
} {
  switch (planTier) {
    case "starter":
      return {
        title: "Growth unlocks store operations",
        body: "Upgrade when the shop needs expenses, attendance, and light supplier workflows without becoming ERP-heavy.",
      };
    case "growth":
      return {
        title: "Pro unlocks deeper business control",
        body: "Upgrade when the owner needs richer finance summaries, advanced reports, and stronger admin/support tools.",
      };
    case "pro":
      return {
        title: "Pro already includes the full curated stack",
        body: "Keep the workspace focused and only expose deeper controls to the right owners and admins.",
      };
  }
}

export function getPlanAudience(planTier: BusinessHubPlanTier): {
  title: string;
  body: string;
} {
  switch (planTier) {
    case "starter":
      return {
        title: "Best for focused counter operations",
        body: "Use Starter when the shop mainly needs selling, stock lookup, customer balances, and simple day-to-day flow without operational extras.",
      };
    case "growth":
      return {
        title: "Best for active store management",
        body: "Use Growth when the owner needs expenses, attendance, and supplier-aware store operations but still wants a curated product instead of a heavy ERP workspace.",
      };
    case "pro":
      return {
        title: "Best for deeper owner control",
        body: "Use Pro when the owner needs richer finance summaries, advanced reporting, and stronger admin/support controls while still hiding raw ERP complexity from staff.",
      };
  }
}
