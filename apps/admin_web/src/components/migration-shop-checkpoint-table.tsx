import type { MigrationShopCheckpointEvent } from "@/lib/types";

type MigrationShopCheckpointTableProps = {
  events: MigrationShopCheckpointEvent[];
};

export function MigrationShopCheckpointTable({
  events,
}: MigrationShopCheckpointTableProps) {
  return (
    <div className="panel-soft overflow-hidden rounded-[28px]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
              <th className="px-5 py-4 font-medium">Shop</th>
              <th className="px-5 py-4 font-medium">Decision</th>
              <th className="px-5 py-4 font-medium">Scorecard snapshot</th>
              <th className="px-5 py-4 font-medium">Summary</th>
              <th className="px-5 py-4 font-medium">Actor / time</th>
            </tr>
          </thead>
          <tbody>
            {events.length ? (
              events.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-[rgba(152,164,189,0.08)] align-top"
                >
                  <td className="px-5 py-4">
                    <p className="text-base font-semibold">{event.shop_name}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {event.shop_slug}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-[var(--text-primary)]">
                    {event.decision}
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                    <p>{event.overall_status_snapshot}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {event.recommended_action_snapshot}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                    {event.summary}
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                    <p>{event.actor_name ?? "Unknown actor"}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {event.occurred_at}
                    </p>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]"
                >
                  No shop checkpoint decisions have been recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
