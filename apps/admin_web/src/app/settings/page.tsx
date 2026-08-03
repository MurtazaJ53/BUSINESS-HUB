import { StoreSettings } from "@/components/store-settings";
import { AdminShell } from "@/components/admin-shell";
import { getSession, resolveActiveShop } from "@/lib/admin-api";

export const metadata = {
  title: "Store Settings & Preferences | Business Hub",
  description: "Store profile, GST number, thermal printers, barcode scanners, and plan subscription",
};

export default async function SettingsPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const rawTier = activeShop?.shop?.plan_tier;
  const planTier = rawTier === "growth" || rawTier === "pro" ? rawTier : "starter";

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="settings"
      title="Store Configuration & Hardware"
      subtitle="Business profile, GSTIN configuration, thermal ESC/POS printers, and plan tiers"
    >
      <StoreSettings
        currentShopName={activeShop?.shop.name || "Business Hub Store"}
        planTier={planTier}
      />
    </AdminShell>
  );
}
