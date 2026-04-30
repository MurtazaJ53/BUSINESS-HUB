import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { SalesTable } from "@/components/sales-table";
import {
  buildSalesStats,
  getSales,
  getSession,
  resolveActiveShop,
} from "@/lib/admin-api";
import { formatCurrency } from "@/lib/formatters";

export default async function SalesPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const sales = activeShop ? await getSales(activeShop.shop.id) : [];
  const stats = buildSalesStats(sales);
  const creditHeavy = sales
    .filter((sale) => Number(sale.amount_due) > 0)
    .sort((left, right) => Number(right.amount_due) - Number(left.amount_due))
    .slice(0, 6);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="sales"
      title="Sales Ledger"
      subtitle="Phase 1 commerce contract backed by normalized sales, items, payments, stock movements, and customer ledger effects in Django."
    >
      {!activeShop ? (
        <EmptyState
          title="No sales scope available"
          body="The admin shell needs an active shop membership before it can query sales. Once your workspace is bootstrapped, this route will hydrate from the Django sales APIs."
        />
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Orders captured"
              value={stats.totalSales.toString()}
              detail="Phase 1 sales documents stored in PostgreSQL"
              icon="ORD"
            />
            <MetricCard
              label="Gross revenue"
              value={formatCurrency(stats.grossRevenue, activeShop.shop.currency_code)}
              detail="Total order value before future refunds and voids"
              accent="green"
              icon="REV"
            />
            <MetricCard
              label="Outstanding due"
              value={formatCurrency(stats.outstandingRevenue, activeShop.shop.currency_code)}
              detail="Credit exposure still open against recorded sales"
              accent="rose"
              icon="DUE"
            />
            <MetricCard
              label="Average ticket"
              value={formatCurrency(stats.averageTicket, activeShop.shop.currency_code)}
              detail="Useful first KPI for the new commerce contract"
              accent="blue"
              icon="AVG"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
            <div className="panel-soft rounded-[28px] px-6 py-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="eyebrow">Sales dataset</p>
                  <h2 className="mt-3 text-2xl font-bold">Live backend results</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    This screen is reading
                    {" "}
                    <code>/api/v1/shops/{activeShop.shop.id}/sales/</code>
                    {" "}
                    from the new Django phase 1 backend.
                  </p>
                </div>
                <div className="rounded-[18px] border border-[rgba(152,164,189,0.12)] bg-[rgba(13,18,28,0.68)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  Shop
                  <div className="mt-1 text-base font-semibold text-[var(--text-primary)]">
                    {activeShop.shop.name}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <SalesTable sales={sales} currencyCode={activeShop.shop.currency_code} />
              </div>
            </div>

            <div className="space-y-6">
              <div className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Credit watch</p>
                <h2 className="mt-3 text-2xl font-bold">Highest unsettled tickets</h2>
                <div className="mt-5 space-y-3">
                  {creditHeavy.length ? (
                    creditHeavy.map((sale) => (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between rounded-[20px] border border-[rgba(251,113,133,0.12)] bg-[rgba(34,10,18,0.68)] px-4 py-4"
                      >
                        <div>
                          <p className="font-semibold">{sale.receipt_number}</p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {sale.customer_name || "Walk-in"} | {sale.sale_date}
                          </p>
                        </div>
                        <span className="rounded-full border border-[rgba(251,113,133,0.16)] px-3 py-1 text-sm font-semibold text-[var(--warning)]">
                          {formatCurrency(Number(sale.amount_due), activeShop.shop.currency_code)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      No outstanding credit-heavy orders in the current preview.
                    </p>
                  )}
                </div>
              </div>

              <div className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Phase 1 proof</p>
                <h2 className="mt-3 text-2xl font-bold">What this slice proves</h2>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                  <li>- Sales are normalized into header, items, and payments.</li>
                  <li>- Inventory ledger and customer ledger update through the sales write path.</li>
                  <li>- This is the first safe bridge toward POS cutover in later phases.</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
