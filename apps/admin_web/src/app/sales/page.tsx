import { AdminShell } from "@/components/admin-shell";
import { DomainPilotSignoffCard } from "@/components/domain-pilot-signoff-card";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { SalesTable } from "@/components/sales-table";
import {
  buildSalesStats,
  getShopDomainState,
  getSales,
  getSession,
  resolveActiveShop,
} from "@/lib/admin-api";
import { formatCurrency } from "@/lib/formatters";
import { canAccessAdvancedReports, canAccessFinanceSummary, formatPlanTier } from "@/lib/plans";

export default async function SalesPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const [sales, domainState] = activeShop
    ? await Promise.all([
        getSales(activeShop.shop.id),
        getShopDomainState(activeShop.shop.id, "sales"),
      ])
    : [[], null];
  const stats = buildSalesStats(sales);
  const canUseAdvancedReports = canAccessAdvancedReports(activeShop);
  const canUseFinanceSummary = canAccessFinanceSummary(activeShop);
  const creditHeavy = sales
    .filter((sale) => Number(sale.amount_due) > 0)
    .sort((left, right) => Number(right.amount_due) - Number(left.amount_due))
    .slice(0, 6);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="sales"
      title="Sales overview"
      subtitle="Review receipts, credit exposure, and sales performance without dropping into a technical commerce console."
    >
      {!activeShop ? (
        <EmptyState
          title="No sales workspace available"
          body="This web workspace needs an active shop membership before it can show receipts and sales performance for a store."
        />
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Receipts captured"
              value={stats.totalSales.toString()}
              detail="Sales currently recorded for this store"
              icon="ORD"
            />
            <MetricCard
              label="Gross revenue"
              value={formatCurrency(stats.grossRevenue, activeShop.shop.currency_code)}
              detail="Total receipt value before refunds or later adjustments"
              accent="green"
              icon="REV"
            />
            {canUseFinanceSummary ? (
              <MetricCard
                label="Outstanding due"
                value={formatCurrency(stats.outstandingRevenue, activeShop.shop.currency_code)}
                detail="Credit exposure still open on recorded sales"
                accent="rose"
                icon="DUE"
              />
            ) : (
              <MetricCard
                label="Plan insight"
                value={`${formatPlanTier(activeShop.shop.plan_tier)} plan`}
                detail="Finance rollups stay hidden until Pro."
                accent="blue"
                icon="PLN"
              />
            )}
            {canUseAdvancedReports ? (
              <MetricCard
                label="Average ticket"
                value={formatCurrency(stats.averageTicket, activeShop.shop.currency_code)}
                detail="Average sale value across captured receipts"
                accent="blue"
                icon="AVG"
              />
            ) : (
              <MetricCard
                label="Receipt mode"
                value="Simple review"
                detail="Detailed sales analytics unlock on Pro."
                accent="green"
                icon="LGT"
              />
            )}
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
            <div className="space-y-6">
              <section className="panel-soft rounded-[28px] px-6 py-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="eyebrow">Receipt list</p>
                    <h2 className="mt-3 text-2xl font-bold">Recent sales</h2>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      Use this page to review receipts, payment mix, and open dues for the active
                      store.
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
              </section>
            </div>

            <div className="space-y-6">
              {domainState ? (
                <DomainPilotSignoffCard domainState={domainState} domainLabel="Sales" />
              ) : null}

              {canUseFinanceSummary ? (
                <section className="panel-soft rounded-[28px] px-6 py-6">
                  <p className="eyebrow">Credit watch</p>
                  <h2 className="mt-3 text-2xl font-bold">Receipts with open due</h2>
                  <div className="mt-5 space-y-3">
                    {creditHeavy.length ? (
                      creditHeavy.map((sale) => (
                        <div
                          key={sale.id}
                          className="surface-muted flex items-center justify-between rounded-[20px] px-4 py-4"
                        >
                          <div>
                            <p className="font-semibold">{sale.receipt_number}</p>
                            <p className="mt-1 text-sm text-[var(--text-secondary)]">
                              {sale.customer_name || "Walk-in"} | {sale.sale_date}
                            </p>
                          </div>
                          <span className="rounded-full border border-[rgba(255,138,106,0.18)] px-3 py-1 text-sm font-semibold text-[var(--warning)]">
                            {formatCurrency(Number(sale.amount_due), activeShop.shop.currency_code)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)]">
                        No receipts with urgent due balances are showing right now.
                      </p>
                    )}
                  </div>
                </section>
              ) : (
                <section className="panel-soft rounded-[28px] px-6 py-6">
                  <p className="eyebrow">Upgrade path</p>
                  <h2 className="mt-3 text-2xl font-bold">Finance watch stays hidden</h2>
                  <p className="mt-5 text-sm leading-7 text-[var(--text-secondary)]">
                    This workspace still lets owners review receipts, but credit-heavy sales rollups and deeper
                    revenue analysis stay behind Pro.
                  </p>
                </section>
              )}

              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Use this page for</p>
                <h2 className="mt-3 text-2xl font-bold">Fast sales review</h2>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                  <li>- Open recent receipts without leaving the Business Hub workflow.</li>
                  <li>- Watch how much revenue is still tied up in customer credit.</li>
                  <li>- Keep sales review simple for owners and managers, not accounting-heavy.</li>
                </ul>
              </section>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
