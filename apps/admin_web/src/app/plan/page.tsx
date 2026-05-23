import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { WorkspacePlanCard } from "@/components/workspace-plan-card";
import { getSession, resolveActiveShop } from "@/lib/admin-api";
import {
  formatPlanTier,
  getPlanAudience,
  getPlanCompareSnapshot,
  getPlanIncludedNow,
  getPlanUnlockNext,
  orderedPlanTiers,
} from "@/lib/plans";
import { canManageWorkspace } from "@/lib/roles";
import type { BusinessHubPlanTier } from "@/lib/types";

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

export default async function PlanPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const role = activeShop?.role ?? null;

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
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
