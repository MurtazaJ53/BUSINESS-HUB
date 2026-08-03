import { InventoryManager } from "@/components/inventory-manager";
import { AppLayout } from "@/components/app-layout";
import { getSafeSession } from "@/lib/session-helper";

export const metadata = {
  title: "Inventory Management | Business Hub",
  description: "Manage products, barcodes, stock levels, variants, and low-stock alerts",
};

export default async function InventoryPage() {
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
              Inventory & Catalog
            </h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              Real-time stock valuation, barcode registry, low-stock threshold triggers & batch adjustments
            </p>
          </div>
        </div>

        <InventoryManager />
      </div>
    </AppLayout>
  );
}
