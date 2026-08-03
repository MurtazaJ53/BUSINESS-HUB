import { TeamAttendance } from "@/components/team-attendance";
import { AppLayout } from "@/components/app-layout";
import { getSafeSession } from "@/lib/session-helper";

export const metadata = {
  title: "Team & Staff Management | Business Hub",
  description: "Manage staff roles, cashier permissions, shift rosters, and attendance",
};

export default async function TeamPage() {
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
              Team Roster & Staff Permissions
            </h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              Role-based access control, cashier invites, salary tracking, and active shift monitoring
            </p>
          </div>
        </div>

        <TeamAttendance />
      </div>
    </AppLayout>
  );
}
