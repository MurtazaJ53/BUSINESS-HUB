import { TeamChat } from "@/components/team-chat";
import { AdminShell } from "@/components/admin-shell";
import { getSession, resolveActiveShop } from "@/lib/admin-api";

export const metadata = {
  title: "Team Chat & Channels | Business Hub",
  description: "Internal team communication, store alerts, cashier handover notes",
};

export default async function ChatPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="chat"
      title="Team Communication & Shift Notes"
      subtitle="Store channels, cashier handover logs, urgent restocking alerts & manager direct messages"
    >
      <TeamChat currentUserName={session.user.full_name || "Manager"} />
    </AdminShell>
  );
}
