import { AdminShell } from "@/components/admin-shell";
import { DomainPilotSignoffCard } from "@/components/domain-pilot-signoff-card";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { MfaGateCard } from "@/components/mfa-gate-card";
import { PaymentsTable } from "@/components/payments-table";
import {
  getPayments,
  getPaymentSummary,
  getSession,
  getShopDomainState,
  resolveActiveShop,
} from "@/lib/admin-api";
import { formatCurrency } from "@/lib/formatters";
import { getAdminWebMfaPosture } from "@/lib/mfa";
import { canAccessAdvancedReports, canAccessFinanceSummary, formatPlanTier } from "@/lib/plans";
import { canAccessPaymentsWorkspace } from "@/lib/roles";

export default async function PaymentsPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const role = activeShop?.role ?? null;
  const canUsePaymentsWorkspace = canAccessPaymentsWorkspace(role);
  const mfaPosture = await getAdminWebMfaPosture(session.user, canUsePaymentsWorkspace);
  const [payments, paymentSummary, domainState] = activeShop && canUsePaymentsWorkspace
    && mfaPosture.verified
    ? await Promise.all([
        getPayments(activeShop.shop.id),
        getPaymentSummary(activeShop.shop.id),
        getShopDomainState(activeShop.shop.id, "payments"),
      ])
    : [[], null, null];
  const canUseAdvancedReports = canAccessAdvancedReports(activeShop);
  const canUseFinanceSummary = canAccessFinanceSummary(activeShop);
  const recentHighValue = [...payments]
    .sort((left, right) => Number(right.amount) - Number(left.amount))
    .slice(0, 6);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="payments"
      title="Payments overview"
      subtitle="Review collections, payment mix, and receipt settlement without opening a finance-heavy screen."
    >
      {!activeShop ? (
        <EmptyState
          title="No payment workspace available"
          body="This web workspace needs an active shop membership before it can show captured payments and collection history for a store."
        />
      ) : !canUsePaymentsWorkspace ? (
        <EmptyState
          title="Payments review is owner and admin only"
          body="Daily users should stay focused on selling and operations. Collections review and payment summary surfaces are intentionally limited to workspace owners and admins."
        />
      ) : !mfaPosture.verified ? (
        <MfaGateCard href="/security?returnTo=/payments" enabled={mfaPosture.enabled} title="Payments overview" />
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Payments captured"
              value={(paymentSummary?.payment_count ?? payments.length).toString()}
              detail="Payment records currently visible in this store"
              icon="PAY"
            />
            {canUseFinanceSummary ? (
              <MetricCard
                label="Collected value"
                value={formatCurrency(
                  Number(paymentSummary?.total_collected ?? 0),
                  activeShop.shop.currency_code,
                )}
                detail="Total amount collected across recorded payment entries"
                accent="green"
                icon="COL"
              />
            ) : (
              <MetricCard
                label="Plan insight"
                value={`${formatPlanTier(activeShop.shop.plan_tier)} plan`}
                detail="Collections totals unlock on Pro."
                accent="blue"
                icon="PLN"
              />
            )}
            {canUseFinanceSummary ? (
              <MetricCard
                label="Credit entries"
                value={`${paymentSummary?.credit_count ?? 0}`}
                detail="Payments that still leave due open on the receipt"
                accent="rose"
                icon="CRD"
              />
            ) : (
              <MetricCard
                label="Settlement mode"
                value="Simple review"
                detail="Credit rollups stay hidden on lighter plans."
                accent="rose"
                icon="LGT"
              />
            )}
            {canUseAdvancedReports ? (
              <MetricCard
                label="Digital mix"
                value={`${paymentSummary?.digital_payment_count ?? 0}`}
                detail="UPI, bank, and card payment count"
                accent="blue"
                icon="DIG"
              />
            ) : (
              <MetricCard
                label="Method review"
                value="List view"
                detail="Detailed payment-mix rollups unlock on Pro."
                accent="blue"
                icon="DIG"
              />
            )}
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
            <div className="space-y-6">
              <section className="panel-soft rounded-[28px] px-6 py-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="eyebrow">Payment list</p>
                    <h2 className="mt-3 text-2xl font-bold">Recent collections</h2>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      Use this page to review who paid, how they paid, and how much was collected
                      against each receipt.
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
                  <PaymentsTable
                    payments={payments}
                    currencyCode={activeShop.shop.currency_code}
                  />
                </div>
              </section>
            </div>

            <div className="space-y-6">
              {domainState ? (
                <DomainPilotSignoffCard
                  domainState={domainState}
                  domainLabel="Payments"
                />
              ) : null}

              {canUseFinanceSummary ? (
                <section className="panel-soft rounded-[28px] px-6 py-6">
                  <p className="eyebrow">Collections watch</p>
                  <h2 className="mt-3 text-2xl font-bold">Highest captured payments</h2>
                  <div className="mt-5 space-y-3">
                    {recentHighValue.length ? (
                      recentHighValue.map((payment) => (
                        <div
                          key={payment.id}
                          className="surface-muted flex items-center justify-between rounded-[20px] px-4 py-4"
                        >
                          <div>
                            <p className="font-semibold">{payment.receipt_number}</p>
                            <p className="mt-1 text-sm text-[var(--text-secondary)]">
                              {(payment.customer_name || "Walk-in") + " | " + payment.payment_method}
                            </p>
                          </div>
                          <span className="rounded-full border border-[rgba(58,215,162,0.18)] px-3 py-1 text-sm font-semibold text-[var(--success)]">
                            {formatCurrency(Number(payment.amount || 0), activeShop.shop.currency_code)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)]">
                        No payment activity is available for this store yet.
                      </p>
                    )}
                  </div>
                </section>
              ) : (
                <section className="panel-soft rounded-[28px] px-6 py-6">
                  <p className="eyebrow">Upgrade path</p>
                  <h2 className="mt-3 text-2xl font-bold">Collections watch stays hidden</h2>
                  <p className="mt-5 text-sm leading-7 text-[var(--text-secondary)]">
                    This workspace still lets owners review payment records, but richer collection
                    totals and ranked payment watch surfaces stay behind Pro.
                  </p>
                </section>
              )}

              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Use this page for</p>
                <h2 className="mt-3 text-2xl font-bold">Clear collection review</h2>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                  <li>- See how much money has actually been collected.</li>
                  <li>- Review payment method mix without opening raw accounting tools.</li>
                  <li>- Spot receipts that still depend on credit instead of clean settlement.</li>
                </ul>
              </section>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
