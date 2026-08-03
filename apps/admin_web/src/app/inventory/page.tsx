import { InventoryManager } from "@/components/inventory-manager";
import { AdminShell } from "@/components/admin-shell";
import { getSession, resolveActiveShop } from "@/lib/admin-api";

export const metadata = {
  title: "Inventory Management | Business Hub",
  description: "Manage products, barcodes, stock levels, variants, and low-stock alerts",
};

export default async function InventoryPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="inventory"
      title="Inventory & Catalog"
      subtitle="Real-time stock valuation, barcode registry, low-stock threshold triggers & batch adjustments"
    >
      <InventoryManager />
    </AdminShell>
  );
}
