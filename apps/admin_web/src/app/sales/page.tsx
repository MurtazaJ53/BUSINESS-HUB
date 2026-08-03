import { SalesManager } from "@/components/sales-manager";
import { AdminShell } from "@/components/admin-shell";
import { getSession, resolveActiveShop, getSales, getSalesSummary } from "@/lib/admin-api";

export const metadata = {
  title: "Sales History & Orders | Business Hub",
  description: "View sales ledger, invoices, payment breakdown, and refund receipts",
};

export default async function SalesPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const shopId = activeShop?.shop.id || "";

  const [sales, summary] = await Promise.all([
    getSales(shopId),
    getSalesSummary(shopId),
  ]);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="sales"
      title="Sales History & Invoices"
      subtitle="Complete transaction logs, customer invoices, payment breakdowns, and returns"
    >
      <SalesManager initialSales={sales} initialSummary={summary} shopId={shopId} />
    </AdminShell>
  );
}
