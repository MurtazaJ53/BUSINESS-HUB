import type { BusinessHubPlanTier, ShopMembership } from "@/lib/types";

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
