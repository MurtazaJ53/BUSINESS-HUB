import type { MigrationControlEvent } from "@/lib/types";

type MigrationActivityTableProps = {
  events: MigrationControlEvent[];
};

function getResultTone(result: string) {
  switch (result) {
    case "succeeded":
    case "production_safe":
      return "text-[var(--success)]";
    case "rollback_recommended":
    case "blocked":
      return "text-[var(--warning)]";
    default:
      return "text-[var(--accent)]";
  }
}

export function MigrationActivityTable({
  events,
}: MigrationActivityTableProps) {
  return (
    <div className="panel-soft overflow-hidden rounded-[28px]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
              <th className="px-5 py-4 font-medium">Domain</th>
              <th className="px-5 py-4 font-medium">Event</th>
              <th className="px-5 py-4 font-medium">Result</th>
              <th className="px-5 py-4 font-medium">Transition</th>
              <th className="px-5 py-4 font-medium">Operator</th>
              <th className="px-5 py-4 font-medium">Summary</th>
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
                    <p className="text-base font-semibold">{event.domain}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {event.shop_name}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                    {event.event_type}
                  </td>
                  <td className="px-5 py-4">
                    <p
                      className={`text-sm font-semibold uppercase tracking-[0.16em] ${getResultTone(
                        event.result,
                      )}`}
                    >
                      {event.result || "none"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {event.occurred_at}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-xs text-[var(--text-muted)]">
                    <p>
                      {event.from_cutover_status || "-"} -&gt;{" "}
                      {event.to_cutover_status || "-"}
                    </p>
                    <p className="mt-1">
                      {event.from_write_master || "-"} -&gt;{" "}
                      {event.to_write_master || "-"}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                    {event.actor_name || "System"}
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                    {event.summary}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]"
                >
                  No pilot activity events recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
