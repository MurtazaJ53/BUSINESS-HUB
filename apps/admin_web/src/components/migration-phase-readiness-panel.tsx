import type { MigrationPhaseReadiness } from "@/lib/types";

type MigrationPhaseReadinessPanelProps = {
  readiness: MigrationPhaseReadiness;
};

function getTone(status: MigrationPhaseReadiness["overall_status"]) {
  switch (status) {
    case "ready_for_phase_exit":
      return {
        shell:
          "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.68)]",
        badge:
          "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.82)] text-[var(--success)]",
        label: "Ready for phase exit",
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
          "border-[rgba(152,164,189,0.16)] bg-[rgba(13,18,28,0.62)]",
        badge:
          "border-[rgba(152,164,189,0.18)] bg-[rgba(18,21,32,0.82)] text-[var(--text-secondary)]",
        label: "Blocked",
      };
  }
}

export function MigrationPhaseReadinessPanel({
  readiness,
}: MigrationPhaseReadinessPanelProps) {
  const tone = getTone(readiness.overall_status);

  return (
    <section className={`panel-soft rounded-[28px] border px-6 py-6 ${tone.shell}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Phase exit gate</p>
          <h2 className="mt-3 text-2xl font-bold">Phase 3 program readiness</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
            This is the top-level answer for the migration program: are the pilot
            shops clean enough to leave Phase 3, still under monitoring, blocked,
            or actively signaling rollback pressure?
          </p>
        </div>
        <div
          className={`rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${tone.badge}`}
        >
          {tone.label}
        </div>
      </div>

      <div className="mt-5 rounded-[18px] border border-[rgba(152,164,189,0.1)] bg-[rgba(0,0,0,0.14)] px-4 py-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Recommended action
        </p>
        <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
          {readiness.recommended_action}
        </p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {readiness.summary}
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Pilot shops
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {readiness.pilot_shop_count}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {readiness.shops_without_checkpoint} without checkpoint
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Approved / hold
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {readiness.approved_for_cutover_count} / {readiness.hold_for_monitoring_count}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            latest checkpoint decisions
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Safe / ready
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {readiness.production_safe_shop_count} / {readiness.ready_for_cutover_shop_count}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            shop scorecard posture
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Monitoring / blocked
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {readiness.monitoring_shop_count} / {readiness.blocked_shop_count}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            active operator pressure
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Rollback signals
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {readiness.rollback_escalated_count} / {readiness.rollback_recommended_shop_count}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            checkpoint / scorecard
          </p>
        </div>
      </div>

      {readiness.shops.length ? (
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {readiness.shops.slice(0, 6).map((shop) => (
            <div
              key={`${shop.shop}-phase-readiness`}
              className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {shop.shop_name}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {shop.shop_slug}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  {shop.overall_status}
                </span>
              </div>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                {shop.summary}
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Checkpoint: {shop.latest_checkpoint_decision ?? "not recorded"} /{" "}
                {shop.latest_checkpoint_overall_status ?? "no snapshot yet"}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
