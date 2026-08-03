import { ExpensesManager } from "@/components/expenses-manager";
import { AppLayout } from "@/components/app-layout";
import { getSafeSession } from "@/lib/session-helper";

export const metadata = {
  title: "Expenses & Petty Cash | Business Hub",
  description: "Track store operational expenses, rent, utilities, staff chai, and vendor payouts",
};

export default async function ExpensesPage() {
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
              Operational Expenses & Petty Cash
            </h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              Daily overhead tracking, recurring bills, rent, utility payouts & expense category analytics
            </p>
          </div>
        </div>

        <ExpensesManager />
      </div>
    </AppLayout>
  );
}
