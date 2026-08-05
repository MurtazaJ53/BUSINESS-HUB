import { AdminShell } from "@/components/admin-shell";
import { SubscriptionBilling } from "@/components/subscription-billing";
import { getSession, resolveActiveShop } from "@/lib/admin-api";

export const metadata = {
  title: "Subscription & billing | Business Hub",
  description: "Your Business Hub Pro subscription, payments, and invoices",
};

export default async function BillingPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="billing"
      title="Subscription & billing"
      subtitle="What you are paying for, when it renews, and every past payment"
    >
      <SubscriptionBilling />
    </AdminShell>
  );
}
