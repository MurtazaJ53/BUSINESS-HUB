import { ReportsAnalytics } from "@/components/reports-analytics";
import { AppLayout } from "@/components/app-layout";
import { getSafeSession } from "@/lib/session-helper";

export const metadata = {
  title: "Reports & Analytics | Business Hub",
  description: "P&L income statements, GST tax breakdowns, product velocity, and audit reports",
};

export default async function ReportsPage() {
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
              Financial Intelligence & Reports
            </h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              Gross profit, GSTR-1 summaries, best-selling product analytics, and audit exports
            </p>
          </div>
        </div>

        <ReportsAnalytics />
      </div>
    </AppLayout>
  );
}
