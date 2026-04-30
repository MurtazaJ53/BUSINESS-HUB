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
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
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
