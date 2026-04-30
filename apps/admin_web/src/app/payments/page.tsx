import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { PaymentsTable } from "@/components/payments-table";
import {
  buildPaymentStats,
  getPayments,
  getSession,
  resolveActiveShop,
} from "@/lib/admin-api";
import { formatCurrency } from "@/lib/formatters";

export default async function PaymentsPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const payments = activeShop ? await getPayments(activeShop.shop.id) : [];
  const stats = buildPaymentStats(payments);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="payments"
      title="Payment Capture"
      subtitle="Phase 1 settlement view for the new commerce contract. This surface lets us inspect payment mode mix before the full POS and reconciliation phases."
    >
      {!activeShop ? (
        <EmptyState
          title="No payment scope available"
          body="The admin shell needs an active shop membership before it can query payments. Once your workspace is bootstrapped, this route will hydrate from the Django payments API."
        />
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Payments captured"
              value={stats.paymentCount.toString()}
              detail="Phase 1 payment documents linked to recorded sales"
              icon="PAY"
            />
            <MetricCard
              label="Collected value"
              value={formatCurrency(stats.totalCollected, activeShop.shop.currency_code)}
              detail="Total captured across all payment entries"
              accent="green"
              icon="COL"
            />
            <MetricCard
              label="Credit entries"
              value={stats.creditCount.toString()}
              detail="Payment records that keep dues open"
              accent="rose"
              icon="CRD"
            />
            <MetricCard
              label="Digital mix"
              value={stats.digitalShareCount.toString()}
              detail="UPI, bank, and card capture count"
              accent="blue"
              icon="DIG"
            />
          </section>

          <section className="panel-soft rounded-[28px] px-6 py-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="eyebrow">Payment dataset</p>
                <h2 className="mt-3 text-2xl font-bold">Live backend results</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  This screen is reading
                  {" "}
                  <code>/api/v1/shops/{activeShop.shop.id}/payments/</code>
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
              <PaymentsTable payments={payments} currencyCode={activeShop.shop.currency_code} />
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
