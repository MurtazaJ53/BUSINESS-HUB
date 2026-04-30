import { AdminShell } from "@/components/admin-shell";
import { CustomerTable } from "@/components/customer-table";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { buildCustomerStats, getCustomers, getSession, resolveActiveShop } from "@/lib/admin-api";
import { formatCurrency } from "@/lib/formatters";

export default async function CustomersPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const customers = activeShop ? await getCustomers(activeShop.shop.id) : [];
  const stats = buildCustomerStats(customers);
  const highCreditCustomers = customers
    .filter((customer) => Number(customer.balance) > 0)
    .sort((left, right) => Number(right.balance) - Number(left.balance))
    .slice(0, 6);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="customers"
      title="Customer Ledger"
      subtitle="Phase 1 customer master and lightweight ledger contract. This is the first bridge toward balances, credit control, and post-sale relationship workflows on the new backend."
    >
      {!activeShop ? (
        <EmptyState
          title="No customer scope available"
          body="The admin shell needs an active shop membership before it can query customers. Once your workspace is bootstrapped, this screen will hydrate from the Django customer APIs."
        />
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Customer base"
              value={stats.totalCustomers.toString()}
              detail="Total customer records in the active shop"
              icon="CUS"
            />
            <MetricCard
              label="Outstanding accounts"
              value={stats.activeCredits.toString()}
              detail="Customers with a positive outstanding balance"
              accent="rose"
              icon="CRD"
            />
            <MetricCard
              label="Outstanding balance"
              value={formatCurrency(stats.totalOutstanding, activeShop.shop.currency_code)}
              detail="Open udhaar exposure in the active shop"
              accent="blue"
              icon="DUE"
            />
            <MetricCard
              label="Lifetime customer spend"
              value={formatCurrency(stats.totalLifetimeSpend, activeShop.shop.currency_code)}
              detail="Customer revenue captured in phase 1 records"
              accent="green"
              icon="LTV"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
            <div className="panel-soft rounded-[28px] px-6 py-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="eyebrow">Customer dataset</p>
                  <h2 className="mt-3 text-2xl font-bold">Live backend results</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    This screen is reading
                    {" "}
                    <code>/api/v1/shops/{activeShop.shop.id}/customers/</code>
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
                <CustomerTable customers={customers} currencyCode={activeShop.shop.currency_code} />
              </div>
            </div>

            <div className="space-y-6">
              <div className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Credit watch</p>
                <h2 className="mt-3 text-2xl font-bold">Highest outstanding balances</h2>
                <div className="mt-5 space-y-3">
                  {highCreditCustomers.length ? (
                    highCreditCustomers.map((customer) => (
                      <div
                        key={customer.id}
                        className="flex items-center justify-between rounded-[20px] border border-[rgba(251,113,133,0.12)] bg-[rgba(34,10,18,0.68)] px-4 py-4"
                      >
                        <div>
                          <p className="font-semibold">{customer.name}</p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {customer.phone || "No phone"}{customer.email ? ` · ${customer.email}` : ""}
                          </p>
                        </div>
                        <span className="rounded-full border border-[rgba(251,113,133,0.16)] px-3 py-1 text-sm font-semibold text-[var(--warning)]">
                          {formatCurrency(Number(customer.balance), activeShop.shop.currency_code)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      No credit-heavy customers yet in the current preview.
                    </p>
                  )}
                </div>
              </div>

              <div className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Ledger bridge note</p>
                <h2 className="mt-3 text-2xl font-bold">What this slice proves</h2>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                  <li>• Customer master data is now normalized per shop in Django.</li>
                  <li>• Opening balances generate append-only ledger facts.</li>
                  <li>• Future payment and sale cutovers can reuse the same ledger pattern.</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
