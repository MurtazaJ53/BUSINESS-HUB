import { AdminShell } from "@/components/admin-shell";
import { AttendanceTable } from "@/components/attendance-table";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { buildAttendanceStats, getAttendanceSessions, getSession, resolveActiveShop } from "@/lib/admin-api";

function toToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export default async function AttendancePage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const today = toToday();
  const sessions = activeShop
    ? await getAttendanceSessions(activeShop.shop.id, { dateFrom: today })
    : [];
  const stats = buildAttendanceStats(sessions, today);
  const todaySessions = sessions.filter((sessionItem) => sessionItem.session_date === today).slice(0, 8);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="attendance"
      title="Attendance Grid"
      subtitle="Phase 1 attendance sessions mapped onto shop memberships. This gives the new backend a real operator presence layer without dragging a separate staff subsystem into the first cutover."
    >
      {!activeShop ? (
        <EmptyState
          title="No attendance scope available"
          body="The admin shell needs an active shop membership before it can query attendance sessions. Once your workspace is bootstrapped, this screen will hydrate from the Django attendance APIs."
        />
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Tracked sessions"
              value={stats.totalSessions.toString()}
              detail="Attendance sessions returned in the current range"
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
              label="On-floor today"
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
                  <p className="eyebrow">Attendance dataset</p>
                  <h2 className="mt-3 text-2xl font-bold">Live backend results</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    This screen is reading
                    {" "}
                    <code>/api/v1/shops/{activeShop.shop.id}/attendance/</code>
                    {" "}
                    for the active shop.
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
              <div className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Today’s floor view</p>
                <h2 className="mt-3 text-2xl font-bold">Current day snapshot</h2>
                <div className="mt-5 space-y-3">
                  {todaySessions.length ? (
                    todaySessions.map((sessionItem) => (
                      <div
                        key={sessionItem.id}
                        className="flex items-center justify-between rounded-[20px] border border-[rgba(92,174,254,0.12)] bg-[rgba(10,27,53,0.68)] px-4 py-4"
                      >
                        <div>
                          <p className="font-semibold">{sessionItem.member_name}</p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {sessionItem.status} · {sessionItem.clock_in_at || "No clock-in"}
                          </p>
                        </div>
                        <span className="rounded-full border border-[rgba(92,174,254,0.16)] px-3 py-1 text-sm font-semibold text-[var(--accent)]">
                          {sessionItem.clock_out_at ? "Closed" : "Active"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      No attendance sessions recorded for today yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Attendance bridge note</p>
                <h2 className="mt-3 text-2xl font-bold">Why this slice matters</h2>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                  <li>• Attendance is now anchored to real shop memberships in the new backend.</li>
                  <li>• Daily operator presence can be queried without relying on the old local-only cache.</li>
                  <li>• This creates the base for later payroll and attendance adjustment cutovers.</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
