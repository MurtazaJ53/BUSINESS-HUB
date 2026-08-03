import { TeamAttendance } from "@/components/team-attendance";
import { AdminShell } from "@/components/admin-shell";
import { getSession, resolveActiveShop } from "@/lib/admin-api";

export const metadata = {
  title: "Staff Attendance & Timesheet | Business Hub",
  description: "Track staff shifts, check-in timestamps, working hours, and leave records",
};

export default async function AttendancePage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="attendance"
      title="Shift Attendance & Punch Logs"
      subtitle="Daily staff check-in, overtime logs, attendance calendar, and timesheet reports"
    >
      <TeamAttendance />
    </AdminShell>
  );
}
