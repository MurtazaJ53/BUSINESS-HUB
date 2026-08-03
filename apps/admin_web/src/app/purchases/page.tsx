import { SuppliersPurchases } from "@/components/suppliers-purchases";
import { AppLayout } from "@/components/app-layout";
import { getSafeSession } from "@/lib/session-helper";

export const metadata = {
  title: "Inward Stock & Purchases | Business Hub",
  description: "Record inward stock orders, purchase bills, and vendor payments",
};

export default async function PurchasesPage() {
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
              Inward Purchase Bills & Stock In
            </h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              Supplier invoices, item stock increments, cost tracking, and credit payments
            </p>
          </div>
        </div>

        <SuppliersPurchases />
      </div>
    </AppLayout>
  );
}
