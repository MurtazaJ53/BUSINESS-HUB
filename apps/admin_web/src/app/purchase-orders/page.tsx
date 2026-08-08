import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { PurchaseOrders } from "@/components/purchase-orders";
import { getSession, resolveActiveShop } from "@/lib/admin-api";
import { canManageWorkspace } from "@/lib/roles";

export const metadata = {
  title: "Purchase Orders | Business Hub",
  description: "What you have ordered from suppliers and what has actually arrived",
};

export default async function PurchaseOrdersPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="purchase-orders"
      title="Purchase orders"
      subtitle="What you have on order, and what actually turned up."
    >
      {!activeShop ? (
        <EmptyState
          title="No shop membership found"
          body="This account is signed in, but there is no active shop membership yet."
        />
      ) : (
        // Ordering commits the shop's money, so the backend requires manager
        // level; staff can still see what is expected.
        <PurchaseOrders canOrder={canManageWorkspace(activeShop.role)} />
      )}
    </AdminShell>
  );
}
