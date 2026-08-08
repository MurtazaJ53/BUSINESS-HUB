import { recordShopCheckpointAction } from "@/app/migration/actions";
import type { MigrationPilotShopScorecard } from "@/lib/types";

type MigrationPilotShopScorecardBoardProps = {
  scorecards: MigrationPilotShopScorecard[];
};

function getTone(status: MigrationPilotShopScorecard["overall_status"]) {
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
          "border-[rgba(152,164,189,0.16)] bg-[rgba(13,18,28,0.62)]",
        badge:
          "border-[rgba(152,164,189,0.18)] bg-[rgba(18,21,32,0.82)] text-[var(--text-secondary)]",
        label: "Blocked",
      };
  }
}

export function MigrationPilotShopScorecardBoard({
  scorecards,
}: MigrationPilotShopScorecardBoardProps) {
  if (!scorecards.length) {
    return null;
  }

  return (
    <section className="panel-soft rounded-[28px] px-6 py-6">
      <div>
        <p className="eyebrow">Shop cutover checkpoint</p>
        <h2 className="mt-3 text-2xl font-bold">Pilot decision by shop</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          This is the first shop-level Phase 3 checkpoint. It combines the
          pilot-domain signoff results into one answer: blocked, monitoring,
          ready for cutover, production-safe, or rollback recommended.
        </p>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {scorecards.map((row) => {
          const tone = getTone(row.overall_status);

          return (
            <article
              key={`${row.shop}-pilot-scorecard`}
              className={`rounded-[24px] border px-5 py-5 ${tone.shell}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-[var(--text-primary)]">
                    {row.shop_name}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {row.shop_slug}
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
                    Safe / ready
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                    {row.production_safe_domains} safe / {row.ready_for_cutover_domains} ready
                  </p>
                </div>
                <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Monitoring / blocked
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                    {row.monitoring_domains} monitoring / {row.blocked_domains} blocked
                  </p>
                </div>
                <div className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Rollback / missing
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                    {row.rollback_recommended_domains} rollback / {row.missing_domains.length} missing
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {row.domains.map((domain) => (
                  <div
                    key={`${row.shop}-${domain.domain}`}
                    className="rounded-[18px] border border-[rgba(152,164,189,0.08)] bg-[rgba(0,0,0,0.14)] px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {domain.domain}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          stage {domain.cutover_status} / write master {domain.write_master}
                        </p>
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                        {domain.signoff_status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      {domain.summary}
                    </p>
                  </div>
                ))}
              </div>

              {row.missing_domains.length ? (
                <div className="mt-5 rounded-[18px] border border-[rgba(251,113,133,0.14)] bg-[rgba(0,0,0,0.12)] px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Missing pilot domains
                  </p>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    {row.missing_domains.join(", ")}
                  </p>
                </div>
              ) : null}

              <div className="mt-5 grid gap-2 md:grid-cols-3">
                <form action={recordShopCheckpointAction}>
                  <input type="hidden" name="shopId" value={row.shop} />
                  <input type="hidden" name="shop" value={row.shop_name} />
                  <input
                    type="hidden"
                    name="decision"
                    value="approved_for_cutover"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-[14px] border border-[rgba(52,211,153,0.2)] bg-[rgba(7,33,25,0.82)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--success)]"
                  >
                    Approve cutover
                  </button>
                </form>
                <form action={recordShopCheckpointAction}>
                  <input type="hidden" name="shopId" value={row.shop} />
                  <input type="hidden" name="shop" value={row.shop_name} />
                  <input
                    type="hidden"
                    name="decision"
                    value="hold_for_monitoring"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-[14px] border border-[rgba(250,204,21,0.18)] bg-[rgba(38,30,7,0.82)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#facc15]"
                  >
                    Hold monitoring
                  </button>
                </form>
                <form action={recordShopCheckpointAction}>
                  <input type="hidden" name="shopId" value={row.shop} />
                  <input type="hidden" name="shop" value={row.shop_name} />
                  <input
                    type="hidden"
                    name="decision"
                    value="rollback_escalated"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-[14px] border border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.82)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--warning)]"
                  >
                    Escalate rollback
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
