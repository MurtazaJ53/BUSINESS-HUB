import type { MigrationPilotReadiness } from "@/lib/types";

type MigrationPilotStageStripProps = {
  readiness: MigrationPilotReadiness[];
};

const STAGES: Array<MigrationPilotReadiness["cutover_status"]> = [
  "legacy",
  "pilot",
  "ready",
  "postgres_primary",
];

function getStageState(
  current: MigrationPilotReadiness["cutover_status"],
  stage: MigrationPilotReadiness["cutover_status"],
) {
  const currentIndex = STAGES.indexOf(current);
  const stageIndex = STAGES.indexOf(stage);

  if (stageIndex < currentIndex) {
    return "complete";
  }
  if (stageIndex === currentIndex) {
    return "current";
  }
  return "upcoming";
}

function getStageClasses(state: ReturnType<typeof getStageState>) {
  switch (state) {
    case "complete":
      return {
        dot: "border-[rgba(52,211,153,0.22)] bg-[rgba(7,33,25,0.88)] text-[var(--success)]",
        line: "bg-[rgba(52,211,153,0.28)]",
        label: "text-[var(--success)]",
      };
    case "current":
      return {
        dot: "border-[rgba(92,174,254,0.2)] bg-[rgba(9,18,34,0.88)] text-[var(--accent)]",
        line: "bg-[rgba(92,174,254,0.2)]",
        label: "text-[var(--accent)]",
      };
    default:
      return {
        dot: "border-[rgba(152,164,189,0.12)] bg-[rgba(11,16,26,0.82)] text-[var(--text-muted)]",
        line: "bg-[rgba(152,164,189,0.12)]",
        label: "text-[var(--text-muted)]",
      };
  }
}

export function MigrationPilotStageStrip({
  readiness,
}: MigrationPilotStageStripProps) {
  if (!readiness.length) {
    return null;
  }

  return (
    <section className="panel-soft rounded-[28px] px-6 py-6">
      <div>
        <p className="eyebrow">Pilot stage map</p>
        <h2 className="mt-3 text-2xl font-bold">Domain cutover timeline</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          This strips the pilot flow down to the signal operators need most:
          where each domain currently sits, what owns writes, and which step
          should happen next.
        </p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {readiness.map((row) => (
          <article
            key={`${row.control_id}-stage`}
            className="rounded-[24px] border border-[rgba(152,164,189,0.12)] bg-[rgba(13,18,28,0.62)] px-5 py-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-[var(--text-primary)]">
                  {row.shop_name} / {row.domain}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {row.shop_slug} / write master {row.write_master} / bridge{" "}
                  {row.bridge_mode}
                </p>
              </div>
              <div
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                  row.ready_for_pilot
                    ? "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.72)] text-[var(--success)]"
                    : "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.72)] text-[var(--warning)]"
                }`}
              >
                {row.ready_for_pilot ? "Ready for pilot" : "Blocked"}
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center gap-0">
                {STAGES.map((stage, index) => {
                  const state = getStageState(row.cutover_status, stage);
                  const classes = getStageClasses(state);

                  return (
                    <div
                      key={`${row.control_id}-${stage}`}
                      className="flex min-w-0 flex-1 items-center"
                    >
                      <div className="min-w-0">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full border text-[11px] font-semibold uppercase tracking-[0.12em] ${classes.dot}`}
                        >
                          {index + 1}
                        </div>
                        <p
                          className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${classes.label}`}
                        >
                          {stage.replace("_", " ")}
                        </p>
                      </div>
                      {index < STAGES.length - 1 ? (
                        <div className={`mx-3 h-[2px] flex-1 ${classes.line}`} />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Current stage
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                  {row.cutover_status}
                </p>
              </div>
              <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Next move
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--accent)]">
                  {row.recommended_next_status}
                </p>
              </div>
              <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Compare posture
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                  {row.latest_compare_status ?? "no compare"} /{" "}
                  {row.latest_compare_mismatches} mismatches
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Gate summary
              </p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {row.blocking_reasons.length
                  ? row.blocking_reasons[0]
                  : "No blocking reasons. This domain can move with the pilot controls below."}
              </p>
              {row.warnings.length ? (
                <p className="mt-2 text-xs text-[var(--warning)]">
                  Warning: {row.warnings[0]}
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
