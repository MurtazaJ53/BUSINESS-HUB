import { ReportsAnalytics } from "@/components/reports-analytics";
import { AdminShell } from "@/components/admin-shell";
import { getSession, resolveActiveShop } from "@/lib/admin-api";

export const metadata = {
  title: "Reports & Analytics | Business Hub",
  description: "P&L income statements, GST tax breakdowns, product velocity, and audit reports",
};

export default async function ReportsPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="reports"
      title="Financial Intelligence & Reports"
      subtitle="Gross profit, GSTR-1 summaries, best-selling product analytics, and audit exports"
    >
      <ReportsAnalytics />
    </AdminShell>
  );
}
