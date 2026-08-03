import { ExpensesManager } from "@/components/expenses-manager";
import { AdminShell } from "@/components/admin-shell";
import { getSession, resolveActiveShop } from "@/lib/admin-api";

export const metadata = {
  title: "Shop Expenses Manager | Business Hub",
  description: "Track store expenses, utility bills, inventory costs, and miscellaneous cash outflows",
};

export default async function ExpensesPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="expenses"
      title="Shop Expenses Manager"
      subtitle="Track store expenses, utility bills, inventory costs, and miscellaneous cash outflows"
    >
      <ExpensesManager />
    </AdminShell>
  );
}
