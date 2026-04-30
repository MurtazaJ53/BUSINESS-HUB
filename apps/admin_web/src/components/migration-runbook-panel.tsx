import type { MigrationPilotReadiness } from "@/lib/types";

type MigrationRunbookPanelProps = {
  readiness: MigrationPilotReadiness[];
};

export function MigrationRunbookPanel({ readiness }: MigrationRunbookPanelProps) {
  const readyCandidates = readiness.filter((row) => row.ready_for_pilot);
  const nextCandidate =
    readyCandidates.find((row) => row.recommended_next_status === "postgres_primary") ??
    readyCandidates.find((row) => row.recommended_next_status === "ready") ??
    null;
  const blockedCandidates = readiness.filter((row) => !row.ready_for_pilot).slice(0, 3);

  return (
    <section className="panel-soft rounded-[28px] px-6 py-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <p className="eyebrow">Pilot runbook</p>
          <h2 className="mt-3 text-2xl font-bold">How to execute the next safe cutover</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
            This is the operator checklist for the first real Phase 3 pilot. It turns the migration
            console from a diagnostics page into an execution surface by showing which domain is
            actually safe to move and what to do before and after promotion.
          </p>

          <div className="mt-6 grid gap-3">
            {[
              "Confirm latest backfill and shadow compare succeeded with zero mismatches.",
              "Promote the domain to ready first and watch for new critical or stale-epoch events.",
              "Once the same domain clears the gate again, promote it to PostgreSQL primary.",
              "Monitor replay receipts, shadow summaries, and reconciliation for the first live write window.",
              "If new critical drift appears, rollback immediately from the same pilot table.",
            ].map((step, index) => (
              <div
                key={step}
                className="flex items-start gap-3 rounded-[18px] border border-[rgba(152,164,189,0.12)] bg-[rgba(13,18,28,0.62)] px-4 py-4"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(92,174,254,0.16)] bg-[rgba(9,18,34,0.82)] text-xs font-semibold text-[var(--accent)]">
                  {index + 1}
                </div>
                <p className="text-sm leading-6 text-[var(--text-secondary)]">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[24px] border border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.72)] px-5 py-5">
            <p className="eyebrow text-[rgba(173,241,212,0.7)]">Best current candidate</p>
            {nextCandidate ? (
              <>
                <h3 className="mt-3 text-xl font-bold text-[var(--text-primary)]">
                  {nextCandidate.shop_name} / {nextCandidate.domain}
                </h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Recommended next action:
                  {" "}
                  <span className="font-semibold text-[var(--success)]">
                    {nextCandidate.recommended_next_status}
                  </span>
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Compare status:
                  {" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {nextCandidate.latest_compare_status ?? "no compare"}
                  </span>
                  {" "}
                  with {nextCandidate.latest_compare_mismatches} mismatches.
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Open issues:
                  {" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {nextCandidate.open_events}
                  </span>
                  {" "}
                  total /
                  {" "}
                  <span className="font-semibold text-[var(--warning)]">
                    {nextCandidate.open_critical_events}
                  </span>
                  {" "}
                  critical.
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                No domain is currently ready for promotion. Clear blockers in the readiness table,
                rerun compare jobs, and use the reconciliation queue before attempting a pilot.
              </p>
            )}
          </div>

          <div className="rounded-[24px] border border-[rgba(251,113,133,0.16)] bg-[rgba(40,12,19,0.6)] px-5 py-5">
            <p className="eyebrow text-[rgba(251,113,133,0.72)]">Top blockers to clear</p>
            <div className="mt-4 space-y-3">
              {blockedCandidates.length ? (
                blockedCandidates.map((candidate) => (
                  <div
                    key={`${candidate.control_id}-blockers`}
                    className="rounded-[18px] border border-[rgba(251,113,133,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-4"
                  >
                    <p className="font-semibold text-[var(--text-primary)]">
                      {candidate.shop_name} / {candidate.domain}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
                      {candidate.blocking_reasons.slice(0, 2).map((reason) => (
                        <li key={reason}>• {reason}</li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-[var(--text-secondary)]">
                  No blocking domains at the moment. Keep watching bridge receipts and compare
                  summaries while pilots advance.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
