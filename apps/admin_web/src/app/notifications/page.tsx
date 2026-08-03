import { NotificationsFeed } from "@/components/notifications-feed";
import { AppLayout } from "@/components/app-layout";
import { getSafeSession } from "@/lib/session-helper";

export const metadata = {
  title: "Notifications & System Alerts | Business Hub",
  description: "Stock warnings, payment settlements, staff shift alerts, and daily summaries",
};

export default async function NotificationsPage() {
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
              Activity Alerts & Notifications
            </h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              Real-time events: stock shortages, high-value orders, payment collections, and security updates
            </p>
          </div>
        </div>

        <NotificationsFeed />
      </div>
    </AppLayout>
  );
}
