import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { WorkspacePlanCard } from "@/components/workspace-plan-card";
import { requestPlanUpgradeAction } from "@/app/plan/actions";
import { getSession, getShopPlanRequests, resolveActiveShop } from "@/lib/admin-api";
import {
  formatPlanTier,
  getPlanAudience,
  getPlanCompareSnapshot,
  getPlanIncludedNow,
  getPlanUnlockNext,
  orderedPlanTiers,
} from "@/lib/plans";
import { canManageWorkspace } from "@/lib/roles";
import type { BusinessHubPlanTier, ShopPlanRequestPayload } from "@/lib/types";

type SearchParams = Record<string, string | string[] | undefined>;

type PlanPageProps = {
  searchParams?: Promise<SearchParams>;
};

function getSearchParamValue(searchParams: SearchParams, key: string) {
  const raw = searchParams[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function getNextPlanLabel(planTier: BusinessHubPlanTier): string {
  switch (planTier) {
    case "starter":
      return "Growth";
    case "growth":
      return "Pro";
    case "pro":
      return "Stay on Pro";
  }
}

function getUpgradeSignals(planTier: BusinessHubPlanTier): string[] {
  switch (planTier) {
    case "starter":
      return [
        "Upgrade when the shop needs expenses and attendance inside the same product.",
        "Upgrade when supplier-aware stock operations matter more than a lean-only counter flow.",
        "Upgrade when owners are asking for more operational control without raw ERP clutter.",
      ];
    case "growth":
      return [
        "Upgrade when owners need finance-heavy rollups instead of only simple operations.",
        "Upgrade when customer and sales analysis needs to be deeper than list-level review.",
        "Upgrade when advanced support or admin controls need to be available for the workspace.",
      ];
    case "pro":
      return [
        "Keep Pro limited to the right owners and admins.",
        "Keep staff on simple daily-work surfaces, not deep management tools.",
        "Use the higher plan to stay curated, not to expose every possible system detail.",
      ];
  }
}

function buildActionBanner(searchParams: SearchParams) {
  const status = getSearchParamValue(searchParams, "status");
  const requestedPlanTier = getSearchParamValue(searchParams, "requestedPlanTier");
  const requestStatus = getSearchParamValue(searchParams, "requestStatus");
  const message = getSearchParamValue(searchParams, "message");

  if (!status) {
    return null;
  }

  if (status === "success") {
    return {
      accent:
        "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.76)] text-[var(--success)]" as const,
      title: `Upgrade request captured for ${requestedPlanTier?.toUpperCase() || "the next plan"}`,
      body: `The workspace request is now recorded with status ${requestStatus || "open"}. The Business Hub team can follow up without relying on a copied brief alone.`,
    };
  }

  return {
    accent:
      "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.76)] text-[var(--warning)]" as const,
    title: "Upgrade request could not be recorded",
    body: message || "The workspace plan request did not complete.",
  };
}

function getNextPlanValue(planTier: BusinessHubPlanTier): BusinessHubPlanTier | null {
  switch (planTier) {
    case "starter":
      return "growth";
    case "growth":
      return "pro";
    case "pro":
      return null;
  }
}

function getRequestStatusTone(status: ShopPlanRequestPayload["status"]) {
  switch (status) {
    case "open":
      return "text-[var(--warning)] border-[rgba(245,158,11,0.18)] bg-[rgba(77,49,9,0.34)]";
    case "in_review":
      return "text-[var(--accent)] border-[rgba(71,176,255,0.18)] bg-[rgba(11,24,41,0.72)]";
    case "resolved":
      return "text-[var(--success)] border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.76)]";
    case "closed":
      return "text-[var(--text-secondary)] border-[rgba(152,164,189,0.12)] bg-[rgba(13,18,28,0.68)]";
  }
}

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const role = activeShop?.role ?? null;
  const planRequests =
    activeShop && canManageWorkspace(role)
      ? await getShopPlanRequests(activeShop.shop.id)
      : [];
  const actionBanner = buildActionBanner(resolvedSearchParams);
  const nextPlanValue = activeShop ? getNextPlanValue(activeShop.shop.plan_tier) : null;

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="plan"
      title="Workspace plan"
      subtitle="See what this workspace includes now, what the next plan unlocks, and keep upgrade decisions clear instead of menu-heavy."
    >
      {!activeShop ? (
        <EmptyState
          title="No workspace selected"
          body="Choose or add a shop membership before reviewing plan posture and upgrade guidance."
        />
      ) : !canManageWorkspace(role) ? (
        <EmptyState
          title="Plan management is owner and admin only"
          body="Daily users should stay focused on selling and operations. Workspace plan comparison is intentionally limited to owners and admins."
        />
      ) : (
        <div className="space-y-8">
          {actionBanner ? (
            <section className={`panel-soft rounded-[28px] border px-6 py-5 ${actionBanner.accent}`}>
              <p className="eyebrow text-current/70">Workspace upgrade signal</p>
              <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">{actionBanner.title}</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{actionBanner.body}</p>
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-3">
            <div className="panel-soft rounded-[28px] px-6 py-6">
              <p className="eyebrow">Current plan</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">
                {formatPlanTier(activeShop.shop.plan_tier)}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                {getPlanAudience(activeShop.shop.plan_tier).body}
              </p>
            </div>
            <div className="panel-soft rounded-[28px] px-6 py-6">
              <p className="eyebrow">Next clean step</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">
                {getNextPlanLabel(activeShop.shop.plan_tier)}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                {getPlanUnlockNext(activeShop.shop.plan_tier).body}
              </p>
            </div>
            <div className="panel-soft rounded-[28px] px-6 py-6">
              <p className="eyebrow">Workspace posture</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">
                Curated
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                Business Hub should stay focused on real shop outcomes, not expose a full ERP surface to every client.
              </p>
            </div>
          </section>

          <WorkspacePlanCard
            shopName={activeShop.shop.name}
            planTier={activeShop.shop.plan_tier}
          />

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.88fr)]">
            <div className="panel-soft rounded-[28px] px-6 py-6">
              <p className="eyebrow">Plan compare</p>
              <h2 className="mt-3 text-2xl font-bold">Choose the right level of control</h2>
              <div className="mt-6 grid gap-4 xl:grid-cols-3">
                {orderedPlanTiers.map((planTier) => {
                  const compare = getPlanCompareSnapshot(planTier);
                  const audience = getPlanAudience(planTier);
                  const active = activeShop.shop.plan_tier === planTier;
                  const next =
                    (activeShop.shop.plan_tier === "starter" && planTier === "growth") ||
                    (activeShop.shop.plan_tier === "growth" && planTier === "pro");

                  return (
                    <div
                      key={planTier}
                      className={`rounded-[24px] border px-5 py-5 ${
                        active
                          ? "border-[rgba(71,176,255,0.24)] bg-[rgba(10,20,36,0.82)]"
                          : next
                            ? "border-[rgba(245,158,11,0.2)] bg-[rgba(38,24,8,0.56)]"
                            : "surface-muted border-[rgba(152,164,189,0.1)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="eyebrow">{formatPlanTier(planTier)} plan</p>
                          <h3 className="mt-3 text-xl font-bold text-[var(--text-primary)]">
                            {audience.title}
                          </h3>
                        </div>
                        {active ? (
                          <span className="rounded-full border border-[rgba(71,176,255,0.18)] bg-[rgba(71,176,255,0.12)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                            Current
                          </span>
                        ) : next ? (
                          <span className="rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(77,49,9,0.34)] px-3 py-1 text-xs font-semibold text-[var(--warning)]">
                            Next
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                        {audience.body}
                      </p>

                      <div className="mt-5 rounded-[20px] border border-[rgba(152,164,189,0.1)] bg-[rgba(8,14,24,0.58)] px-4 py-4">
                        <p className="eyebrow">{compare.currentLabel}</p>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
                          {getPlanIncludedNow(planTier).map((line) => (
                            <li key={line}>- {line}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Upgrade request</p>
                <h2 className="mt-3 text-2xl font-bold">Ask the Business Hub team directly</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                  Use this when the owner wants the next curated plan enabled for this workspace.
                  The request is recorded inside the product instead of living only in copied notes.
                </p>
                {nextPlanValue ? (
                  <form action={requestPlanUpgradeAction} className="mt-5 space-y-4">
                    <input type="hidden" name="shopId" value={activeShop.shop.id} />
                    <input type="hidden" name="shopSlug" value={activeShop.shop.slug} />
                    <input type="hidden" name="requestedPlanTier" value={nextPlanValue} />
                    <div className="rounded-[20px] border border-[rgba(152,164,189,0.12)] bg-[rgba(13,18,28,0.68)] px-4 py-4 text-sm text-[var(--text-secondary)]">
                      Requesting upgrade from{" "}
                      <span className="font-semibold text-[var(--text-primary)]">
                        {formatPlanTier(activeShop.shop.plan_tier)}
                      </span>{" "}
                      to{" "}
                      <span className="font-semibold text-[var(--text-primary)]">
                        {formatPlanTier(nextPlanValue)}
                      </span>
                      .
                    </div>
                    <label className="block">
                      <span className="eyebrow">Owner note</span>
                      <textarea
                        name="requestNote"
                        rows={4}
                        placeholder="Example: We need expenses, attendance, and the next reporting layer for this shop."
                        className="mt-3 w-full rounded-[20px] border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                      />
                    </label>
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-full border border-[rgba(71,176,255,0.16)] bg-[rgba(71,176,255,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(71,176,255,0.18)]"
                    >
                      Request {formatPlanTier(nextPlanValue)}
                    </button>
                  </form>
                ) : (
                  <div className="mt-5 rounded-[20px] border border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.76)] px-4 py-4 text-sm text-[var(--text-secondary)]">
                    This workspace is already on the highest curated plan. Keep deeper controls limited to the right owners and admins.
                  </div>
                )}
              </section>

              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Upgrade signals</p>
                <h2 className="mt-3 text-2xl font-bold">
                  When the next plan is actually worth it
                </h2>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                  {getUpgradeSignals(activeShop.shop.plan_tier).map((line) => (
                    <li key={line}>- {line}</li>
                  ))}
                </ul>
              </section>

              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Current vs next</p>
                <h2 className="mt-3 text-2xl font-bold">What changes at the next tier</h2>
                <div className="mt-5 rounded-[22px] border border-[rgba(152,164,189,0.1)] bg-[rgba(8,14,24,0.58)] px-4 py-4">
                  <p className="eyebrow">
                    {getPlanCompareSnapshot(activeShop.shop.plan_tier).nextLabel}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {getPlanCompareSnapshot(activeShop.shop.plan_tier).nextLines.map((line) => (
                      <li key={line}>- {line}</li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Request history</p>
                <h2 className="mt-3 text-2xl font-bold">Recent workspace plan requests</h2>
                <div className="mt-5 space-y-3">
                  {planRequests.length ? (
                    planRequests.slice(0, 5).map((request) => (
                      <div
                        key={request.id}
                        className="surface-muted rounded-[20px] px-4 py-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-semibold text-[var(--text-primary)]">
                              {formatPlanTier(request.current_plan_tier)} to{" "}
                              {formatPlanTier(request.requested_plan_tier)}
                            </p>
                            <p className="mt-1 text-sm text-[var(--text-secondary)]">
                              Requested by {request.requested_by_name || "Unknown"} on{" "}
                              {request.created_at}
                            </p>
                            {request.request_note ? (
                              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                                {request.request_note}
                              </p>
                            ) : null}
                          </div>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRequestStatusTone(request.status)}`}
                          >
                            {request.status.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      No upgrade requests have been recorded for this workspace yet.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
