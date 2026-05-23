import Link from "next/link";

import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { WorkspacePlanCard } from "@/components/workspace-plan-card";
import {
  getDashboardSnapshot,
  getSession,
  getWorkspacePulse,
  resolveActiveShop,
} from "@/lib/admin-api";
import { formatCurrency } from "@/lib/formatters";
import {
  canAccessAdvancedReports,
  canAccessAttendance,
  canAccessExpenses,
  canAccessFinanceSummary,
  formatPlanTier,
} from "@/lib/plans";
import { canManageWorkspace } from "@/lib/roles";
import type { DashboardSnapshot, ShopMembership, WorkspacePulseSnapshot } from "@/lib/types";

type QuickAction = {
  label: string;
  body: string;
  href: string;
};

function buildQuickActions(activeShop: ShopMembership | null): QuickAction[] {
  const role = activeShop?.role ?? null;
  const actions: QuickAction[] = [
    {
      label: "Review stock",
      body: "Open the catalog and check low-stock items before they affect the floor.",
      href: "/inventory",
    },
    {
      label: "Check customers",
      body: "Review due balances, customer activity, and collection follow-up.",
      href: "/customers",
    },
    {
      label: "See sales",
      body: "Open receipts and payment activity without leaving the Business Hub flow.",
      href: "/sales",
    },
  ];

  if (canManageWorkspace(role)) {
    if (canAccessExpenses(activeShop)) {
      actions.push({
        label: "Track expenses",
        body: "Keep daily spend visible without opening a heavy back-office tool.",
        href: "/expenses",
      });
    }

    if (canAccessAttendance(activeShop)) {
      actions.push({
        label: "Review attendance",
        body: "Check who clocked in and whether the shift is staffed correctly.",
        href: "/attendance",
      });
    }
  }

  return actions.slice(0, 4);
}

function buildAttentionCard(
  snapshot: DashboardSnapshot | null,
  options: {
    currencyCode?: string;
    canUseFinanceSummary?: boolean;
  } = {},
) {
  const currencyCode = options.currencyCode ?? "INR";
  const canUseFinanceSummary = options.canUseFinanceSummary ?? false;

  if (!snapshot) {
    return {
      title: "Connect a workspace to begin",
      body: "Once a shop is active, this page will highlight the next thing that needs action.",
      ctaLabel: "View settings",
      href: "/",
      tone: "text-[var(--accent)] border-[rgba(71,176,255,0.18)] bg-[rgba(11,24,41,0.72)]",
    };
  }

  if (snapshot.low_stock_items_count > 0) {
    return {
      title: "Low-stock items need review",
      body: `${snapshot.low_stock_items_count} products are running low. Review stock before the next rush.`,
      ctaLabel: "Open inventory",
      href: "/inventory",
      tone: "text-[var(--warning)] border-[rgba(255,138,106,0.18)] bg-[rgba(38,16,12,0.72)]",
    };
  }

  if (canUseFinanceSummary && Number(snapshot.total_outstanding_balance ?? 0) > 0) {
    return {
      title: "Customer dues need follow-up",
      body: `Outstanding balances are now at ${formatCurrency(Number(snapshot.total_outstanding_balance), currencyCode)}.`,
      ctaLabel: "Open customers",
      href: "/customers",
      tone: "text-[var(--accent)] border-[rgba(71,176,255,0.18)] bg-[rgba(11,24,41,0.72)]",
    };
  }

  if (!canUseFinanceSummary && snapshot.active_credit_customers_count > 0) {
    return {
      title: "Customer follow-up is waiting",
      body: `${snapshot.active_credit_customers_count} customer accounts still need balance follow-up.`,
      ctaLabel: "Open customers",
      href: "/customers",
      tone: "text-[var(--accent)] border-[rgba(71,176,255,0.18)] bg-[rgba(11,24,41,0.72)]",
    };
  }

  if (snapshot.sales_count === 0) {
    return {
      title: "No sales recorded yet",
      body: "Open sales and confirm the shop has started recording today's activity.",
      ctaLabel: "Open sales",
      href: "/sales",
      tone: "text-[var(--accent)] border-[rgba(71,176,255,0.18)] bg-[rgba(11,24,41,0.72)]",
    };
  }

  return {
    title: "Store is moving normally",
    body: "Stock, dues, and sales are all within a healthy range right now.",
    ctaLabel: "Review receipts",
    href: "/sales",
    tone: "text-[var(--success)] border-[rgba(58,215,162,0.18)] bg-[rgba(8,34,26,0.72)]",
  };
}

function buildAttentionCardFromPulse(pulse: WorkspacePulseSnapshot | null) {
  if (!pulse) {
    return null;
  }

  const tone =
    pulse.headline.tone === "critical" || pulse.headline.tone === "danger"
      ? "text-[var(--warning)] border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.72)]"
      : pulse.headline.tone === "warning"
      ? "text-[var(--warning)] border-[rgba(245,158,11,0.18)] bg-[rgba(77,49,9,0.34)]"
      : pulse.headline.tone === "healthy"
      ? "text-[var(--success)] border-[rgba(58,215,162,0.18)] bg-[rgba(8,34,26,0.72)]"
      : "text-[var(--accent)] border-[rgba(71,176,255,0.18)] bg-[rgba(11,24,41,0.72)]";

  return {
    title: pulse.headline.title,
    body: pulse.headline.body,
    ctaLabel: pulse.headline.cta_label,
    href: pulse.headline.route,
    tone,
  };
}

function buildPlanGuidance(activeShop: ShopMembership | null) {
  if (!activeShop) {
    return null;
  }

  if (activeShop.shop.plan_tier === "starter") {
    return {
      title: "Starter keeps the workspace lean",
      body: "This plan focuses on selling, stock, customers, and receipts. Expenses and attendance stay hidden until the shop upgrades.",
      tone: "text-[var(--accent)] border-[rgba(71,176,255,0.18)] bg-[rgba(11,24,41,0.72)]",
    };
  }

  if (activeShop.shop.plan_tier === "growth") {
    return {
      title: "Growth adds store operations",
      body: "This workspace includes daily operations like expenses and attendance while still avoiding heavier back-office clutter.",
      tone: "text-[var(--success)] border-[rgba(58,215,162,0.18)] bg-[rgba(8,34,26,0.72)]",
    };
  }

  return {
    title: "Pro unlocks deeper control",
    body: "This workspace can open stronger operations and support paths while still keeping ERP internals out of normal store flows.",
    tone: "text-[var(--warning)] border-[rgba(245,158,11,0.18)] bg-[rgba(52,34,8,0.72)]",
  };
}

export default async function HomePage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const dashboardSnapshot = activeShop ? await getDashboardSnapshot(activeShop.shop.id) : null;
  const pulseSnapshot = activeShop ? await getWorkspacePulse(activeShop.shop.id) : null;
  const quickActions = buildQuickActions(activeShop);
  const canUseAdvancedReports = canAccessAdvancedReports(activeShop);
  const canUseFinanceSummary = canAccessFinanceSummary(activeShop);
  const attentionCard =
    buildAttentionCardFromPulse(pulseSnapshot) ??
    buildAttentionCard(dashboardSnapshot, {
      currencyCode: activeShop?.shop.currency_code ?? "INR",
      canUseFinanceSummary,
    });
  const planGuidance = buildPlanGuidance(activeShop);
  const lowStockPreview = dashboardSnapshot?.low_stock_preview ?? [];
  const totalOutstanding = Number(dashboardSnapshot?.total_outstanding_balance ?? 0);
  const grossRevenue = Number(dashboardSnapshot?.gross_revenue ?? 0);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="overview"
      title="Business overview"
      subtitle="See what needs attention, move into the right workflow quickly, and keep the store running without admin clutter."
    >
      {!activeShop ? (
        <EmptyState
          title="No shop membership found"
          body="This account is signed in, but there is no active shop membership yet. Add a shop membership in Business Hub before using the curated admin workspace."
        />
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Products live"
              value={(dashboardSnapshot?.inventory_items_count ?? 0).toString()}
              detail={`${
                dashboardSnapshot?.active_inventory_items_count ?? 0
              } active products across ${
                dashboardSnapshot?.category_count ?? 0
              } categories`}
              icon="INV"
            />
            <MetricCard
              label="Stock at risk"
              value={(dashboardSnapshot?.low_stock_items_count ?? 0).toString()}
              detail="Items at five units or lower that need a restock decision"
              accent="rose"
              icon="RST"
            />
            <MetricCard
              label="Customer dues"
              value={
                canUseFinanceSummary
                  ? formatCurrency(totalOutstanding, activeShop.shop.currency_code)
                  : `${dashboardSnapshot?.active_credit_customers_count ?? 0}`
              }
              detail={
                canUseFinanceSummary
                  ? `${dashboardSnapshot?.active_credit_customers_count ?? 0} active credit accounts`
                  : "Accounts that still need balance follow-up"
              }
              accent="blue"
              icon="DUE"
            />
            <MetricCard
              label="Sales recorded"
              value={(dashboardSnapshot?.sales_count ?? 0).toString()}
              detail={
                canUseAdvancedReports
                  ? `${formatCurrency(grossRevenue, activeShop.shop.currency_code)} gross revenue`
                  : "Receipt flow stays simple on lighter plans"
              }
              accent="green"
              icon="SAL"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.88fr)]">
            <div className="space-y-6">
              <div className={`panel-soft rounded-[28px] border px-6 py-6 ${attentionCard.tone}`}>
                <p className="eyebrow text-current/70">Next move</p>
                <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">
                  {attentionCard.title}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
                  {attentionCard.body}
                </p>
                <div className="mt-5">
                  <Link
                    href={attentionCard.href}
                    className="inline-flex items-center rounded-full border border-current/20 bg-[rgba(255,255,255,0.06)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[rgba(255,255,255,0.1)]"
                  >
                    {attentionCard.ctaLabel}
                  </Link>
                </div>
              </div>

              {planGuidance ? (
                <div className={`panel-soft rounded-[28px] border px-6 py-6 ${planGuidance.tone}`}>
                  <p className="eyebrow text-current/70">{formatPlanTier(activeShop.shop.plan_tier)} plan</p>
                  <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">
                    {planGuidance.title}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
                    {planGuidance.body}
                  </p>
                </div>
              ) : null}

              {activeShop ? (
                <WorkspacePlanCard
                  shopName={activeShop.shop.name}
                  planTier={activeShop.shop.plan_tier}
                  detailHref={canManageWorkspace(activeShop.role) ? "/plan" : undefined}
                />
              ) : null}

              <div className="panel-soft rounded-[28px] px-6 py-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="eyebrow">Quick actions</p>
                    <h2 className="mt-3 text-2xl font-bold">Go straight to the task</h2>
                  </div>
                  <span className="rounded-full border border-[rgba(71,176,255,0.14)] bg-[rgba(71,176,255,0.08)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
                    {quickActions.length} shortcuts
                  </span>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  {quickActions.map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="surface-muted rounded-[22px] px-4 py-4 transition hover:border-[rgba(71,176,255,0.18)] hover:bg-[rgba(14,22,34,0.72)]"
                    >
                      <p className="text-base font-semibold">{action.label}</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                        {action.body}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>

              {pulseSnapshot ? (
                <div className="panel-soft rounded-[28px] px-6 py-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="eyebrow">Pulse queue</p>
                      <h2 className="mt-3 text-2xl font-bold">What needs owner/admin attention</h2>
                    </div>
                    <Link
                      href="/pulse"
                      className="rounded-full border border-[rgba(71,176,255,0.14)] bg-[rgba(71,176,255,0.08)] px-3 py-1 text-xs font-medium text-[var(--accent)]"
                    >
                      Open pulse
                    </Link>
                  </div>

                  <div className="mt-5 space-y-3">
                    {pulseSnapshot.tasks.length ? (
                      pulseSnapshot.tasks.slice(0, 3).map((task) => (
                        <Link
                          key={task.code}
                          href={task.route}
                          className="surface-muted block rounded-[22px] px-4 py-4 transition hover:border-[rgba(71,176,255,0.18)] hover:bg-[rgba(14,22,34,0.72)]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-base font-semibold">{task.title}</p>
                            <span className="rounded-full border border-[rgba(152,164,189,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                              {task.priority}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                            {task.body}
                          </p>
                        </Link>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)]">
                        No open pulse tasks right now.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-6">
              <div className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Stock watch</p>
                <h2 className="mt-3 text-2xl font-bold">Products needing attention</h2>
                <div className="mt-5 space-y-3">
                  {lowStockPreview.length ? (
                    lowStockPreview.map((item) => (
                      <div
                        key={item.id}
                        className="surface-muted flex items-center justify-between rounded-[20px] px-4 py-4"
                      >
                        <div>
                          <p className="font-semibold">{item.item_name}</p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {item.category || "Uncategorized"} | {item.sku || "No SKU"}
                          </p>
                        </div>
                        <span className="rounded-full border border-[rgba(255,138,106,0.18)] px-3 py-1 text-sm font-semibold text-[var(--warning)]">
                          {item.stock_on_hand} left
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      No urgent low-stock items in the current store snapshot.
                    </p>
                  )}
                </div>
              </div>

              {pulseSnapshot ? (
                <div className="panel-soft rounded-[28px] px-6 py-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="eyebrow">Anomaly watch</p>
                      <h2 className="mt-3 text-2xl font-bold">Unusual store signals</h2>
                    </div>
                    <span className="rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(77,49,9,0.34)] px-3 py-1 text-xs font-medium text-[var(--warning)]">
                      {pulseSnapshot.stats.critical_anomaly_count + pulseSnapshot.stats.warning_anomaly_count} live
                    </span>
                  </div>
                  <div className="mt-5 space-y-3">
                    {pulseSnapshot.anomalies.length ? (
                      pulseSnapshot.anomalies.slice(0, 3).map((anomaly) => (
                        <Link
                          key={anomaly.code}
                          href={anomaly.route}
                          className="surface-muted block rounded-[22px] px-4 py-4 transition hover:border-[rgba(245,158,11,0.18)] hover:bg-[rgba(21,18,12,0.72)]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-base font-semibold">{anomaly.title}</p>
                            <span className="rounded-full border border-[rgba(245,158,11,0.18)] px-3 py-1 text-xs font-semibold text-[var(--warning)]">
                              {anomaly.metric_value}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                            {anomaly.body}
                          </p>
                        </Link>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)]">
                        No anomaly signals are active right now.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Workspace access</p>
                <h2 className="mt-3 text-2xl font-bold">Available shop memberships</h2>
                <div className="mt-5 space-y-3">
                  {session.memberships.map((membership) => {
                    const isCurrent = membership.shop.id === activeShop.shop.id;
                    return (
                      <div
                        key={membership.id}
                        className={`rounded-[20px] border px-4 py-4 ${
                          isCurrent
                            ? "border-[rgba(71,176,255,0.18)] bg-[rgba(11,24,41,0.72)]"
                            : "surface-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">{membership.shop.name}</p>
                            <p className="mt-1 text-sm text-[var(--text-secondary)]">
                              {membership.role_label} | {membership.status}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                              {membership.role_summary}
                            </p>
                          </div>
                          {isCurrent ? (
                            <span className="rounded-full border border-[rgba(71,176,255,0.16)] bg-[rgba(71,176,255,0.08)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
                              Active
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
