import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { MigrationControlsTable } from "@/components/migration-controls-table";
import { MigrationJobsTable } from "@/components/migration-jobs-table";
import { ReconciliationEventsTable } from "@/components/reconciliation-events-table";
import {
  buildMigrationStats,
  getMigrationControls,
  getMigrationJobRuns,
  getMigrationReconciliationEvents,
  getSession,
  resolveActiveShop,
} from "@/lib/admin-api";

export default async function MigrationPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  if (!session.user.is_platform_admin) {
    return (
      <AdminShell
        session={session}
        activeShop={activeShop}
        activeRoute="migration"
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

  const [controls, jobs, events] = await Promise.all([
    getMigrationControls(),
    getMigrationJobRuns(),
    getMigrationReconciliationEvents(),
  ]);
  const stats = buildMigrationStats(controls, jobs, events);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="migration"
      title="Migration Control"
      subtitle="Phase 2 control plane for domain ownership, bridge posture, job visibility, and reconciliation triage."
    >
      <div className="space-y-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
            label="Critical mismatches"
            value={stats.openCriticalEvents.toString()}
            detail="Open reconciliation events needing immediate review"
            accent="rose"
            icon="MIS"
          />
          <MetricCard
            label="Running jobs"
            value={stats.runningJobs.toString()}
            detail="Backfill, compare, and projection tasks currently in flight"
            accent="blue"
            icon="RUN"
          />
        </section>

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
            <p className="eyebrow">Reconciliation queue</p>
            <h2 className="mt-3 text-2xl font-bold">Mismatch triage</h2>
            <div className="mt-6">
              <ReconciliationEventsTable events={events} />
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
