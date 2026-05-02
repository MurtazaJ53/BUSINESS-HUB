import { recordRolloutCheckpointAction } from "@/app/migration/actions";
import type { MigrationRolloutReadiness } from "@/lib/types";

type MigrationRolloutReadinessPanelProps = {
  readiness: MigrationRolloutReadiness;
};

function getTone(status: MigrationRolloutReadiness["overall_status"]) {
  switch (status) {
    case "completed":
      return {
        shell:
          "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.76)]",
        badge:
          "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.88)] text-[var(--success)]",
        label: "Rollout complete",
      };
    case "scale_tuning":
      return {
        shell:
          "border-[rgba(250,204,21,0.18)] bg-[rgba(38,30,7,0.76)]",
        badge:
          "border-[rgba(250,204,21,0.18)] bg-[rgba(38,30,7,0.88)] text-[#facc15]",
        label: "Scale tuning",
      };
    case "rollout_active":
      return {
        shell:
          "border-[rgba(56,189,248,0.18)] bg-[rgba(7,20,33,0.76)]",
        badge:
          "border-[rgba(56,189,248,0.18)] bg-[rgba(7,20,33,0.88)] text-[#38bdf8]",
        label: "Rollout active",
      };
    case "wave_ready":
      return {
        shell:
          "border-[rgba(168,85,247,0.18)] bg-[rgba(28,12,40,0.76)]",
        badge:
          "border-[rgba(168,85,247,0.18)] bg-[rgba(28,12,40,0.88)] text-[#c084fc]",
        label: "Wave ready",
      };
    case "rollback_recommended":
      return {
        shell:
          "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.76)]",
        badge:
          "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.88)] text-[var(--warning)]",
        label: "Rollback pressure",
      };
    default:
      return {
        shell:
          "border-[rgba(152,164,189,0.16)] bg-[rgba(13,18,28,0.7)]",
        badge:
          "border-[rgba(152,164,189,0.18)] bg-[rgba(18,21,32,0.82)] text-[var(--text-secondary)]",
        label: "Blocked",
      };
  }
}

export function MigrationRolloutReadinessPanel({
  readiness,
}: MigrationRolloutReadinessPanelProps) {
  const tone = getTone(readiness.overall_status);

  return (
    <section className={`panel-soft rounded-[28px] border px-6 py-6 ${tone.shell}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Rollout and scale gate</p>
          <h2 className="mt-3 text-2xl font-bold">Phase 7 live rollout</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
            This surface governs expansion after first-launch stability: rollout
            waves, pause/hold decisions, scale tuning, and final completion of the
            rollout program.
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
            Shops tracked
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {readiness.shop_count}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            rollout-program shops
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Launch-ready shops
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {readiness.ready_for_launch_shop_count}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            base set before expansion
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Monitoring shops
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {readiness.monitoring_shop_count}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            watch closely during waves
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Latest go-live
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
            {readiness.latest_go_live_decision ?? "none"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            state: {readiness.latest_go_live_status_snapshot ?? "n/a"}
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Latest rollout
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
            {readiness.latest_rollout_decision ?? "none"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            rollback signals: {readiness.rollback_recommended_shop_count}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-5">
        <form action={recordRolloutCheckpointAction}>
          <input type="hidden" name="phase" value={readiness.phase} />
          <input type="hidden" name="decision" value="advance_rollout_wave" />
          <button type="submit" className="w-full rounded-[14px] border border-[rgba(56,189,248,0.18)] bg-[rgba(7,20,33,0.88)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#38bdf8]">
            Advance wave
          </button>
        </form>
        <form action={recordRolloutCheckpointAction}>
          <input type="hidden" name="phase" value={readiness.phase} />
          <input type="hidden" name="decision" value="hold_rollout_wave" />
          <button type="submit" className="w-full rounded-[14px] border border-[rgba(168,85,247,0.18)] bg-[rgba(28,12,40,0.88)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#c084fc]">
            Hold wave
          </button>
        </form>
        <form action={recordRolloutCheckpointAction}>
          <input type="hidden" name="phase" value={readiness.phase} />
          <input type="hidden" name="decision" value="scale_tuning_active" />
          <button type="submit" className="w-full rounded-[14px] border border-[rgba(250,204,21,0.18)] bg-[rgba(38,30,7,0.88)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#facc15]">
            Scale tuning
          </button>
        </form>
        <form action={recordRolloutCheckpointAction}>
          <input type="hidden" name="phase" value={readiness.phase} />
          <input type="hidden" name="decision" value="complete_rollout" />
          <button type="submit" className="w-full rounded-[14px] border border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.88)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--success)]">
            Complete rollout
          </button>
        </form>
        <form action={recordRolloutCheckpointAction}>
          <input type="hidden" name="phase" value={readiness.phase} />
          <input type="hidden" name="decision" value="rollback_shop_wave" />
          <button type="submit" className="w-full rounded-[14px] border border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.88)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--warning)]">
            Roll back wave
          </button>
        </form>
      </div>
    </section>
  );
}
