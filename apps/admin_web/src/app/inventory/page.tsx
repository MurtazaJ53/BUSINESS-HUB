import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { InventoryTable } from "@/components/inventory-table";
import { MetricCard } from "@/components/metric-card";
import { buildInventoryStats, getInventory, getSession, resolveActiveShop } from "@/lib/admin-api";
import { formatCurrency } from "@/lib/formatters";

export default async function InventoryPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const items = activeShop ? await getInventory(activeShop.shop.id) : [];
  const stats = buildInventoryStats(items);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="inventory"
      title="Inventory Ledger"
      subtitle="Current phase 1 inventory contract powered by Django. Search, filters, stock adjustment actions, and cost-aware access are the next backend-admin integration steps."
    >
      {!activeShop ? (
        <EmptyState
          title="No inventory scope available"
          body="The admin web shell needs an active shop membership before it can query inventory. Once memberships are available, this route will use the same backend contract as the command center."
        />
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Catalog size"
              value={stats.totalItems.toString()}
              detail={`${stats.categories} categories currently mapped`}
              icon="CAT"
            />
            <MetricCard
              label="In stock"
              value={(stats.totalItems - stats.outOfStockItems).toString()}
              detail="Items with stock still available to sell"
              accent="green"
              icon="AVL"
            />
            <MetricCard
              label="Critical low stock"
              value={stats.lowStockItems.toString()}
              detail="Needs replenishment planning or procurement follow-up"
              accent="rose"
              icon="LOW"
            />
            <MetricCard
              label="Projected sales value"
              value={formatCurrency(stats.projectedSellValue, activeShop.shop.currency_code)}
              detail="Useful as a phase 1 working inventory KPI"
              accent="blue"
              icon="VAL"
            />
          </section>

          <section className="panel-soft rounded-[28px] px-6 py-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="eyebrow">Inventory dataset</p>
                <h2 className="mt-3 text-2xl font-bold">Live backend results</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  This table is being resolved against
                  {" "}
                  <code>/api/v1/shops/{activeShop.shop.id}/inventory/</code>
                  {" "}
                  with dev bootstrap headers for phase 1 local development.
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
              <InventoryTable
                items={items}
                currencyCode={activeShop.shop.currency_code}
              />
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
