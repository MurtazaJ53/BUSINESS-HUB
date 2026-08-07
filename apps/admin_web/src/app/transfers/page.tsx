import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { TransferManager } from "@/components/transfer-manager";
import { getSession, resolveActiveShop } from "@/lib/admin-api";
import { canManageWorkspace } from "@/lib/roles";

export const metadata = {
  title: "Stock Transfers | Business Hub",
  description: "Move stock between your shops and track what is in transit",
};

export default async function TransfersPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="transfers"
      title="Stock transfers"
      subtitle="Move stock between your shops. Nothing arrives until the receiving shop confirms it."
    >
      {!activeShop ? (
        <EmptyState
          title="No shop membership found"
          body="This account is signed in, but there is no active shop membership yet."
        />
      ) : (
        <TransferManager
          activeShopId={activeShop.shop.id}
          memberships={session.memberships}
          // Moving stock changes what two shops are worth, so the backend
          // requires manager level. Reflecting that here keeps staff from
          // pressing a button that can only fail.
          canMove={canManageWorkspace(activeShop.role)}
        />
      )}
    </AdminShell>
  );
}
