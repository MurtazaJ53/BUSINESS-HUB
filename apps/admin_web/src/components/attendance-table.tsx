import { formatRole } from "@/lib/formatters";
import type { AttendanceSession } from "@/lib/types";

type AttendanceTableProps = {
  sessions: AttendanceSession[];
};

export function AttendanceTable({ sessions }: AttendanceTableProps) {
  return (
    <div className="panel-soft overflow-hidden rounded-[28px]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
              <th className="px-5 py-4 font-medium">Operator</th>
              <th className="px-5 py-4 font-medium">Date</th>
              <th className="px-5 py-4 font-medium">Clock in</th>
              <th className="px-5 py-4 font-medium">Clock out</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium">Hours</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length ? (
              sessions.map((session) => {
                const tone =
                  session.status === "PRESENT"
                    ? "text-[var(--success)]"
                    : session.status === "HALF_DAY"
                      ? "text-[var(--accent)]"
                      : session.status === "LEAVE"
                        ? "text-[var(--warning)]"
                        : "text-[var(--text-secondary)]";

                return (
                  <tr key={session.id} className="border-b border-[rgba(152,164,189,0.08)] align-top">
                    <td className="px-5 py-4">
                      <p className="text-base font-semibold">{session.member_name}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {formatRole(session.member_role)}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                      {session.session_date}
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                      {session.clock_in_at || "No clock-in"}
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                      {session.clock_out_at || "Not closed"}
                    </td>
                    <td className={`px-5 py-4 text-sm font-semibold ${tone}`}>
                      {session.status}
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--text-primary)]">
                      {session.total_hours || "Not logged"}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]"
                >
                  No attendance sessions are available for this store yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
