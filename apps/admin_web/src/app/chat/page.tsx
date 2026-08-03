import { TeamChat } from "@/components/team-chat";
import { AppLayout } from "@/components/app-layout";
import { getSafeSession } from "@/lib/session-helper";

export const metadata = {
  title: "Team Chat & Channels | Business Hub",
  description: "Internal team communication, store alerts, cashier handover notes",
};

export default async function ChatPage() {
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
              Team Communication & Shift Notes
            </h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              Store channels, cashier handover logs, urgent restocking alerts & manager direct messages
            </p>
          </div>
        </div>

        <TeamChat currentUserName={user?.full_name || "Manager"} />
      </div>
    </AppLayout>
  );
}
