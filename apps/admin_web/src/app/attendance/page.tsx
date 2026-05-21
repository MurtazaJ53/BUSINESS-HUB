import { AdminShell } from "@/components/admin-shell";
import { AttendanceTable } from "@/components/attendance-table";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import {
  buildAttendanceStats,
  getAttendanceSessions,
  getSession,
  resolveActiveShop,
} from "@/lib/admin-api";
import { canAccessAttendance } from "@/lib/plans";

function toToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export default async function AttendancePage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const canUseAttendance = canAccessAttendance(activeShop);
  const today = toToday();
  const sessions = activeShop && canUseAttendance
    ? await getAttendanceSessions(activeShop.shop.id, { dateFrom: today })
    : [];
  const stats = buildAttendanceStats(sessions, today);
  const todaySessions = sessions
    .filter((sessionItem) => sessionItem.session_date === today)
    .slice(0, 8);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="attendance"
      title="Attendance overview"
      subtitle="See who is on the floor today, review recent attendance, and keep staffing easy to understand."
    >
      {!activeShop ? (
        <EmptyState
          title="No attendance workspace available"
          body="This web workspace needs an active shop membership before it can show attendance sessions for a store."
        />
      ) : !canUseAttendance ? (
        <EmptyState
          title="Attendance unlocks on Growth and Pro"
          body="This workspace is on a lighter plan, so staffing visibility stays hidden here. Upgrade the shop plan when you want attendance tools inside Business Hub."
        />
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Sessions tracked"
              value={stats.totalSessions.toString()}
              detail="Attendance records currently visible in the selected window"
              icon="ATT"
            />
            <MetricCard
              label="Present records"
              value={stats.presentCount.toString()}
              detail="Sessions marked present in the current result set"
              accent="green"
              icon="PRS"
            />
            <MetricCard
              label="Leave records"
              value={stats.leaveCount.toString()}
              detail="Sessions marked leave in the current result set"
              accent="rose"
              icon="LEV"
            />
            <MetricCard
              label="On floor today"
              value={stats.activeWorkersToday.toString()}
              detail="Present or half-day memberships for today"
              accent="blue"
              icon="DAY"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
            <div className="panel-soft rounded-[28px] px-6 py-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="eyebrow">Attendance list</p>
                  <h2 className="mt-3 text-2xl font-bold">Recent attendance</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Use this page to review who clocked in, who finished a shift, and who is
                    absent today.
                  </p>
                </div>
                <div className="rounded-[18px] border border-[rgba(152,164,189,0.12)] bg-[rgba(13,18,28,0.68)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  Window
                  <div className="mt-1 text-base font-semibold text-[var(--text-primary)]">
                    From {today}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <AttendanceTable sessions={sessions} />
              </div>
            </div>

            <div className="space-y-6">
              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Today on the floor</p>
                <h2 className="mt-3 text-2xl font-bold">Current shift snapshot</h2>
                <div className="mt-5 space-y-3">
                  {todaySessions.length ? (
                    todaySessions.map((sessionItem) => (
                      <div
                        key={sessionItem.id}
                        className="surface-muted flex items-center justify-between rounded-[20px] px-4 py-4"
                      >
                        <div>
                          <p className="font-semibold">{sessionItem.member_name}</p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {sessionItem.status + " | " + (sessionItem.clock_in_at || "No clock-in")}
                          </p>
                        </div>
                        <span className="rounded-full border border-[rgba(71,176,255,0.16)] px-3 py-1 text-sm font-semibold text-[var(--accent)]">
                          {sessionItem.clock_out_at ? "Closed" : "Active"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      No attendance sessions are recorded for today yet.
                    </p>
                  )}
                </div>
              </section>

              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Use this page for</p>
                <h2 className="mt-3 text-2xl font-bold">Simple staffing review</h2>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                  <li>- Confirm who is active on the floor today.</li>
                  <li>- Review absence and leave without opening a separate staff system.</li>
                  <li>- Keep attendance visibility practical for managers and owners.</li>
                </ul>
              </section>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
