import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { InventoryTable } from "@/components/inventory-table";
import { MetricCard } from "@/components/metric-card";
import {
  buildInventoryStats,
  getDashboardSnapshot,
  getInventory,
  getSession,
  resolveActiveShop,
} from "@/lib/admin-api";
import { formatCurrency } from "@/lib/formatters";

export default async function HomePage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const items = activeShop ? await getInventory(activeShop.shop.id) : [];
  const dashboardSnapshot = activeShop ? await getDashboardSnapshot(activeShop.shop.id) : null;
  const stats = buildInventoryStats(items);
  const lowStockPreview = dashboardSnapshot?.low_stock_preview ?? [];

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="overview"
      title="Shop Command Center"
      subtitle="Phase 2 command surface now reads KPI projections from PostgreSQL snapshots while the catalog table still validates the live inventory contract."
    >
      {!activeShop ? (
        <EmptyState
          title="No shop membership found"
          body="The backend session resolved your operator account, but there is no active shop membership yet. Bootstrap a shop membership in Django or through Firebase bootstrap to continue."
        />
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Inventory items"
              value={(dashboardSnapshot?.inventory_items_count ?? stats.totalItems).toString()}
              detail={`${
                dashboardSnapshot?.active_inventory_items_count ?? stats.activeItems
              } active products in ${
                dashboardSnapshot?.category_count ?? stats.categories
              } categories`}
              icon="INV"
            />
            <MetricCard
              label="Projected retail value"
              value={formatCurrency(
                Number(dashboardSnapshot?.projected_sell_value ?? stats.projectedSellValue),
                activeShop.shop.currency_code,
              )}
              detail="Served from the PostgreSQL projection refresh layer"
              accent="green"
              icon="VAL"
            />
            <MetricCard
              label="Low stock pressure"
              value={(dashboardSnapshot?.low_stock_items_count ?? stats.lowStockItems).toString()}
              detail="Items at five units or lower need restock review"
              accent="blue"
              icon="LST"
            />
            <MetricCard
              label="Out of stock"
              value={(dashboardSnapshot?.out_of_stock_items_count ?? stats.outOfStockItems).toString()}
              detail="Completely unavailable SKUs in the current shop scope"
              accent="rose"
              icon="OOS"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
            <div className="panel-soft rounded-[28px] px-6 py-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="eyebrow">Inventory live feed</p>
                  <h2 className="mt-3 text-2xl font-bold">Current catalog surface</h2>
                </div>
                <div className="rounded-[18px] border border-[rgba(92,174,254,0.16)] bg-[rgba(9,18,34,0.82)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  Shop slug
                  <div className="mt-1 text-base font-semibold text-[var(--accent)]">
                    {activeShop.shop.slug}
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <InventoryTable items={items.slice(0, 8)} currencyCode={activeShop.shop.currency_code} />
              </div>
            </div>

            <div className="space-y-6">
              <div className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Membership scope</p>
                <h2 className="mt-3 text-2xl font-bold">Workspace bindings</h2>
                <div className="mt-6 space-y-3">
                  {session.memberships.map((membership) => {
                    const isCurrent = membership.shop.id === activeShop.shop.id;
                    return (
                      <div
                        key={membership.id}
                        className={`rounded-[20px] border px-4 py-4 ${
                          isCurrent
                            ? "border-[rgba(92,174,254,0.2)] bg-[rgba(10,27,53,0.82)]"
                            : "border-[rgba(152,164,189,0.12)] bg-[rgba(13,18,28,0.68)]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-base font-semibold">{membership.shop.name}</p>
                            <p className="mt-1 text-sm text-[var(--text-secondary)]">
                              {membership.role} · {membership.status}
                            </p>
                          </div>
                          {isCurrent ? (
                            <span className="rounded-full border border-[rgba(92,174,254,0.2)] bg-[rgba(92,174,254,0.12)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
                              Active
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Restock watch</p>
                <h2 className="mt-3 text-2xl font-bold">Immediate low-stock review</h2>
                <div className="mt-5 space-y-3">
                  {lowStockPreview.length ? (
                    lowStockPreview.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-[20px] border border-[rgba(251,113,133,0.12)] bg-[rgba(34,10,18,0.68)] px-4 py-4"
                      >
                        <div>
                          <p className="font-semibold">{item.item_name}</p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {item.category || "Uncategorized"} · {item.sku || "No SKU"}
                          </p>
                        </div>
                        <span className="rounded-full border border-[rgba(251,113,133,0.16)] px-3 py-1 text-sm font-semibold text-[var(--warning)]">
                          {item.stock_on_hand} left
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      No urgent low-stock items in the current projection preview.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
