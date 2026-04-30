import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { ExpenseTable } from "@/components/expense-table";
import { MetricCard } from "@/components/metric-card";
import { buildExpenseStats, getExpenses, getSession, resolveActiveShop } from "@/lib/admin-api";
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
      title="Expense Ledger"
      subtitle="Phase 1 expense control backed by Django. This creates the first clean operational ledger for outgoing spend, payment methods, and shop-level expense review."
    >
      {!activeShop ? (
        <EmptyState
          title="No expense scope available"
          body="The admin shell needs an active shop membership before it can query expenses. Once your workspace is bootstrapped, this screen will hydrate from the Django expense APIs."
        />
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Expense entries"
              value={stats.totalEntries.toString()}
              detail="Outgoing spend entries recorded in this shop"
              icon="EXP"
            />
            <MetricCard
              label="Total outgoing spend"
              value={formatCurrency(stats.totalAmount, activeShop.shop.currency_code)}
              detail="Summed from the current phase 1 expense dataset"
              accent="rose"
              icon="TOT"
            />
            <MetricCard
              label="Tracked categories"
              value={stats.uniqueCategories.toString()}
              detail="Distinct expense categories in the current ledger"
              accent="blue"
              icon="CAT"
            />
            <MetricCard
              label="Top category"
              value={stats.biggestCategory ?? "—"}
              detail="Largest spend bucket from the current view"
              accent="green"
              icon="TOP"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
            <div className="panel-soft rounded-[28px] px-6 py-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="eyebrow">Expense dataset</p>
                  <h2 className="mt-3 text-2xl font-bold">Live backend results</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    This screen is reading
                    {" "}
                    <code>/api/v1/shops/{activeShop.shop.id}/expenses/</code>
                    {" "}
                    from the new Django phase 1 backend.
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
                <ExpenseTable expenses={expenses} currencyCode={activeShop.shop.currency_code} />
              </div>
            </div>

            <div className="space-y-6">
              <div className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Biggest spends</p>
                <h2 className="mt-3 text-2xl font-bold">Largest recent outflows</h2>
                <div className="mt-5 space-y-3">
                  {topExpenses.length ? (
                    topExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between rounded-[20px] border border-[rgba(251,113,133,0.12)] bg-[rgba(34,10,18,0.68)] px-4 py-4"
                      >
                        <div>
                          <p className="font-semibold">{expense.category}</p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {expense.expense_date} · {expense.payment_method}
                          </p>
                        </div>
                        <span className="rounded-full border border-[rgba(251,113,133,0.16)] px-3 py-1 text-sm font-semibold text-[var(--warning)]">
                          {formatCurrency(Number(expense.amount || 0), activeShop.shop.currency_code)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      No expenses available yet in the current preview.
                    </p>
                  )}
                </div>
              </div>

              <div className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Expense bridge note</p>
                <h2 className="mt-3 text-2xl font-bold">Why this slice matters</h2>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                  <li>• Expenses are now normalized per shop in the new backend.</li>
                  <li>• Payment methods and references have a typed contract instead of ad hoc JSON.</li>
                  <li>• This creates a clean base for attendance-linked payroll and reporting later.</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
