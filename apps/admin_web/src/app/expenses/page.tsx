import { ExpensesManager } from "@/components/expenses-manager";
import { AdminShell } from "@/components/admin-shell";
import { getSession, resolveActiveShop, getExpenses, getExpenseSummary } from "@/lib/admin-api";
import type { Expense, ExpenseSummaryPayload } from "@/lib/types";

export const metadata = {
  title: "Shop Expenses Manager | Business Hub",
  description: "Track store expenses, utility bills, inventory costs, and miscellaneous cash outflows",
};

export default async function ExpensesPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const shopId = activeShop?.shop.id || "";

  let expenses: Expense[] = [];
  let summary: ExpenseSummaryPayload = {
    total_entries: 0,
    total_amount: "0.00",
    unique_categories: 0,
    biggest_category: null,
  };
  let errorMsg = "";

  if (shopId) {
    try {
      const [resExpenses, resSummary] = await Promise.all([
        getExpenses(shopId),
        getExpenseSummary(shopId),
      ]);
      expenses = resExpenses;
      summary = resSummary;
    } catch (err: any) {
      errorMsg = err.message || "Failed to load expenses data from backend";
      console.error("ExpensesPage fetch error:", err);
    }
  }

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="expenses"
      title="Shop Expenses Manager"
      subtitle="Track store expenses, utility bills, inventory costs, and miscellaneous cash outflows"
    >
      {!shopId ? (
        <div className="panel p-8 text-center text-[var(--text-secondary)]">
          <p className="font-semibold text-lg text-text-primary mb-2">No Active Shop</p>
          <p className="text-sm">Please select or create a shop first to view and manage expenses.</p>
        </div>
      ) : errorMsg ? (
        <div className="panel p-8 border-red-500/20 bg-red-500/5 rounded-xl">
          <p className="text-red-400 font-semibold text-lg mb-2">Backend Connection Error</p>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Next.js Server Component failed to fetch data from the Django backend.
          </p>
          <pre className="text-xs text-red-300 font-mono bg-black/40 p-4 rounded overflow-x-auto max-w-full text-left whitespace-pre-wrap">
            {errorMsg}
          </pre>
        </div>
      ) : (
        <ExpensesManager initialExpenses={expenses} initialSummary={summary} shopId={shopId} />
      )}
    </AdminShell>
  );
}
