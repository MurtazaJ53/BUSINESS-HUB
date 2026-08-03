import { StoreSettings } from "@/components/store-settings";
import { AppLayout } from "@/components/app-layout";
import { getSafeSession } from "@/lib/session-helper";

export const metadata = {
  title: "Store Settings & Preferences | Business Hub",
  description: "Store profile, GST number, thermal printers, barcode scanners, and plan subscription",
};

export default async function SettingsPage() {
  const { user, currentShopId, currentShopName, planTier, memberships } =
    await getSafeSession();

  return (
    <AppLayout
      user={user}
      currentShopId={currentShopId}
      currentShopName={currentShopName}
      planTier={planTier}
      memberships={memberships}
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Store Configuration & Hardware
            </h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              Business profile, GSTIN configuration, thermal ESC/POS printers, and plan tiers
            </p>
          </div>
        </div>

        <StoreSettings
          currentShopName={currentShopName}
          planTier={planTier}
        />
      </div>
    </AppLayout>
  );
}
