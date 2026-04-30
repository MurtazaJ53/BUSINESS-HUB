import { AdminShell } from "@/components/admin-shell";
import { CustomerTable } from "@/components/customer-table";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import {
  buildCustomerStats,
  getCustomers,
  getSession,
  getShopDomainState,
  resolveActiveShop,
} from "@/lib/admin-api";
import { formatCurrency } from "@/lib/formatters";

function buildCustomerModeCopy(
  domainState: Awaited<ReturnType<typeof getShopDomainState>>,
) {
  if (domainState.can_write_on_postgres_surface) {
    return {
      accent:
        "border-[rgba(52,211,153,0.22)] bg-[rgba(7,33,25,0.84)] text-[var(--success)]" as const,
      badge: "Postgres primary",
      title: "Customer master is now running on PostgreSQL.",
      body:
        "This shop has already promoted customer ownership to the new backend. New customer writes are valid on the Django path, while reconciliation and bridge health remain visible in the migration console.",
    };
  }

  if (domainState.control_present) {
    return {
      accent:
        "border-[rgba(251,113,133,0.22)] bg-[rgba(40,12,19,0.84)] text-[var(--warning)]" as const,
      badge: "Shadow / pilot guard",
      title: "Customer master is still protected by the legacy write owner.",
      body:
        "This shop is in pilot posture, but PostgreSQL is not yet the customer write master. Use this screen to inspect read parity and balances while the migration gate decides when promotion is safe.",
    };
  }

  return {
    accent:
      "border-[rgba(92,174,254,0.22)] bg-[rgba(9,18,34,0.82)] text-[var(--accent)]" as const,
    badge: "Legacy baseline",
    title: "Customer master is still operating in the legacy migration baseline.",
    body:
      "No explicit migration control exists for this shop/domain yet. Django can be used for shadow validation and reporting, but Firebase still represents the default source of truth for customer ownership.",
  };
}

export default async function CustomersPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const customers = activeShop ? await getCustomers(activeShop.shop.id) : [];
  const domainState = activeShop
    ? await getShopDomainState(activeShop.shop.id, "customers")
    : null;
  const stats = buildCustomerStats(customers);
  const customerMode = domainState ? buildCustomerModeCopy(domainState) : null;
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
      subtitle="Phase 3 customer surface with migration ownership, pilot visibility, and cutover-safe read posture for balances and ledger workflows."
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
              detail="Customer revenue captured in the current shadowable dataset"
              accent="green"
              icon="LTV"
            />
          </section>

          {domainState && customerMode ? (
            <section className={`panel-soft rounded-[28px] border px-6 py-5 ${customerMode.accent}`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="eyebrow text-current/70">Customer migration mode</p>
                  <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">
                    {customerMode.title}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
                    {customerMode.body}
                  </p>
                </div>
                <div className="grid gap-2 text-sm text-[var(--text-secondary)] md:min-w-[270px]">
                  <div className="rounded-[18px] border border-current/20 bg-[rgba(0,0,0,0.12)] px-4 py-3">
                    <div className="font-semibold text-[var(--text-primary)]">{customerMode.badge}</div>
                    <div className="mt-1">
                      write_master{" "}
                      <span className="font-mono text-[var(--text-primary)]">{domainState.write_master}</span>
                    </div>
                    <div>
                      bridge_mode{" "}
                      <span className="font-mono text-[var(--text-primary)]">{domainState.bridge_mode}</span>
                    </div>
                    <div>
                      cutover_status{" "}
                      <span className="font-mono text-[var(--text-primary)]">{domainState.cutover_status}</span>
                    </div>
                    <div>
                      epoch{" "}
                      <span className="font-mono text-[var(--text-primary)]">{domainState.current_epoch}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
            <div className="panel-soft rounded-[28px] px-6 py-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="eyebrow">Customer dataset</p>
                  <h2 className="mt-3 text-2xl font-bold">Live backend results</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    This screen is reading{" "}
                    <code>/api/v1/shops/{activeShop.shop.id}/customers/</code>{" "}
                    from the new Django backend plus the shop-scoped migration state endpoint.
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
                            {customer.phone || "No phone"}
                            {customer.email ? ` · ${customer.email}` : ""}
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
