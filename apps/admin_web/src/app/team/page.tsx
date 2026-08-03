import { TeamAttendance } from "@/components/team-attendance";
import { AdminShell } from "@/components/admin-shell";
import { getSession, resolveActiveShop } from "@/lib/admin-api";

export const metadata = {
  title: "Team & Staff Management | Business Hub",
  description: "Manage staff roles, cashier permissions, shift rosters, and attendance",
};

export default async function TeamPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="team"
      title="Team Roster & Staff Permissions"
      subtitle="Role-based access control, cashier invites, salary tracking, and active shift monitoring"
    >
      <TeamAttendance />
    </AdminShell>
  );
}
