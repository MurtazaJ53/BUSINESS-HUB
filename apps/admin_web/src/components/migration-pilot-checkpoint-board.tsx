import type { MigrationPilotReadiness } from "@/lib/types";

type MigrationPilotCheckpointBoardProps = {
  readiness: MigrationPilotReadiness[];
};

type CheckpointState = "done" | "current" | "blocked";

function getCheckpointTone(state: CheckpointState) {
  switch (state) {
    case "done":
      return {
        badge:
          "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.72)] text-[var(--success)]",
        text: "Complete",
      };
    case "current":
      return {
        badge:
          "border-[rgba(92,174,254,0.18)] bg-[rgba(9,18,34,0.72)] text-[var(--accent)]",
        text: "Current",
      };
    default:
      return {
        badge:
          "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.72)] text-[var(--warning)]",
        text: "Blocked",
      };
  }
}

function buildCheckpoints(row: MigrationPilotReadiness) {
  const hasBackfill = Boolean(row.last_backfill_at);
  const compareClean =
    row.latest_compare_status === "succeeded" &&
    row.latest_compare_mismatches === 0;
  const issuesClear =
    row.open_critical_events === 0 && row.open_stale_epoch_events === 0;
  const canPromoteReady =
    row.ready_for_pilot && row.recommended_next_status === "ready";
  const canPromotePrimary =
    row.ready_for_pilot &&
    row.recommended_next_status === "postgres_primary";
  const isPrimary = row.cutover_status === "postgres_primary";

  return [
    {
      key: "backfill",
      label: "Backfill snapshot",
      detail: hasBackfill
        ? `Last backfill recorded at ${row.last_backfill_at}.`
        : "No backfill recorded yet for this domain.",
      state: hasBackfill ? "done" : "blocked",
    },
    {
      key: "compare",
      label: "Clean shadow compare",
      detail: compareClean
        ? "Latest compare succeeded with zero mismatches."
        : `Latest compare is ${row.latest_compare_status ?? "missing"} with ${row.latest_compare_mismatches} mismatches.`,
      state: compareClean ? "done" : "blocked",
    },
    {
      key: "issues",
      label: "Critical drift cleared",
      detail: issuesClear
        ? "No open critical or stale-epoch issues are blocking the domain."
        : `${row.open_critical_events} critical and ${row.open_stale_epoch_events} stale-epoch issues still need review.`,
      state: issuesClear ? "done" : "blocked",
    },
    {
      key: "promote-ready",
      label: "Promote to ready",
      detail:
        row.cutover_status === "ready" || row.cutover_status === "postgres_primary"
          ? "Domain already passed the ready stage."
          : canPromoteReady
            ? "The pilot gate is clean enough to promote this domain to ready."
            : "Keep the domain in pilot preparation until the gate turns clean.",
      state:
        row.cutover_status === "ready" || row.cutover_status === "postgres_primary"
          ? "done"
          : canPromoteReady
            ? "current"
            : "blocked",
    },
    {
      key: "promote-primary",
      label: "Promote to postgres primary",
      detail: isPrimary
        ? "This domain is already owned by PostgreSQL writes."
        : canPromotePrimary
          ? "The next safe action is to promote this domain to postgres primary."
          : "Do not promote primary until the domain clears the gate again after ready.",
      state: isPrimary ? "done" : canPromotePrimary ? "current" : "blocked",
    },
    {
      key: "verify",
      label: "Verify and monitor",
      detail: isPrimary
        ? "Run verify-pilot and watch reconciliation, bridge receipts, and compare posture."
        : "Verification becomes mandatory immediately after postgres primary promotion.",
      state: isPrimary ? "current" : "blocked",
    },
  ] as const;
}

function getDomainRecommendation(row: MigrationPilotReadiness) {
  if (row.cutover_status === "postgres_primary") {
    return {
      title: "Verify live pilot",
      detail:
        "This domain is already primary on PostgreSQL. Keep verifying drift and be ready to rollback if new critical mismatch appears.",
    };
  }

  if (row.ready_for_pilot && row.recommended_next_status === "postgres_primary") {
    return {
      title: "Promote primary",
      detail:
        "The domain has already passed ready and is currently the best candidate to flip into PostgreSQL write ownership.",
    };
  }

  if (row.ready_for_pilot && row.recommended_next_status === "ready") {
    return {
      title: "Promote ready",
      detail:
        "The pilot gate is clean enough to move this domain into the ready stage before the final primary cutover.",
    };
  }

  return {
    title: "Keep preparing",
    detail:
      "Do not promote this domain yet. Clear blockers, rerun prep jobs, and resolve reconciliation issues first.",
  };
}

export function MigrationPilotCheckpointBoard({
  readiness,
}: MigrationPilotCheckpointBoardProps) {
  if (!readiness.length) {
    return null;
  }

  return (
    <section className="panel-soft rounded-[28px] px-6 py-6">
      <div>
        <p className="eyebrow">Pilot checkpoint</p>
        <h2 className="mt-3 text-2xl font-bold">Go or no-go by domain</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          This is the actual readiness checkpoint for the first live pilot.
          It breaks each domain into the steps operators have to clear before a
          safe PostgreSQL cutover can happen.
        </p>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {readiness.map((row) => {
          const checkpoints = buildCheckpoints(row);
          const recommendation = getDomainRecommendation(row);

          return (
            <article
              key={`${row.control_id}-checkpoint`}
              className="rounded-[24px] border border-[rgba(152,164,189,0.12)] bg-[rgba(13,18,28,0.62)] px-5 py-5"
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
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                    row.ready_for_pilot
                      ? "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.72)] text-[var(--success)]"
                      : "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.72)] text-[var(--warning)]"
                  }`}
                >
                  {row.ready_for_pilot ? "Go signal" : "No-go"}
                </div>
              </div>

              <div className="mt-4 rounded-[18px] border border-[rgba(92,174,254,0.12)] bg-[rgba(9,18,34,0.48)] px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Operator recommendation
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--accent)]">
                  {recommendation.title}
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {recommendation.detail}
                </p>
              </div>

              <div className="mt-5 grid gap-3">
                {checkpoints.map((checkpoint) => {
                  const tone = getCheckpointTone(checkpoint.state);

                  return (
                    <div
                      key={`${row.control_id}-${checkpoint.key}`}
                      className="flex items-start gap-3 rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-4"
                    >
                      <div
                        className={`mt-0.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${tone.badge}`}
                      >
                        {tone.text}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {checkpoint.label}
                        </p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {checkpoint.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
