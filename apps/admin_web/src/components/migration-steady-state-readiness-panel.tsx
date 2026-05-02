import { recordSteadyStateCheckpointAction } from "@/app/migration/actions";
import type { MigrationSteadyStateReadiness } from "@/lib/types";

type MigrationSteadyStateReadinessPanelProps = {
  readiness: MigrationSteadyStateReadiness;
};

function getTone(status: MigrationSteadyStateReadiness["overall_status"]) {
  switch (status) {
    case "operating_normally":
      return {
        shell:
          "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.76)]",
        badge:
          "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.88)] text-[var(--success)]",
        label: "Operating normally",
      };
    case "steady_state_ready":
      return {
        shell:
          "border-[rgba(56,189,248,0.18)] bg-[rgba(7,20,33,0.76)]",
        badge:
          "border-[rgba(56,189,248,0.18)] bg-[rgba(7,20,33,0.88)] text-[#38bdf8]",
        label: "Ready for steady state",
      };
    case "improvement_window":
      return {
        shell:
          "border-[rgba(250,204,21,0.18)] bg-[rgba(38,30,7,0.76)]",
        badge:
          "border-[rgba(250,204,21,0.18)] bg-[rgba(38,30,7,0.88)] text-[#facc15]",
        label: "Improvement window",
      };
    case "architecture_review_required":
      return {
        shell:
          "border-[rgba(168,85,247,0.18)] bg-[rgba(28,12,40,0.76)]",
        badge:
          "border-[rgba(168,85,247,0.18)] bg-[rgba(28,12,40,0.88)] text-[#c084fc]",
        label: "Architecture review",
      };
    case "incident_stabilization":
      return {
        shell:
          "border-[rgba(251,146,60,0.18)] bg-[rgba(44,24,7,0.76)]",
        badge:
          "border-[rgba(251,146,60,0.18)] bg-[rgba(44,24,7,0.88)] text-[#fb923c]",
        label: "Incident stabilization",
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

export function MigrationSteadyStateReadinessPanel({
  readiness,
}: MigrationSteadyStateReadinessPanelProps) {
  const tone = getTone(readiness.overall_status);

  return (
    <section className={`panel-soft rounded-[28px] border px-6 py-6 ${tone.shell}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Steady-state governance gate</p>
          <h2 className="mt-3 text-2xl font-bold">Phase 8 normal operations</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
            This is the long-term operating posture after rollout: are we ready to
            accept steady-state, intentionally holding for improvement, in an
            architecture review window, or actively stabilizing incidents?
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
            Rollout complete
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {readiness.rollout_completed ? "Yes" : "No"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            latest rollout: {readiness.latest_rollout_decision ?? "none"}
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Steady-state accepted
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {readiness.steady_state_accepted ? "Yes" : "No"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            governance decision recorded
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Improvement / review
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {readiness.improvement_window_active ? "Imp" : "No"} /{" "}
            {readiness.architecture_review_active ? "Rev" : "No"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            planned governance pressure
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Incident stabilization
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {readiness.incident_stabilization_active ? "Active" : "Idle"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            rollback signals: {readiness.rollback_recommended_shop_count}
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Latest steady-state
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
            {readiness.latest_steady_state_decision ?? "none"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            state: {readiness.latest_steady_state_status_snapshot ?? "n/a"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-4">
        <form action={recordSteadyStateCheckpointAction}>
          <input type="hidden" name="phase" value={readiness.phase} />
          <input type="hidden" name="decision" value="accept_steady_state" />
          <button type="submit" className="w-full rounded-[14px] border border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.88)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--success)]">
            Accept steady state
          </button>
        </form>
        <form action={recordSteadyStateCheckpointAction}>
          <input type="hidden" name="phase" value={readiness.phase} />
          <input type="hidden" name="decision" value="hold_for_improvement" />
          <button type="submit" className="w-full rounded-[14px] border border-[rgba(250,204,21,0.18)] bg-[rgba(38,30,7,0.88)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#facc15]">
            Hold improvement
          </button>
        </form>
        <form action={recordSteadyStateCheckpointAction}>
          <input type="hidden" name="phase" value={readiness.phase} />
          <input type="hidden" name="decision" value="architecture_review_required" />
          <button type="submit" className="w-full rounded-[14px] border border-[rgba(168,85,247,0.18)] bg-[rgba(28,12,40,0.88)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#c084fc]">
            Architecture review
          </button>
        </form>
        <form action={recordSteadyStateCheckpointAction}>
          <input type="hidden" name="phase" value={readiness.phase} />
          <input type="hidden" name="decision" value="incident_stabilization_active" />
          <button type="submit" className="w-full rounded-[14px] border border-[rgba(251,146,60,0.18)] bg-[rgba(44,24,7,0.88)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#fb923c]">
            Incident stabilization
          </button>
        </form>
      </div>
    </section>
  );
}
