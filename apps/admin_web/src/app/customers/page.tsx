import { CustomersKhata } from "@/components/customers-khata";
import { AppLayout } from "@/components/app-layout";
import { getSafeSession } from "@/lib/session-helper";

export const metadata = {
  title: "Customers & Khata Ledger | Business Hub",
  description: "Manage customer profiles, store credit, receivables, and payment reminders",
};

export default async function CustomersPage() {
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
              Customer CRM & Udhaar Khata
            </h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              Store credit ledger, balance reminders, customer loyalty, and repayment logging
            </p>
          </div>
        </div>

        <CustomersKhata />
      </div>
    </AppLayout>
  );
}
