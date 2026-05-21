import { AdminShell } from "@/components/admin-shell";
import { DomainPilotSignoffCard } from "@/components/domain-pilot-signoff-card";
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
      badge: "Stable backend path",
      title: "Customer updates are flowing normally.",
      body:
        "This store is already using the newer customer path, so buyer profiles and balances can be managed here with normal confidence.",
    };
  }

  if (domainState.control_present) {
    return {
      accent:
        "border-[rgba(251,113,133,0.22)] bg-[rgba(40,12,19,0.84)] text-[var(--warning)]" as const,
      badge: "Watching transition",
      title: "Customer data is still under a cautious transition.",
      body:
        "Customer lookup and balances are available here, but the store is still being watched before the newer path becomes the long-term write owner.",
    };
  }

  return {
    accent:
      "border-[rgba(92,174,254,0.22)] bg-[rgba(9,18,34,0.82)] text-[var(--accent)]" as const,
    badge: "Legacy-aligned",
    title: "Customer data is still aligned to the legacy source.",
    body:
      "This view is still useful for account review and balance follow-up, even though the store has not been promoted to the newer customer path yet.",
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
      title="Customers overview"
      subtitle="Review balances, understand customer value, and move quickly into collection follow-up."
    >
      {!activeShop ? (
        <EmptyState
          title="No customer workspace available"
          body="This web workspace needs an active shop membership before it can show customer accounts and outstanding balances."
        />
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Customers active"
              value={stats.totalCustomers.toString()}
              detail="Customer accounts currently visible in this store"
              icon="CUS"
            />
            <MetricCard
              label="Accounts with due"
              value={stats.activeCredits.toString()}
              detail="Customers who still have an open balance"
              accent="rose"
              icon="DUE"
            />
            <MetricCard
              label="Outstanding balance"
              value={formatCurrency(stats.totalOutstanding, activeShop.shop.currency_code)}
              detail="Open dues across active customer accounts"
              accent="blue"
              icon="BAL"
            />
            <MetricCard
              label="Lifetime spend"
              value={formatCurrency(stats.totalLifetimeSpend, activeShop.shop.currency_code)}
              detail="Total customer value captured in this store"
              accent="green"
              icon="LTV"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
            <div className="space-y-6">
              {domainState && customerMode ? (
                <section
                  className={`panel-soft rounded-[28px] border px-6 py-5 ${customerMode.accent}`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="eyebrow text-current/70">Customer health</p>
                      <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">
                        {customerMode.title}
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
                        {customerMode.body}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm text-[var(--text-secondary)] md:min-w-[270px]">
                      <div className="rounded-[18px] border border-current/20 bg-[rgba(0,0,0,0.12)] px-4 py-3">
                        <div className="font-semibold text-[var(--text-primary)]">
                          {customerMode.badge}
                        </div>
                        <div className="mt-1">
                          Write owner{" "}
                          <span className="font-mono text-[var(--text-primary)]">
                            {domainState.write_master}
                          </span>
                        </div>
                        <div>
                          Bridge mode{" "}
                          <span className="font-mono text-[var(--text-primary)]">
                            {domainState.bridge_mode}
                          </span>
                        </div>
                        <div>
                          Status{" "}
                          <span className="font-mono text-[var(--text-primary)]">
                            {domainState.cutover_status}
                          </span>
                        </div>
                      </div>
                      <DomainPilotSignoffCard
                        domainState={domainState}
                        domainLabel="Customer"
                      />
                    </div>
                  </div>
                </section>
              ) : null}

              <section className="panel-soft rounded-[28px] px-6 py-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="eyebrow">Customer list</p>
                    <h2 className="mt-3 text-2xl font-bold">Customer accounts</h2>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      Use this page to review buyer contact details, outstanding balances, and
                      recent account context for the active store.
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
                  <CustomerTable
                    customers={customers}
                    currencyCode={activeShop.shop.currency_code}
                  />
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Collections watch</p>
                <h2 className="mt-3 text-2xl font-bold">Balances to review</h2>
                <div className="mt-5 space-y-3">
                  {highCreditCustomers.length ? (
                    highCreditCustomers.map((customer) => (
                      <div
                        key={customer.id}
                        className="surface-muted flex items-center justify-between rounded-[20px] px-4 py-4"
                      >
                        <div>
                          <p className="font-semibold">{customer.name}</p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {customer.phone || "No phone"}
                            {customer.email ? ` | ${customer.email}` : ""}
                          </p>
                        </div>
                        <span className="rounded-full border border-[rgba(255,138,106,0.18)] px-3 py-1 text-sm font-semibold text-[var(--warning)]">
                          {formatCurrency(Number(customer.balance), activeShop.shop.currency_code)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      No customer balances need urgent follow-up right now.
                    </p>
                  )}
                </div>
              </section>

              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Use this page for</p>
                <h2 className="mt-3 text-2xl font-bold">Clear account follow-up</h2>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                  <li>- Find customers with open balances before they age further.</li>
                  <li>- Review which buyers contribute the most lifetime value.</li>
                  <li>- Keep customer lookup and collections work separate from accounting jargon.</li>
                </ul>
              </section>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
