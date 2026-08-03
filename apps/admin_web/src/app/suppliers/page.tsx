import { SuppliersPurchases } from "@/components/suppliers-purchases";
import { AppLayout } from "@/components/app-layout";
import { getSafeSession } from "@/lib/session-helper";

export const metadata = {
  title: "Suppliers Directory | Business Hub",
  description: "Manage vendors, purchase orders, payables, and inbound stock",
};

export default async function SuppliersPage() {
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
              Suppliers & Vendor Directory
            </h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              Supplier catalog, pending payables, contact details, and inward stock logs
            </p>
          </div>
        </div>

        <SuppliersPurchases />
      </div>
    </AppLayout>
  );
}
