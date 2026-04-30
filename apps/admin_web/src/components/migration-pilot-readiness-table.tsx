import {
  promotePrimaryAction,
  promoteReadyAction,
  rollbackPilotAction,
} from "@/app/migration/actions";
import type { MigrationPilotReadiness } from "@/lib/types";

type MigrationPilotReadinessTableProps = {
  readiness: MigrationPilotReadiness[];
};

export function MigrationPilotReadinessTable({
  readiness,
}: MigrationPilotReadinessTableProps) {
  return (
    <div className="panel-soft overflow-hidden rounded-[28px]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
              <th className="px-5 py-4 font-medium">Shop / Domain</th>
              <th className="px-5 py-4 font-medium">Pilot status</th>
              <th className="px-5 py-4 font-medium">Compare</th>
              <th className="px-5 py-4 font-medium">Open issues</th>
              <th className="px-5 py-4 font-medium">Next state</th>
              <th className="px-5 py-4 font-medium">Blockers</th>
              <th className="px-5 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {readiness.length ? (
              readiness.map((row) => (
                <tr key={row.control_id} className="border-b border-[rgba(152,164,189,0.08)] align-top">
                  <td className="px-5 py-4">
                    <p className="text-base font-semibold">{row.domain}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {row.shop_name} / {row.shop_slug}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm">
                    <p className={row.ready_for_pilot ? "font-semibold text-[var(--success)]" : "font-semibold text-[var(--warning)]"}>
                      {row.ready_for_pilot ? "Ready for pilot" : "Blocked"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {row.cutover_status} / {row.write_master}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                    <p>{row.latest_compare_status || "No compare yet"}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {row.latest_compare_mismatches} mismatches
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                    <p>{row.open_events} open</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {row.open_critical_events} critical / {row.open_stale_epoch_events} stale epoch
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-[var(--accent)]">
                    {row.recommended_next_status}
                  </td>
                  <td className="px-5 py-4 text-xs text-[var(--text-muted)]">
                    {row.blocking_reasons.length ? (
                      <ul className="space-y-1">
                        {row.blocking_reasons.slice(0, 3).map((reason) => (
                          <li key={reason}>• {reason}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-[var(--success)]">No blockers</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-2">
                      {row.ready_for_pilot && row.recommended_next_status === "ready" ? (
                        <form action={promoteReadyAction}>
                          <input type="hidden" name="controlId" value={row.control_id} />
                          <input type="hidden" name="domain" value={row.domain} />
                          <input type="hidden" name="shop" value={row.shop_name} />
                          <button
                            type="submit"
                            className="w-full rounded-[14px] border border-[rgba(92,174,254,0.18)] bg-[rgba(9,18,34,0.82)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]"
                          >
                            Promote ready
                          </button>
                        </form>
                      ) : null}
                      {row.ready_for_pilot && row.recommended_next_status === "postgres_primary" ? (
                        <form action={promotePrimaryAction}>
                          <input type="hidden" name="controlId" value={row.control_id} />
                          <input type="hidden" name="domain" value={row.domain} />
                          <input type="hidden" name="shop" value={row.shop_name} />
                          <button
                            type="submit"
                            className="w-full rounded-[14px] border border-[rgba(52,211,153,0.2)] bg-[rgba(7,33,25,0.82)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--success)]"
                          >
                            Promote primary
                          </button>
                        </form>
                      ) : null}
                      {row.cutover_status === "ready" || row.cutover_status === "postgres_primary" ? (
                        <form action={rollbackPilotAction}>
                          <input type="hidden" name="controlId" value={row.control_id} />
                          <input type="hidden" name="domain" value={row.domain} />
                          <input type="hidden" name="shop" value={row.shop_name} />
                          <button
                            type="submit"
                            className="w-full rounded-[14px] border border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.82)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--warning)]"
                          >
                            Rollback
                          </button>
                        </form>
                      ) : null}
                      {!row.ready_for_pilot && row.cutover_status !== "ready" && row.cutover_status !== "postgres_primary" ? (
                        <span className="text-xs text-[var(--text-muted)]">Clear blockers to unlock actions</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
                  No pilot readiness records returned from the Phase 3 API yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
