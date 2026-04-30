import type { MigrationReconciliationEvent } from "@/lib/types";

type ReconciliationEventsTableProps = {
  events: MigrationReconciliationEvent[];
};

export function ReconciliationEventsTable({ events }: ReconciliationEventsTableProps) {
  return (
    <div className="panel-soft overflow-hidden rounded-[28px]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
              <th className="px-5 py-4 font-medium">Domain</th>
              <th className="px-5 py-4 font-medium">Issue</th>
              <th className="px-5 py-4 font-medium">Severity</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium">Source</th>
              <th className="px-5 py-4 font-medium">Entity</th>
            </tr>
          </thead>
          <tbody>
            {events.length ? (
              events.map((event) => (
                <tr key={event.id} className="border-b border-[rgba(152,164,189,0.08)] align-top">
                  <td className="px-5 py-4">
                    <p className="text-base font-semibold">{event.domain}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{event.shop_name}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">{event.issue_code}</td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">{event.severity}</td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">{event.status}</td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                    {event.observed_source || "—"} / {event.expected_master || "—"}
                  </td>
                  <td className="px-5 py-4 text-xs text-[var(--text-muted)]">
                    {event.entity_type}{event.entity_id ? `:${event.entity_id}` : ""}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
                  No reconciliation events returned from the Phase 2 API yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
