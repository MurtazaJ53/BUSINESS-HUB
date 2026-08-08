import { SuppliersPurchases } from "@/components/suppliers-purchases";
import { AdminShell } from "@/components/admin-shell";
import { getSession, resolveActiveShop } from "@/lib/admin-api";

export const metadata = {
  title: "Inward Stock & Purchases | Business Hub",
  description: "Record inward stock orders, purchase bills, and vendor payments",
};

export default async function PurchasesPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="purchases"
      title="Inward Purchase Bills & Stock In"
      subtitle="Supplier invoices, item stock increments, cost tracking, and credit payments"
    >
      <SuppliersPurchases initialTab="purchases" />
    </AdminShell>
  );
}
