import { NotificationsFeed } from "@/components/notifications-feed";
import { AdminShell } from "@/components/admin-shell";
import { getSession, resolveActiveShop } from "@/lib/admin-api";

export const metadata = {
  title: "Notifications & System Alerts | Business Hub",
  description: "Stock warnings, payment settlements, staff shift alerts, and daily summaries",
};

export default async function NotificationsPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="notifications"
      title="Activity Alerts & Notifications"
      subtitle="Real-time events: stock shortages, high-value orders, payment collections, and security updates"
    >
      <NotificationsFeed />
    </AdminShell>
  );
}
