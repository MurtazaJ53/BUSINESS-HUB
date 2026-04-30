import type { MigrationShadowSummary } from "@/lib/types";

type MigrationShadowSummariesTableProps = {
  summaries: MigrationShadowSummary[];
};

export function MigrationShadowSummariesTable({
  summaries,
}: MigrationShadowSummariesTableProps) {
  return (
    <div className="panel-soft overflow-hidden rounded-[28px]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
              <th className="px-5 py-4 font-medium">Shop / Domain</th>
              <th className="px-5 py-4 font-medium">Latest compare</th>
              <th className="px-5 py-4 font-medium">Mismatches</th>
              <th className="px-5 py-4 font-medium">Open events</th>
              <th className="px-5 py-4 font-medium">Bridge</th>
              <th className="px-5 py-4 font-medium">Epoch</th>
            </tr>
          </thead>
          <tbody>
            {summaries.length ? (
              summaries.map((summary) => (
                <tr key={`${summary.shop}:${summary.domain}`} className="border-b border-[rgba(152,164,189,0.08)] align-top">
                  <td className="px-5 py-4">
                    <p className="text-base font-semibold">{summary.domain}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {summary.shop_name} / {summary.shop_slug}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                    <p>{summary.latest_compare_status || "No compare yet"}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{summary.latest_compare_at || "—"}</p>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-[var(--warning)]">
                    {summary.latest_compare_mismatches}
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                    <p>{summary.open_events} total</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {summary.open_critical_events} critical / {summary.open_stale_epoch_events} stale epoch
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                    {summary.write_master} / {summary.bridge_mode}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-[var(--accent)]">{summary.current_epoch}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
                  No shadow verification summaries returned from the Phase 2 API yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
