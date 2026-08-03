import { getSession, resolveActiveShop } from "@/lib/admin-api";
import type { SessionPayload, ShopMembership, SessionUser, BusinessHubPlanTier } from "@/lib/types";

export interface SafeSessionData {
  session: SessionPayload | null;
  user: SessionUser | null;
  activeShop: ShopMembership | null;
  currentShopId: string | undefined;
  currentShopName: string;
  planTier: BusinessHubPlanTier;
  memberships: ShopMembership[];
}

export async function getSafeSession(): Promise<SafeSessionData> {
  try {
    const session = await getSession();
    const activeShop = resolveActiveShop(session);
    const rawTier = activeShop?.shop?.plan_tier;
    const planTier: BusinessHubPlanTier =
      rawTier === "growth" || rawTier === "pro" ? rawTier : "starter";

    return {
      session,
      user: session?.user ?? null,
      activeShop,
      currentShopId: activeShop?.shop?.id,
      currentShopName: activeShop?.shop?.name ?? "Business Hub Store",
      planTier,
      memberships: session?.memberships ?? [],
    };
  } catch {
    return {
      session: null,
      user: null,
      activeShop: null,
      currentShopId: undefined,
      currentShopName: "Business Hub Store",
      planTier: "starter",
      memberships: [],
    };
  }
}
