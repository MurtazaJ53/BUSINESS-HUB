import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { ExpenseTable } from "@/components/expense-table";
import { MetricCard } from "@/components/metric-card";
import {
  buildExpenseStats,
  getExpenses,
  getSession,
  resolveActiveShop,
} from "@/lib/admin-api";
import { formatCurrency } from "@/lib/formatters";

export default async function ExpensesPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const expenses = activeShop ? await getExpenses(activeShop.shop.id) : [];
  const stats = buildExpenseStats(expenses);
  const topExpenses = [...expenses]
    .sort((left, right) => Number(right.amount) - Number(left.amount))
    .slice(0, 6);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="expenses"
      title="Expenses overview"
      subtitle="Track outgoing spend, review payment methods, and keep daily business costs easy to understand."
    >
      {!activeShop ? (
        <EmptyState
          title="No expense workspace available"
          body="This web workspace needs an active shop membership before it can show expense activity for a store."
        />
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Expense entries"
              value={stats.totalEntries.toString()}
              detail="Outgoing spend records currently visible in this store"
              icon="EXP"
            />
            <MetricCard
              label="Total spend"
              value={formatCurrency(stats.totalAmount, activeShop.shop.currency_code)}
              detail="Total outgoing amount across recorded expense entries"
              accent="rose"
              icon="TOT"
            />
            <MetricCard
              label="Categories tracked"
              value={stats.uniqueCategories.toString()}
              detail="Different expense buckets used by this store"
              accent="blue"
              icon="CAT"
            />
            <MetricCard
              label="Top category"
              value={stats.biggestCategory ?? "None yet"}
              detail="Largest spend bucket in the current view"
              accent="green"
              icon="TOP"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
            <div className="panel-soft rounded-[28px] px-6 py-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="eyebrow">Expense list</p>
                  <h2 className="mt-3 text-2xl font-bold">Recent outgoing spend</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Use this page to review store expenses, payment methods, and references
                    without dropping into a finance-heavy ledger.
                  </p>
                </div>
                <div className="rounded-[18px] border border-[rgba(152,164,189,0.12)] bg-[rgba(13,18,28,0.68)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  Shop
                  <div className="mt-1 text-base font-semibold text-[var(--text-primary)]">
                    {activeShop.shop.name}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <ExpenseTable
                  expenses={expenses}
                  currencyCode={activeShop.shop.currency_code}
                />
              </div>
            </div>

            <div className="space-y-6">
              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Spend watch</p>
                <h2 className="mt-3 text-2xl font-bold">Largest recent outflows</h2>
                <div className="mt-5 space-y-3">
                  {topExpenses.length ? (
                    topExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="surface-muted flex items-center justify-between rounded-[20px] px-4 py-4"
                      >
                        <div>
                          <p className="font-semibold">{expense.category}</p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {expense.expense_date + " | " + expense.payment_method}
                          </p>
                        </div>
                        <span className="rounded-full border border-[rgba(255,138,106,0.18)] px-3 py-1 text-sm font-semibold text-[var(--warning)]">
                          {formatCurrency(Number(expense.amount || 0), activeShop.shop.currency_code)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      No expense activity is available for this store yet.
                    </p>
                  )}
                </div>
              </section>

              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Use this page for</p>
                <h2 className="mt-3 text-2xl font-bold">Practical cost review</h2>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                  <li>- Review what the store is spending money on right now.</li>
                  <li>- Compare the biggest outflows without opening technical reports.</li>
                  <li>- Keep daily operating costs visible for managers and owners.</li>
                </ul>
              </section>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
