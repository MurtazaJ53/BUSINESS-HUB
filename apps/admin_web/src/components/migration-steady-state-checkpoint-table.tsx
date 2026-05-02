import type { MigrationSteadyStateCheckpointEvent } from "@/lib/types";

type MigrationSteadyStateCheckpointTableProps = {
  events: MigrationSteadyStateCheckpointEvent[];
};

function formatDecision(decision: MigrationSteadyStateCheckpointEvent["decision"]) {
  return decision.replaceAll("_", " ");
}

export function MigrationSteadyStateCheckpointTable({
  events,
}: MigrationSteadyStateCheckpointTableProps) {
  if (!events.length) {
    return (
      <div className="rounded-[20px] border border-dashed border-[rgba(152,164,189,0.18)] px-5 py-6 text-sm text-[var(--text-secondary)]">
        No steady-state governance decisions have been recorded yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[20px] border border-[rgba(152,164,189,0.12)]">
      <table className="min-w-full divide-y divide-[rgba(152,164,189,0.08)] text-left text-sm">
        <thead className="bg-[rgba(8,11,18,0.82)] text-[var(--text-muted)]">
          <tr>
            <th className="px-4 py-3 font-medium">Phase</th>
            <th className="px-4 py-3 font-medium">Decision</th>
            <th className="px-4 py-3 font-medium">Governance snapshot</th>
            <th className="px-4 py-3 font-medium">Actor</th>
            <th className="px-4 py-3 font-medium">Occurred at</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgba(152,164,189,0.08)] bg-[rgba(7,10,16,0.6)]">
          {events.map((event) => (
            <tr key={event.id}>
              <td className="px-4 py-3 align-top text-[var(--text-primary)]">
                {event.phase}
              </td>
              <td className="px-4 py-3 align-top">
                <p className="font-semibold capitalize text-[var(--text-primary)]">
                  {formatDecision(event.decision)}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {event.recommended_action_snapshot}
                </p>
              </td>
              <td className="px-4 py-3 align-top">
                <p className="font-semibold text-[var(--text-primary)]">
                  {event.overall_status_snapshot}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {event.summary}
                </p>
              </td>
              <td className="px-4 py-3 align-top text-[var(--text-secondary)]">
                {event.actor_name ?? "System"}
              </td>
              <td className="px-4 py-3 align-top text-[var(--text-secondary)]">
                {event.occurred_at}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
