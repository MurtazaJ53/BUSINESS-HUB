import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { MigrationActivityTable } from "@/components/migration-activity-table";
import { MigrationBridgeReceiptsTable } from "@/components/migration-bridge-receipts-table";
import { MigrationGoLiveCheckpointTable } from "@/components/migration-go-live-checkpoint-table";
import { MigrationGoLiveReadinessPanel } from "@/components/migration-go-live-readiness-panel";
import { MigrationLaunchCheckpointTable } from "@/components/migration-launch-checkpoint-table";
import { MigrationPilotCheckpointBoard } from "@/components/migration-pilot-checkpoint-board";
import { MigrationPhaseCheckpointTable } from "@/components/migration-phase-checkpoint-table";
import { MigrationPhaseReadinessPanel } from "@/components/migration-phase-readiness-panel";
import { MigrationPilotSignoffBoard } from "@/components/migration-pilot-signoff-board";
import { MigrationPilotShopScorecardBoard } from "@/components/migration-pilot-shop-scorecard-board";
import { MetricCard } from "@/components/metric-card";
import { MigrationControlsTable } from "@/components/migration-controls-table";
import { MigrationJobsTable } from "@/components/migration-jobs-table";
import { MigrationPilotReadinessTable } from "@/components/migration-pilot-readiness-table";
import { MigrationPilotStageStrip } from "@/components/migration-pilot-stage-strip";
import { MigrationPilotVerificationSummary } from "@/components/migration-pilot-verification-summary";
import { MigrationRetirementReadinessPanel } from "@/components/migration-retirement-readiness-panel";
import { MigrationRolloutCheckpointTable } from "@/components/migration-rollout-checkpoint-table";
import { MigrationRolloutReadinessPanel } from "@/components/migration-rollout-readiness-panel";
import { MigrationSteadyStateCheckpointTable } from "@/components/migration-steady-state-checkpoint-table";
import { MigrationSteadyStateReadinessPanel } from "@/components/migration-steady-state-readiness-panel";
import { MigrationRunbookPanel } from "@/components/migration-runbook-panel";
import { MigrationShopCheckpointTable } from "@/components/migration-shop-checkpoint-table";
import { ReconciliationEventsTable } from "@/components/reconciliation-events-table";
import { MigrationShadowSummariesTable } from "@/components/migration-shadow-summaries-table";
import {
  buildMigrationStats,
  getMigrationControlEvents,
  getMigrationBridgeReceipts,
  getMigrationGoLiveCheckpointEvents,
  getMigrationGoLiveReadiness,
  getMigrationLaunchCheckpointEvents,
  getMigrationPhaseCheckpointEvents,
  getMigrationControls,
  getMigrationPhaseReadiness,
  getMigrationJobRuns,
  getMigrationPilotReadiness,
  getMigrationPilotSignoff,
  getMigrationPilotShopScorecards,
  getMigrationReconciliationEvents,
  getMigrationRetirementReadiness,
  getMigrationRolloutCheckpointEvents,
  getMigrationRolloutReadiness,
  getMigrationSteadyStateCheckpointEvents,
  getMigrationSteadyStateReadiness,
  getMigrationShopCheckpointEvents,
  getMigrationShadowSummaries,
  getSession,
  resolveActiveShop,
} from "@/lib/admin-api";

type SearchParams = Record<string, string | string[] | undefined>;

type MigrationPageProps = {
  searchParams?: Promise<SearchParams>;
};

function getSearchParamValue(searchParams: SearchParams, key: string) {
  const raw = searchParams[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function buildActionBanner(searchParams: SearchParams) {
  const status = getSearchParamValue(searchParams, "status");
  const action = getSearchParamValue(searchParams, "action");
  const domain = getSearchParamValue(searchParams, "domain");
  const shop = getSearchParamValue(searchParams, "shop");
  const message = getSearchParamValue(searchParams, "message");
  const issue = getSearchParamValue(searchParams, "issue");
  const jobStatus = getSearchParamValue(searchParams, "jobStatus");
  const rowsScanned = getSearchParamValue(searchParams, "rowsScanned");
  const rowsWritten = getSearchParamValue(searchParams, "rowsWritten");
  const mismatchCount = getSearchParamValue(searchParams, "mismatchCount");
  const readyForPilot = getSearchParamValue(searchParams, "readyForPilot");
  const blockingCount = getSearchParamValue(searchParams, "blockingCount");
  const jobsCreated = getSearchParamValue(searchParams, "jobsCreated");
  const healthy = getSearchParamValue(searchParams, "healthy");
  const requiresRollback = getSearchParamValue(searchParams, "requiresRollback");
  const criticalCount = getSearchParamValue(searchParams, "criticalCount");
  const operationalVerdict = getSearchParamValue(
    searchParams,
    "operationalVerdict",
  );
  const checkpointDecision = getSearchParamValue(searchParams, "decision");
  const shopCheckpointStatus = getSearchParamValue(
    searchParams,
    "shopCheckpointStatus",
  );
  const phase = getSearchParamValue(searchParams, "phase");
  const phaseCheckpointStatus = getSearchParamValue(
    searchParams,
    "phaseCheckpointStatus",
  );
  const launchCheckpointStatus = getSearchParamValue(
    searchParams,
    "launchCheckpointStatus",
  );
  const goLiveCheckpointStatus = getSearchParamValue(
    searchParams,
    "goLiveCheckpointStatus",
  );
  const rolloutCheckpointStatus = getSearchParamValue(
    searchParams,
    "rolloutCheckpointStatus",
  );
  const steadyStateCheckpointStatus = getSearchParamValue(
    searchParams,
    "steadyStateCheckpointStatus",
  );
  const reconciliationStatus = getSearchParamValue(
    searchParams,
    "reconciliationStatus",
  );
  const summary = getSearchParamValue(searchParams, "summary");

  if (!status || !action) {
    return null;
  }

  if (status === "success") {
    const extra =
      action === "prepare-pilot"
        ? ` Jobs created: ${jobsCreated || "0"}. ready_for_pilot=${readyForPilot || "false"}. remaining blockers=${blockingCount || "0"}.`
        : action === "verify-pilot"
        ? ` verdict=${operationalVerdict || "monitoring"}. healthy=${healthy || "false"}. requires_rollback=${requiresRollback || "false"}. mismatch_count=${mismatchCount || "0"}. critical_events=${criticalCount || "0"}.${summary ? ` ${summary}` : ""}`
        : action === "shop-checkpoint"
        ? ` decision=${checkpointDecision || "unknown"}. scorecard=${shopCheckpointStatus || "unknown"}.`
        : action === "phase-checkpoint"
        ? ` phase=${phase || "phase_3"}. decision=${checkpointDecision || "unknown"}. readiness=${phaseCheckpointStatus || "unknown"}.`
        : action === "launch-checkpoint"
        ? ` phase=${phase || "phase_5"}. decision=${checkpointDecision || "unknown"}. retirement=${launchCheckpointStatus || "unknown"}.`
        : action === "go-live-checkpoint"
        ? ` phase=${phase || "phase_6"}. decision=${checkpointDecision || "unknown"}. go_live=${goLiveCheckpointStatus || "unknown"}.`
        : action === "rollout-checkpoint"
        ? ` phase=${phase || "phase_7"}. decision=${checkpointDecision || "unknown"}. rollout=${rolloutCheckpointStatus || "unknown"}.`
        : action === "steady-state-checkpoint"
        ? ` phase=${phase || "phase_8"}. decision=${checkpointDecision || "unknown"}. steady_state=${steadyStateCheckpointStatus || "unknown"}.`
        : action.startsWith("reconciliation-")
        ? ` Issue ${issue || "unknown"} is now ${reconciliationStatus || "updated"}.`
        : action.startsWith("run-") && jobStatus
        ? ` Latest job status: ${jobStatus}. rows_scanned=${rowsScanned || "0"}, rows_written=${rowsWritten || "0"}, mismatch_count=${mismatchCount || "0"}.`
        : "";
    return {
      accent:
        "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.76)] text-[var(--success)]" as const,
      title: `Migration action succeeded: ${action}`,
      body: `${shop || "Selected shop"} / ${domain || "domain"} completed the requested control-plane action successfully.${extra} Review bridge receipts, readiness boards, and reconciliation before taking the next step.`,
    };
  }

  return {
    accent:
      "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.76)] text-[var(--warning)]" as const,
    title: `Migration action failed: ${action}`,
    body: `${shop || "Selected shop"} / ${domain || "domain"} could not complete the requested action.${message ? ` ${message}` : ""}`,
  };
}

function buildVerificationSummary(searchParams: SearchParams) {
  const status = getSearchParamValue(searchParams, "status");
  const action = getSearchParamValue(searchParams, "action");

  if (status !== "success" || action !== "verify-pilot") {
    return null;
  }

  return {
    domain: getSearchParamValue(searchParams, "domain") || "domain",
    shop: getSearchParamValue(searchParams, "shop") || "Selected shop",
    operationalVerdict:
      (getSearchParamValue(searchParams, "operationalVerdict") as
        | "production_safe"
        | "monitoring"
        | "rollback_recommended") || "monitoring",
    summary:
      getSearchParamValue(searchParams, "summary") ||
      "Pilot verification completed.",
    healthy: getSearchParamValue(searchParams, "healthy") === "true",
    requiresRollback:
      getSearchParamValue(searchParams, "requiresRollback") === "true",
    mismatchCount: Number(getSearchParamValue(searchParams, "mismatchCount") || 0),
    criticalCount: Number(getSearchParamValue(searchParams, "criticalCount") || 0),
  };
}

export default async function MigrationPage({ searchParams }: MigrationPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  if (!session.user.is_platform_admin) {
    return (
      <AdminShell
        session={session}
        activeShop={activeShop}
        activeRoute="migration"
        surfaceMode="internal"
        title="Migration Control"
        subtitle="This control plane is restricted to platform-admin operators."
      >
        <EmptyState
          title="Platform admin required"
          body="Migration domain ownership, shadow verification, and reconciliation controls are only available to platform-admin accounts."
        />
      </AdminShell>
    );
  }

  const [controls, jobs, activityEvents, shopCheckpointEvents, phaseCheckpointEvents, launchCheckpointEvents, goLiveCheckpointEvents, rolloutCheckpointEvents, steadyStateCheckpointEvents, receipts, pilotReadiness, pilotSignoff, pilotShopScorecards, phaseReadiness, retirementReadiness, goLiveReadiness, rolloutReadiness, steadyStateReadiness, shadowSummaries, events] =
    await Promise.all([
      getMigrationControls(),
      getMigrationJobRuns(),
      getMigrationControlEvents(),
      getMigrationShopCheckpointEvents(),
      getMigrationPhaseCheckpointEvents(),
      getMigrationLaunchCheckpointEvents(),
      getMigrationGoLiveCheckpointEvents(),
      getMigrationRolloutCheckpointEvents(),
      getMigrationSteadyStateCheckpointEvents(),
      getMigrationBridgeReceipts(),
      getMigrationPilotReadiness(),
      getMigrationPilotSignoff(),
      getMigrationPilotShopScorecards(),
      getMigrationPhaseReadiness(),
      getMigrationRetirementReadiness(),
      getMigrationGoLiveReadiness(),
      getMigrationRolloutReadiness(),
      getMigrationSteadyStateReadiness(),
      getMigrationShadowSummaries(),
      getMigrationReconciliationEvents(),
    ]);
  const stats = buildMigrationStats(controls, jobs, receipts, pilotReadiness, events);
  const actionBanner = buildActionBanner(resolvedSearchParams);
  const verificationSummary = buildVerificationSummary(resolvedSearchParams);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="migration"
      surfaceMode="internal"
      title="Migration Control"
      subtitle="Platform-only migration governance for cutovers, rollout safety, and steady-state controls that must stay outside the normal client workspace."
    >
      <div className="space-y-8">
        {actionBanner ? (
          <section className={`panel-soft rounded-[28px] border px-6 py-5 ${actionBanner.accent}`}>
            <p className="eyebrow text-current/70">Operator feedback</p>
            <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">{actionBanner.title}</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{actionBanner.body}</p>
          </section>
        ) : null}

        {verificationSummary ? (
          <MigrationPilotVerificationSummary {...verificationSummary} />
        ) : null}

        <MigrationRetirementReadinessPanel readiness={retirementReadiness} />

        <MigrationGoLiveReadinessPanel readiness={goLiveReadiness} />

        <MigrationRolloutReadinessPanel readiness={rolloutReadiness} />

        <MigrationSteadyStateReadinessPanel readiness={steadyStateReadiness} />

        <section className="panel-soft rounded-[28px] px-6 py-6">
          <p className="eyebrow">Launch checkpoint journal</p>
          <h2 className="mt-3 text-2xl font-bold">Recorded retirement decisions</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            This is the durable Phase 5 signoff trail for final launch, hardening holds, and any decision to push the platform back into Phase 4 posture.
          </p>
          <div className="mt-6">
            <MigrationLaunchCheckpointTable events={launchCheckpointEvents} />
          </div>
        </section>

        <section className="panel-soft rounded-[28px] px-6 py-6">
          <p className="eyebrow">Go-live checkpoint journal</p>
          <h2 className="mt-3 text-2xl font-bold">Recorded launch-window decisions</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            This is the durable Phase 6 execution trail for entering the go-live
            window, remaining in hypercare, handing the platform off to steady-state
            operations, or escalating a launch rollback.
          </p>
          <div className="mt-6">
            <MigrationGoLiveCheckpointTable events={goLiveCheckpointEvents} />
          </div>
        </section>

        <section className="panel-soft rounded-[28px] px-6 py-6">
          <p className="eyebrow">Rollout checkpoint journal</p>
          <h2 className="mt-3 text-2xl font-bold">Recorded rollout-wave decisions</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            This is the durable Phase 7 trail for expansion waves, hold decisions,
            scale tuning windows, rollout completion, and wave rollback escalations.
          </p>
          <div className="mt-6">
            <MigrationRolloutCheckpointTable events={rolloutCheckpointEvents} />
          </div>
        </section>

        <section className="panel-soft rounded-[28px] px-6 py-6">
          <p className="eyebrow">Steady-state checkpoint journal</p>
          <h2 className="mt-3 text-2xl font-bold">Recorded governance decisions</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            This is the durable Phase 8 trail for accepting steady-state,
            intentionally holding for improvement, escalating architecture review,
            or entering incident stabilization without falling back into
            migration-era chaos.
          </p>
          <div className="mt-6">
            <MigrationSteadyStateCheckpointTable events={steadyStateCheckpointEvents} />
          </div>
        </section>

        <MigrationPhaseReadinessPanel readiness={phaseReadiness} />

        <section className="panel-soft rounded-[28px] px-6 py-6">
          <p className="eyebrow">Phase checkpoint journal</p>
          <h2 className="mt-3 text-2xl font-bold">Recorded phase decisions</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            This is the durable signoff trail for the entire phase. It captures when operators approved advancement, held the phase for more monitoring, or escalated rollback pressure.
          </p>
          <div className="mt-6">
            <MigrationPhaseCheckpointTable events={phaseCheckpointEvents} />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
          <MetricCard
            label="Domain controls"
            value={stats.totalControls.toString()}
            detail="Registered shop/domain ownership records"
            icon="CTL"
          />
          <MetricCard
            label="Postgres primary"
            value={stats.postgresPrimaryDomains.toString()}
            detail="Domains already cut over to PostgreSQL truth"
            accent="green"
            icon="PG"
          />
          <MetricCard
            label="Active bridges"
            value={stats.activeBridgeDomains.toString()}
            detail="Controls with compare or replication turned on"
            accent="blue"
            icon="BRG"
          />
          <MetricCard
            label="Replay receipts"
            value={stats.bridgeReceipts.toString()}
            detail="Applied bridge events recorded for idempotent replay safety"
            accent="blue"
            icon="RCT"
          />
          <MetricCard
            label="Pilot ready"
            value={stats.pilotReadyDomains.toString()}
            detail="Domains currently meeting the automated Phase 3 pilot gate"
            accent="green"
            icon="RDY"
          />
          <MetricCard
            label="Critical mismatches"
            value={stats.openCriticalEvents.toString()}
            detail="Open reconciliation events needing immediate review"
            accent="rose"
            icon="MIS"
          />
          <MetricCard
            label="Stale epochs"
            value={stats.openStaleEpochEvents.toString()}
            detail="Rejected replay attempts from outdated domain generations"
            accent="rose"
            icon="EPH"
          />
          <MetricCard
            label="Running jobs"
            value={stats.runningJobs.toString()}
            detail="Backfill, compare, and projection tasks currently in flight"
            accent="blue"
            icon="RUN"
          />
        </section>

        <MigrationRunbookPanel readiness={pilotReadiness} />

        <MigrationPilotCheckpointBoard readiness={pilotReadiness} />

        <MigrationPilotShopScorecardBoard scorecards={pilotShopScorecards} />

        <MigrationPilotSignoffBoard signoff={pilotSignoff} />

        <MigrationPilotStageStrip readiness={pilotReadiness} />

        <section className="panel-soft rounded-[28px] px-6 py-6">
          <div>
            <p className="eyebrow">Domain registry</p>
            <h2 className="mt-3 text-2xl font-bold">Write ownership and epochs</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              This is the first control surface for Phase 2. It exists so every domain has one clear write master before any bridge or backfill code starts mutating real business data.
            </p>
          </div>
          <div className="mt-6">
            <MigrationControlsTable controls={controls} />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="panel-soft rounded-[28px] px-6 py-6">
            <p className="eyebrow">Migration jobs</p>
            <h2 className="mt-3 text-2xl font-bold">Backfill and compare runs</h2>
            <div className="mt-6">
              <MigrationJobsTable jobs={jobs} />
            </div>
          </div>

          <div className="panel-soft rounded-[28px] px-6 py-6">
            <p className="eyebrow">Pilot activity</p>
            <h2 className="mt-3 text-2xl font-bold">Decision journal</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              This shows the actual operator trail behind each pilot domain:
              preparation, promotion, verification verdicts, and rollback
              events.
            </p>
            <div className="mt-6">
              <MigrationActivityTable events={activityEvents} />
            </div>
          </div>
        </section>

        <section className="panel-soft rounded-[28px] px-6 py-6">
          <p className="eyebrow">Shop checkpoint journal</p>
          <h2 className="mt-3 text-2xl font-bold">Recorded shop decisions</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            This is the durable shop-level signoff trail for Phase 3. It captures whether operators approved a pilot shop for cutover, held it for monitoring, or escalated rollback pressure.
          </p>
          <div className="mt-6">
            <MigrationShopCheckpointTable events={shopCheckpointEvents} />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="panel-soft rounded-[28px] px-6 py-6">
            <p className="eyebrow">Bridge health</p>
            <h2 className="mt-3 text-2xl font-bold">Replay receipts</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Every accepted Firebase replay should leave a durable receipt here. This is the fastest way to spot whether Phase 2 replication is flowing or silently stalled.
            </p>
            <div className="mt-6">
              <MigrationBridgeReceiptsTable receipts={receipts} />
            </div>
          </div>
        </section>

        <section className="panel-soft rounded-[28px] px-6 py-6">
          <div>
            <p className="eyebrow">Pilot gate</p>
            <h2 className="mt-3 text-2xl font-bold">Phase 3 readiness</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Inventory and customer cutovers should only move forward when they clear this gate. It rolls Phase 2 compare health, bridge posture, and open reconciliation blockers into one go/no-go surface.
            </p>
          </div>
          <div className="mt-6">
            <MigrationPilotReadinessTable readiness={pilotReadiness} />
          </div>
        </section>

        <section className="panel-soft rounded-[28px] px-6 py-6">
          <div>
            <p className="eyebrow">Shadow verification</p>
            <h2 className="mt-3 text-2xl font-bold">Compare posture by shop and domain</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              This is the phase-gate view for Phase 2. It compresses the latest compare job, open drift, and stale epoch pressure into one surface so we can tell which domains are actually safe to pilot.
            </p>
          </div>
          <div className="mt-6">
            <MigrationShadowSummariesTable summaries={shadowSummaries} />
          </div>
        </section>

        <section className="panel-soft rounded-[28px] px-6 py-6">
          <div>
            <p className="eyebrow">Reconciliation queue</p>
            <h2 className="mt-3 text-2xl font-bold">Mismatch triage</h2>
          </div>
          <div className="mt-6">
            <ReconciliationEventsTable events={events} />
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
