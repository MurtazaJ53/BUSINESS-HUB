import { TeamAttendance } from "@/components/team-attendance";
import { AppLayout } from "@/components/app-layout";
import { getSafeSession } from "@/lib/session-helper";

export const metadata = {
  title: "Staff Attendance & Timesheet | Business Hub",
  description: "Track staff shifts, check-in timestamps, working hours, and leave records",
};

export default async function AttendancePage() {
  const { user, currentShopId, currentShopName, planTier, memberships } =
    await getSafeSession();

  return (
    <AppLayout
      user={user}
      currentShopId={currentShopId}
      currentShopName={currentShopName}
      planTier={planTier}
      memberships={memberships}
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Shift Attendance & Punch Logs
            </h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              Daily staff check-in, overtime logs, attendance calendar, and timesheet reports
            </p>
          </div>
        </div>

        <TeamAttendance />
      </div>
    </AppLayout>
  );
}
