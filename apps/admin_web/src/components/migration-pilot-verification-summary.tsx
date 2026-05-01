type MigrationPilotVerificationSummaryProps = {
  domain: string;
  shop: string;
  operationalVerdict: "production_safe" | "monitoring" | "rollback_recommended";
  summary: string;
  healthy: boolean;
  requiresRollback: boolean;
  mismatchCount: number;
  criticalCount: number;
};

function getVerdictTone(
  operationalVerdict: MigrationPilotVerificationSummaryProps["operationalVerdict"],
) {
  switch (operationalVerdict) {
    case "production_safe":
      return {
        shell:
          "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.72)]",
        badge:
          "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.82)] text-[var(--success)]",
        title: "Production-safe",
      };
    case "rollback_recommended":
      return {
        shell:
          "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.72)]",
        badge:
          "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.82)] text-[var(--warning)]",
        title: "Rollback recommended",
      };
    default:
      return {
        shell:
          "border-[rgba(92,174,254,0.18)] bg-[rgba(9,18,34,0.72)]",
        badge:
          "border-[rgba(92,174,254,0.18)] bg-[rgba(9,18,34,0.82)] text-[var(--accent)]",
        title: "Monitoring",
      };
  }
}

export function MigrationPilotVerificationSummary({
  domain,
  shop,
  operationalVerdict,
  summary,
  healthy,
  requiresRollback,
  mismatchCount,
  criticalCount,
}: MigrationPilotVerificationSummaryProps) {
  const tone = getVerdictTone(operationalVerdict);

  return (
    <section className={`panel-soft rounded-[28px] border px-6 py-6 ${tone.shell}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-current/70">Latest pilot verification</p>
          <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">
            {shop} / {domain}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
            {summary}
          </p>
        </div>
        <div
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${tone.badge}`}
        >
          {tone.title}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Verdict
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
            {operationalVerdict}
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Health
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
            {healthy ? "clean" : "drift detected"}
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Compare result
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
            {mismatchCount} mismatches
          </p>
        </div>
        <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Rollback
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
            {requiresRollback ? "recommended" : `${criticalCount} critical issues`}
          </p>
        </div>
      </div>
    </section>
  );
}
