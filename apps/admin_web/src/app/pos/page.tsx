import { PosTerminal } from "@/components/pos-terminal";
import { AdminShell } from "@/components/admin-shell";
import { getSession, resolveActiveShop, getInventory, getCustomers } from "@/lib/admin-api";
import type { InventoryItem, Customer } from "@/lib/types";

export const metadata = {
  title: "POS Terminal | Business Hub",
  description: "High-speed retail point of sale and billing terminal",
};

export default async function PosPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const shopId = activeShop?.shop.id || "";

  let inventory: InventoryItem[] = [];
  let customers: Customer[] = [];
  let errorMsg = "";

  if (shopId) {
    try {
      const [resInventory, resCustomers] = await Promise.all([
        getInventory(shopId),
        getCustomers(shopId),
      ]);
      inventory = resInventory;
      customers = resCustomers;
    } catch (err: any) {
      errorMsg = err.message || "Failed to load POS data from backend";
      console.error("PosPage fetch error:", err);
    }
  }

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="pos"
      title="Retail POS Terminal"
      subtitle="Fast barcode scanning, dynamic GST calculation, split tender & instant thermal printing"
    >
      {!shopId ? (
        <div className="panel p-8 text-center text-[var(--text-secondary)]">
          <p className="font-semibold text-lg text-text-primary mb-2">No Active Shop</p>
          <p className="text-sm">Please select or create a shop first to load the POS billing terminal.</p>
        </div>
      ) : errorMsg ? (
        <div className="panel p-8 border-red-500/20 bg-red-500/5 rounded-xl">
          <p className="text-red-400 font-semibold text-lg mb-2">Backend Connection Error</p>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Next.js Server Component failed to fetch catalog data from the Django backend.
          </p>
          <pre className="text-xs text-red-300 font-mono bg-black/40 p-4 rounded overflow-x-auto max-w-full text-left whitespace-pre-wrap">
            {errorMsg}
          </pre>
        </div>
      ) : (
        <PosTerminal
          shopName={activeShop?.shop.name || "Business Hub Store"}
          cashierName={session.user.full_name || "Cashier #1"}
          initialInventory={inventory}
          initialCustomers={customers}
          shopId={shopId}
        />
      )}
    </AdminShell>
  );
}
