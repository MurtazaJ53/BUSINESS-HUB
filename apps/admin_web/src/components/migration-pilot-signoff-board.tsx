import type { MigrationPilotSignoff } from "@/lib/types";

type MigrationPilotSignoffBoardProps = {
  signoff: MigrationPilotSignoff[];
};

function getSignoffTone(status: MigrationPilotSignoff["signoff_status"]) {
  switch (status) {
    case "production_safe":
      return {
        shell:
          "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.68)]",
        badge:
          "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.82)] text-[var(--success)]",
        label: "Production-safe",
      };
    case "ready_for_cutover":
      return {
        shell:
          "border-[rgba(92,174,254,0.18)] bg-[rgba(9,18,34,0.68)]",
        badge:
          "border-[rgba(92,174,254,0.18)] bg-[rgba(9,18,34,0.82)] text-[var(--accent)]",
        label: "Ready for cutover",
      };
    case "rollback_recommended":
      return {
        shell:
          "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.68)]",
        badge:
          "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.82)] text-[var(--warning)]",
        label: "Rollback recommended",
      };
    case "monitoring":
      return {
        shell:
          "border-[rgba(250,204,21,0.18)] bg-[rgba(38,30,7,0.68)]",
        badge:
          "border-[rgba(250,204,21,0.18)] bg-[rgba(38,30,7,0.82)] text-[#facc15]",
        label: "Monitoring",
      };
    default:
      return {
        shell:
          "border-[rgba(251,113,133,0.18)] bg-[rgba(23,18,24,0.72)]",
        badge:
          "border-[rgba(152,164,189,0.18)] bg-[rgba(18,21,32,0.82)] text-[var(--text-secondary)]",
        label: "Blocked",
      };
  }
}

export function MigrationPilotSignoffBoard({
  signoff,
}: MigrationPilotSignoffBoardProps) {
  if (!signoff.length) {
    return null;
  }

  return (
    <section className="panel-soft rounded-[28px] px-6 py-6">
      <div>
        <p className="eyebrow">Pilot signoff</p>
        <h2 className="mt-3 text-2xl font-bold">Final operator decision by domain</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          This is the condensed Phase 3 decision layer. It converts readiness,
          verification, and drift posture into the final operator answer:
          blocked, monitoring, ready for cutover, production-safe, or rollback
          recommended.
        </p>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {signoff.map((row) => {
          const tone = getSignoffTone(row.signoff_status);

          return (
            <article
              key={`${row.control_id}-signoff`}
              className={`rounded-[24px] border px-5 py-5 ${tone.shell}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-[var(--text-primary)]">
                    {row.shop_name} / {row.domain}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    stage {row.cutover_status} / write master {row.write_master} /
                    epoch {row.current_epoch}
                  </p>
                </div>
                <div
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${tone.badge}`}
                >
                  {tone.label}
                </div>
              </div>

              <div className="mt-4 rounded-[18px] border border-[rgba(152,164,189,0.1)] bg-[rgba(0,0,0,0.14)] px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Recommended action
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                  {row.recommended_action}
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {row.summary}
                </p>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Latest verify
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                    {row.latest_verify_result ?? "not run"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {row.latest_verified_at ?? "No verification timestamp yet"}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Compare posture
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                    {row.latest_compare_status ?? "missing"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {row.latest_compare_mismatches} mismatches
                  </p>
                </div>
                <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Open pressure
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                    {row.open_critical_events} critical
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {row.open_stale_epoch_events} stale epoch
                  </p>
                </div>
              </div>

              {row.blocking_reasons.length ? (
                <div className="mt-5 rounded-[18px] border border-[rgba(251,113,133,0.14)] bg-[rgba(0,0,0,0.12)] px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Active blockers
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
                    {row.blocking_reasons.slice(0, 3).map((reason) => (
                      <li key={reason}>- {reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
