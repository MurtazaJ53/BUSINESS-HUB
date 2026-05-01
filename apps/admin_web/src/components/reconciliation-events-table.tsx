import {
  acknowledgeReconciliationAction,
  reopenReconciliationAction,
  resolveReconciliationAction,
} from "@/app/migration/actions";
import type { MigrationReconciliationEvent } from "@/lib/types";

type ReconciliationEventsTableProps = {
  events: MigrationReconciliationEvent[];
};

function getSeverityTone(severity: MigrationReconciliationEvent["severity"]) {
  switch (severity) {
    case "critical":
      return "text-[var(--warning)]";
    case "warning":
      return "text-[var(--accent)]";
    default:
      return "text-[var(--text-secondary)]";
  }
}

function getStatusTone(status: MigrationReconciliationEvent["status"]) {
  switch (status) {
    case "resolved":
      return "text-[var(--success)]";
    case "ignored":
      return "text-[var(--text-muted)]";
    case "acknowledged":
      return "text-[var(--accent)]";
    default:
      return "text-[var(--warning)]";
  }
}

export function ReconciliationEventsTable({
  events,
}: ReconciliationEventsTableProps) {
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
              <th className="px-5 py-4 font-medium">Actions</th>
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
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {event.issue_code}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {event.note || "No operator note attached yet."}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p
                      className={`text-sm font-semibold uppercase tracking-[0.16em] ${getSeverityTone(
                        event.severity,
                      )}`}
                    >
                      {event.severity}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p
                      className={`text-sm font-semibold uppercase tracking-[0.16em] ${getStatusTone(
                        event.status,
                      )}`}
                    >
                      {event.status}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {event.resolver_name
                        ? `Last touched by ${event.resolver_name}`
                        : "Awaiting operator action"}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                    <p>{event.observed_source || "-"}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      expected {event.expected_master || "-"}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-xs text-[var(--text-muted)]">
                    {event.entity_type || "-"}
                    {event.entity_id ? `:${event.entity_id}` : ""}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-2">
                      {event.status === "open" ? (
                        <form action={acknowledgeReconciliationAction}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="domain" value={event.domain} />
                          <input type="hidden" name="shop" value={event.shop_name} />
                          <input
                            type="hidden"
                            name="issue"
                            value={event.issue_code}
                          />
                          <button
                            type="submit"
                            className="w-full rounded-[14px] border border-[rgba(92,174,254,0.18)] bg-[rgba(9,18,34,0.82)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]"
                          >
                            Acknowledge
                          </button>
                        </form>
                      ) : null}

                      {(event.status === "open" ||
                        event.status === "acknowledged") ? (
                        <form action={resolveReconciliationAction}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="domain" value={event.domain} />
                          <input type="hidden" name="shop" value={event.shop_name} />
                          <input
                            type="hidden"
                            name="issue"
                            value={event.issue_code}
                          />
                          <button
                            type="submit"
                            className="w-full rounded-[14px] border border-[rgba(52,211,153,0.2)] bg-[rgba(7,33,25,0.82)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--success)]"
                          >
                            Resolve
                          </button>
                        </form>
                      ) : null}

                      {(event.status === "resolved" ||
                        event.status === "ignored") ? (
                        <form action={reopenReconciliationAction}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="domain" value={event.domain} />
                          <input type="hidden" name="shop" value={event.shop_name} />
                          <input
                            type="hidden"
                            name="issue"
                            value={event.issue_code}
                          />
                          <button
                            type="submit"
                            className="w-full rounded-[14px] border border-[rgba(152,164,189,0.12)] bg-[rgba(11,16,26,0.82)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]"
                          >
                            Reopen
                          </button>
                        </form>
                      ) : null}

                      {event.resolved_at ? (
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {event.resolved_at}
                        </p>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]"
                >
                  No reconciliation events returned from the migration API yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
