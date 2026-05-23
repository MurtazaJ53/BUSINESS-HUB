import Link from "next/link";

import { updatePulseSignalAction } from "@/app/pulse/actions";
import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { MfaGateCard } from "@/components/mfa-gate-card";
import {
  getSession,
  getWorkspacePulse,
  getWorkspacePulseSignals,
  resolveActiveShop,
} from "@/lib/admin-api";
import { formatDateTime } from "@/lib/formatters";
import { getAdminWebMfaPosture } from "@/lib/mfa";
import { canManageWorkspace } from "@/lib/roles";
import type { WorkspacePulseSignal } from "@/lib/types";

type SearchParams = Record<string, string | string[] | undefined>;

type PulsePageProps = {
  searchParams?: Promise<SearchParams>;
};

function getSearchParamValue(searchParams: SearchParams, key: string) {
  const raw = searchParams[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

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

function buildBanner(searchParams: SearchParams) {
  const status = getSearchParamValue(searchParams, "status");
  const action = getSearchParamValue(searchParams, "action");
  const title = getSearchParamValue(searchParams, "title");
  const message = getSearchParamValue(searchParams, "message");

  if (!status) {
    return null;
  }

  if (status === "success") {
    return {
      accent:
        "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.76)] text-[var(--success)]" as const,
      title:
        action === "resolve"
          ? "Pulse signal resolved"
          : action === "reopen"
            ? "Pulse signal reopened"
            : "Pulse signal acknowledged",
      body: `${title || "The selected pulse signal"} was updated successfully.`,
    };
  }

  return {
    accent:
      "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.76)] text-[var(--warning)]" as const,
    title: "Pulse control failed",
    body: message || "The pulse signal action did not complete.",
  };
}

function renderSignalCard(
  activeShopId: string,
  signal: WorkspacePulseSignal,
  actionsEnabled: boolean,
) {
  const levelLabel =
    signal.signal_kind === "anomaly"
      ? signal.signal_level.toUpperCase()
      : signal.signal_level.toUpperCase();
  const detailTimestamp =
    signal.status === "resolved"
      ? `Resolved ${formatDateTime(signal.resolved_at)}`
      : signal.status === "acknowledged"
        ? `Acknowledged ${formatDateTime(signal.acknowledged_at)}`
        : `Last seen ${formatDateTime(signal.last_detected_at)}`;

  return (
    <article key={signal.id} className="surface-muted rounded-[24px] px-5 py-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-[var(--text-primary)]">{signal.title}</p>
            <span className="rounded-full border border-[rgba(152,164,189,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
              {signal.signal_kind}
            </span>
            <span className="rounded-full border border-[rgba(71,176,255,0.16)] bg-[rgba(71,176,255,0.08)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
              {signal.status}
            </span>
            <span className="rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(77,49,9,0.34)] px-3 py-1 text-xs font-medium text-[var(--warning)]">
              {levelLabel}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{signal.body}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
            <span>{detailTimestamp}</span>
            <span>First seen {formatDateTime(signal.first_detected_at)}</span>
            {signal.metric_value ? <span>Metric {signal.metric_value}</span> : null}
            {signal.count > 0 ? <span>Count {signal.count}</span> : null}
          </div>
          {signal.resolution_note ? (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              Note: {signal.resolution_note}
            </p>
          ) : null}
        </div>

        <div className="grid min-w-[280px] gap-3">
          <Link
            href={signal.route}
            className="w-full rounded-full border border-[rgba(71,176,255,0.18)] bg-[rgba(11,24,41,0.72)] px-4 py-2 text-center text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(15,31,53,0.82)]"
          >
            {signal.cta_label}
          </Link>
          {actionsEnabled ? (
            <>
              {signal.status === "open" ? (
                <form action={updatePulseSignalAction}>
                  <input type="hidden" name="shopId" value={activeShopId} />
                  <input type="hidden" name="signalId" value={signal.id} />
                  <input type="hidden" name="action" value="acknowledge" />
                  <input type="hidden" name="title" value={signal.title} />
                  <button
                    type="submit"
                    className="w-full rounded-full border border-[rgba(71,176,255,0.18)] bg-[rgba(10,36,68,0.82)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(15,47,87,0.88)]"
                  >
                    Acknowledge
                  </button>
                </form>
              ) : null}
              {signal.status !== "resolved" ? (
                <form action={updatePulseSignalAction}>
                  <input type="hidden" name="shopId" value={activeShopId} />
                  <input type="hidden" name="signalId" value={signal.id} />
                  <input type="hidden" name="action" value="resolve" />
                  <input type="hidden" name="title" value={signal.title} />
                  <input type="hidden" name="note" value="Resolved from pulse desk." />
                  <button
                    type="submit"
                    className="w-full rounded-full border border-[rgba(58,215,162,0.18)] bg-[rgba(9,42,31,0.64)] px-4 py-2 text-sm font-semibold text-[var(--success)] transition hover:bg-[rgba(11,54,39,0.78)]"
                  >
                    Resolve
                  </button>
                </form>
              ) : (
                <form action={updatePulseSignalAction}>
                  <input type="hidden" name="shopId" value={activeShopId} />
                  <input type="hidden" name="signalId" value={signal.id} />
                  <input type="hidden" name="action" value="reopen" />
                  <input type="hidden" name="title" value={signal.title} />
                  <button
                    type="submit"
                    className="w-full rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(77,49,9,0.34)] px-4 py-2 text-sm font-semibold text-[var(--warning)] transition hover:bg-[rgba(92,58,10,0.46)]"
                  >
                    Reopen
                  </button>
                </form>
              )}
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default async function PulsePage({ searchParams }: PulsePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const canUsePulse = canManageWorkspace(activeShop?.role ?? null);
  const mfaPosture = await getAdminWebMfaPosture(session.user, canUsePulse);
  const pulse =
    activeShop && canUsePulse && mfaPosture.verified
      ? await getWorkspacePulse(activeShop.shop.id)
      : null;
  const signals =
    activeShop && canUsePulse && mfaPosture.verified
      ? await getWorkspacePulseSignals(activeShop.shop.id)
      : [];
  const banner = buildBanner(resolvedSearchParams);

  const openSignals = signals.filter((signal) => signal.status !== "resolved");
  const resolvedSignals = signals.filter((signal) => signal.status === "resolved");

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="pulse"
      title="Workspace pulse"
      subtitle="Track live owner/admin tasks, review anomaly signals, and acknowledge or resolve operational issues before they spread."
    >
      {!activeShop ? (
        <EmptyState
          title="No workspace selected"
          body="Choose an active shop membership before opening the pulse desk."
        />
      ) : canUsePulse && !mfaPosture.verified ? (
        <MfaGateCard href="/security?returnTo=/pulse" enabled={mfaPosture.enabled} title="Workspace pulse" />
      ) : !canUsePulse ? (
        <EmptyState
          title="Pulse stays with manager-level roles"
          body="Daily operators should stay in the selling flow. Workspace pulse is reserved for owner/admin users who need cross-store priorities and anomaly visibility."
        />
      ) : pulse ? (
        <div className="space-y-8">
          {banner ? (
            <section className={`panel-soft rounded-[28px] border px-6 py-5 ${banner.accent}`}>
              <p className="eyebrow text-current/70">Pulse signal</p>
              <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">{banner.title}</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{banner.body}</p>
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Open signals"
              value={openSignals.length.toString()}
              detail="Signals still needing owner/admin handling"
              icon="PLS"
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
              label="Resolved"
              value={resolvedSignals.length.toString()}
              detail="Signals already cleared from the pulse desk"
              icon="OK"
              accent="green"
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

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
            <div className="space-y-6">
              <section className="panel-soft rounded-[28px] px-6 py-6">
                <div>
                  <p className="eyebrow">Open pulse desk</p>
                  <h2 className="mt-3 text-2xl font-bold">Signals still needing action</h2>
                </div>
                <div className="mt-6 space-y-4">
                  {openSignals.length ? (
                    openSignals.map((signal) =>
                      renderSignalCard(activeShop.shop.id, signal, true),
                    )
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      No open pulse signals are waiting right now.
                    </p>
                  )}
                </div>
              </section>

              <section className="panel-soft rounded-[28px] px-6 py-6">
                <div>
                  <p className="eyebrow">Recently resolved</p>
                  <h2 className="mt-3 text-2xl font-bold">Cleared signals</h2>
                </div>
                <div className="mt-6 space-y-4">
                  {resolvedSignals.length ? (
                    resolvedSignals.slice(0, 6).map((signal) =>
                      renderSignalCard(activeShop.shop.id, signal, true),
                    )
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      No resolved pulse signals yet.
                    </p>
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Desk rules</p>
                <h2 className="mt-3 text-2xl font-bold">How to use pulse well</h2>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                  <li>- Acknowledge when someone has taken ownership of the issue.</li>
                  <li>- Resolve only after the underlying problem is actually cleared.</li>
                  <li>- Signals can reopen automatically if the condition appears again later.</li>
                  <li>- Keep the pulse desk for owners/admins, not daily cashier work.</li>
                </ul>
              </section>
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
