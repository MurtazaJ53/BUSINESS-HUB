import { SalesManager } from "@/components/sales-manager";
import { AppLayout } from "@/components/app-layout";
import { getSafeSession } from "@/lib/session-helper";

export const metadata = {
  title: "Sales History & Orders | Business Hub",
  description: "View sales ledger, invoices, payment breakdown, and refund receipts",
};

export default async function SalesPage() {
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
              Sales History & Invoices
            </h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              Complete transaction logs, customer invoices, payment breakdowns, and returns
            </p>
          </div>
        </div>

        <SalesManager />
      </div>
    </AppLayout>
  );
}
