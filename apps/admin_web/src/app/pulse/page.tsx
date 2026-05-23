import Link from "next/link";

import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { getSession, getWorkspacePulse, resolveActiveShop } from "@/lib/admin-api";
import { canManageWorkspace } from "@/lib/roles";

function pulseToneClasses(tone: string) {
  switch (tone) {
    case "critical":
    case "danger":
      return "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.76)] text-[var(--warning)]";
    case "warning":
      return "border-[rgba(245,158,11,0.18)] bg-[rgba(77,49,9,0.34)] text-[var(--warning)]";
    case "healthy":
      return "border-[rgba(58,215,162,0.18)] bg-[rgba(8,34,26,0.72)] text-[var(--success)]";
    default:
      return "border-[rgba(71,176,255,0.18)] bg-[rgba(11,24,41,0.72)] text-[var(--accent)]";
  }
}

export default async function PulsePage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const pulse = activeShop && canManageWorkspace(activeShop.role)
    ? await getWorkspacePulse(activeShop.shop.id)
    : null;

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="pulse"
      title="Workspace pulse"
      subtitle="See the next operational tasks, the highest-risk anomalies, and the store signals that need owner/admin follow-up."
    >
      {!activeShop || !canManageWorkspace(activeShop.role) ? (
        <EmptyState
          title="Pulse stays with manager-level roles"
          body="Daily operators should stay in the selling flow. Workspace pulse is reserved for owner/admin users who need cross-store priorities and anomaly visibility."
        />
      ) : pulse ? (
            <div className="space-y-8">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Open tasks"
                  value={pulse.stats.open_task_count.toString()}
                  detail="Prioritized owner/admin follow-up items"
                  icon="TSK"
                  accent="blue"
                />
                <MetricCard
                  label="Critical anomalies"
                  value={pulse.stats.critical_anomaly_count.toString()}
                  detail="Signals that should be reviewed first"
                  icon="ALT"
                  accent={pulse.stats.critical_anomaly_count > 0 ? "rose" : "green"}
                />
                <MetricCard
                  label="Warning anomalies"
                  value={pulse.stats.warning_anomaly_count.toString()}
                  detail="Issues worth checking before they grow"
                  icon="WRN"
                  accent={pulse.stats.warning_anomaly_count > 0 ? "rose" : "green"}
                />
                <MetricCard
                  label="Stale sessions"
                  value={pulse.stats.stale_session_count.toString()}
                  detail="Devices that have not checked in recently"
                  icon="SES"
                  accent={pulse.stats.stale_session_count > 0 ? "rose" : "green"}
                />
              </section>

              <section className={`panel-soft rounded-[28px] border px-6 py-6 ${pulseToneClasses(pulse.headline.tone)}`}>
                <p className="eyebrow text-current/70">Pulse headline</p>
                <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">
                  {pulse.headline.title}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
                  {pulse.headline.body}
                </p>
                <div className="mt-5">
                  <Link
                    href={pulse.headline.route}
                    className="inline-flex items-center rounded-full border border-current/20 bg-[rgba(255,255,255,0.06)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[rgba(255,255,255,0.1)]"
                  >
                    {pulse.headline.cta_label}
                  </Link>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                <div className="panel-soft rounded-[28px] px-6 py-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="eyebrow">Task queue</p>
                      <h2 className="mt-3 text-2xl font-bold">What to do next</h2>
                    </div>
                    <span className="rounded-full border border-[rgba(71,176,255,0.14)] bg-[rgba(71,176,255,0.08)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
                      {pulse.tasks.length} tasks
                    </span>
                  </div>
                  <div className="mt-5 space-y-3">
                    {pulse.tasks.length ? (
                      pulse.tasks.map((task) => (
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
                          <p className="mt-3 text-sm font-semibold text-[var(--accent)]">
                            {task.cta_label}
                          </p>
                        </Link>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)]">
                        No active pulse tasks are open right now.
                      </p>
                    )}
                  </div>
                </div>

                <div className="panel-soft rounded-[28px] px-6 py-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="eyebrow">Anomaly watch</p>
                      <h2 className="mt-3 text-2xl font-bold">Signals that look unusual</h2>
                    </div>
                    <span className="rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(77,49,9,0.34)] px-3 py-1 text-xs font-medium text-[var(--warning)]">
                      {pulse.anomalies.length} signals
                    </span>
                  </div>
                  <div className="mt-5 space-y-3">
                    {pulse.anomalies.length ? (
                      pulse.anomalies.map((anomaly) => (
                        <Link
                          key={anomaly.code}
                          href={anomaly.route}
                          className="surface-muted block rounded-[22px] px-4 py-4 transition hover:border-[rgba(245,158,11,0.18)] hover:bg-[rgba(21,18,12,0.72)]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-base font-semibold">{anomaly.title}</p>
                            <span className="rounded-full border border-[rgba(245,158,11,0.18)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--warning)]">
                              {anomaly.metric_value}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                            {anomaly.body}
                          </p>
                          <p className="mt-3 text-sm font-semibold text-[var(--accent)]">
                            {anomaly.cta_label}
                          </p>
                        </Link>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)]">
                        No abnormal security, stock, or sales signals are open right now.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </div>
      ) : (
        <EmptyState
          title="Pulse is not available yet"
          body="The workspace is active, but Business Hub could not build a pulse snapshot right now. Try again from the overview or after the next projection refresh."
        />
      )}
    </AdminShell>
  );
}
