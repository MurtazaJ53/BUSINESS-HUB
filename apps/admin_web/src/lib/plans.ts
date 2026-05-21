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
