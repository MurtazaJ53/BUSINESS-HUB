import { recordGoLiveCheckpointAction } from "@/app/migration/actions";
import type { MigrationGoLiveReadiness } from "@/lib/types";

type MigrationGoLiveReadinessPanelProps = {
  readiness: MigrationGoLiveReadiness;
};

function getTone(status: MigrationGoLiveReadiness["overall_status"]) {
  switch (status) {
    case "steady_state":
      return {
        shell:
          "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.76)]",
        badge:
          "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.88)] text-[var(--success)]",
        label: "Steady state",
      };
    case "hypercare_active":
      return {
        shell:
          "border-[rgba(168,85,247,0.18)] bg-[rgba(28,12,40,0.76)]",
        badge:
          "border-[rgba(168,85,247,0.18)] bg-[rgba(28,12,40,0.88)] text-[#c084fc]",
        label: "Hypercare active",
      };
    case "ready_for_go_live":
      return {
        shell:
          "border-[rgba(56,189,248,0.18)] bg-[rgba(7,20,33,0.76)]",
        badge:
          "border-[rgba(56,189,248,0.18)] bg-[rgba(7,20,33,0.88)] text-[#38bdf8]",
        label: "Ready for go-live",
      };
    case "rollback_recommended":
      return {
        shell:
          "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.76)]",
        badge:
          "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.88)] text-[var(--warning)]",
        label: "Rollback launch",
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

export function MigrationGoLiveReadinessPanel({
  readiness,
}: MigrationGoLiveReadinessPanelProps) {
  const tone = getTone(readiness.overall_status);

  return (
    <section className={`panel-soft rounded-[28px] border px-6 py-6 ${tone.shell}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Go-live and hypercare gate</p>
          <h2 className="mt-3 text-2xl font-bold">Phase 6 launch execution</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
            This is the final operator surface for moving from launch approval into
            the real go-live window, then into hypercare, and finally into
            steady-state ownership. It should be the last gate before the platform
            is treated as fully normal operations.
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
            launch-program shops in final review
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Ready for launch
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {readiness.ready_for_launch_shop_count}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            last launch checkpoint: {readiness.latest_launch_decision ?? "none"}
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Monitoring
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {readiness.monitoring_shop_count}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            shops still under hardening pressure
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Blocked
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {readiness.blocked_shop_count}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            launch blockers still active
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Go-live signal
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {readiness.latest_go_live_decision ?? "none"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            rollback pressure: {readiness.rollback_recommended_shop_count}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-4">
        <form action={recordGoLiveCheckpointAction}>
          <input type="hidden" name="phase" value={readiness.phase} />
          <input type="hidden" name="decision" value="execute_go_live" />
          <button
            type="submit"
            className="w-full rounded-[14px] border border-[rgba(56,189,248,0.18)] bg-[rgba(7,20,33,0.88)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#38bdf8]"
          >
            Execute go-live
          </button>
        </form>
        <form action={recordGoLiveCheckpointAction}>
          <input type="hidden" name="phase" value={readiness.phase} />
          <input type="hidden" name="decision" value="remain_in_hypercare" />
          <button
            type="submit"
            className="w-full rounded-[14px] border border-[rgba(168,85,247,0.18)] bg-[rgba(28,12,40,0.88)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#c084fc]"
          >
            Remain in hypercare
          </button>
        </form>
        <form action={recordGoLiveCheckpointAction}>
          <input type="hidden" name="phase" value={readiness.phase} />
          <input type="hidden" name="decision" value="handoff_to_steady_state" />
          <button
            type="submit"
            className="w-full rounded-[14px] border border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.88)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--success)]"
          >
            Handoff to steady state
          </button>
        </form>
        <form action={recordGoLiveCheckpointAction}>
          <input type="hidden" name="phase" value={readiness.phase} />
          <input type="hidden" name="decision" value="rollback_launch" />
          <button
            type="submit"
            className="w-full rounded-[14px] border border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.88)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--warning)]"
          >
            Roll back launch
          </button>
        </form>
      </div>

      {readiness.shops.length ? (
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {readiness.shops.slice(0, 6).map((shop) => (
            <div
              key={`${shop.shop}-go-live-readiness`}
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
                Missing domains: {shop.missing_domains.length || 0} / Firebase primary:{" "}
                {shop.firebase_primary_domains} / Critical events: {shop.open_critical_events}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
