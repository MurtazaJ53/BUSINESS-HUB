import { PosTerminal } from "@/components/pos-terminal";
import { AdminShell } from "@/components/admin-shell";
import { getSession, resolveActiveShop } from "@/lib/admin-api";

export const metadata = {
  title: "POS Terminal | Business Hub",
  description: "High-speed retail point of sale and billing terminal",
};

export default async function PosPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="pos"
      title="Retail POS Terminal"
      subtitle="Fast barcode scanning, dynamic GST calculation, split tender & instant thermal printing"
    >
      <PosTerminal
        shopName={activeShop?.shop.name || "Business Hub Store"}
        cashierName={session.user.full_name || "Cashier #1"}
      />
    </AdminShell>
  );
}
