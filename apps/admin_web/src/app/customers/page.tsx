import { CustomersKhata } from "@/components/customers-khata";
import { AdminShell } from "@/components/admin-shell";
import { getSession, resolveActiveShop } from "@/lib/admin-api";

export const metadata = {
  title: "Customers & Khata Ledger | Business Hub",
  description: "Manage customer profiles, store credit, receivables, and payment reminders",
};

export default async function CustomersPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="customers"
      title="Customer CRM & Udhaar Khata"
      subtitle="Store credit ledger, balance reminders, customer loyalty, and repayment logging"
    >
      <CustomersKhata />
    </AdminShell>
  );
}
