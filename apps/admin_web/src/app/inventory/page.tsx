import { AdminShell } from "@/components/admin-shell";
import { DomainPilotSignoffCard } from "@/components/domain-pilot-signoff-card";
import { EmptyState } from "@/components/empty-state";
import { InventoryTable } from "@/components/inventory-table";
import { MetricCard } from "@/components/metric-card";
import {
  getInventory,
  getInventorySummary,
  getSession,
  getShopDomainState,
  resolveActiveShop,
} from "@/lib/admin-api";
import { formatCurrency } from "@/lib/formatters";
import {
  canAccessAdvancedReports,
  canAccessPurchaseWorkflow,
  canAccessSupplierDirectory,
  formatPlanTier,
} from "@/lib/plans";

function buildInventoryModeCopy(
  domainState: Awaited<ReturnType<typeof getShopDomainState>>,
) {
  if (domainState.can_write_on_postgres_surface) {
    return {
      accent:
        "border-[rgba(52,211,153,0.22)] bg-[rgba(7,33,25,0.84)] text-[var(--success)]" as const,
      badge: "Stable backend path",
      title: "Inventory updates are flowing normally.",
      body:
        "This store is already using the newer inventory path, so stock updates and product changes can be managed here with normal confidence.",
    };
  }

  if (domainState.control_present) {
    return {
      accent:
        "border-[rgba(251,113,133,0.22)] bg-[rgba(40,12,19,0.84)] text-[var(--warning)]" as const,
      badge: "Watching transition",
      title: "Inventory is still under a cautious transition.",
      body:
        "The catalog is available here, but the store is still being watched closely before the new path becomes the long-term write owner.",
    };
  }

  return {
    accent:
      "border-[rgba(92,174,254,0.22)] bg-[rgba(9,18,34,0.82)] text-[var(--accent)]" as const,
    badge: "Legacy-aligned",
    title: "Inventory is still aligned to the legacy source.",
    body:
      "This view is still useful for product lookup and stock review, even though the store has not been promoted to the newer inventory path yet.",
  };
}

export default async function InventoryPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const [items, inventorySummary, domainState] = activeShop
    ? await Promise.all([
        getInventory(activeShop.shop.id),
        getInventorySummary(activeShop.shop.id),
        getShopDomainState(activeShop.shop.id, "inventory"),
      ])
    : [[], null, null];
  const inventoryMode = domainState ? buildInventoryModeCopy(domainState) : null;
  const canUseAdvancedReports = canAccessAdvancedReports(activeShop);
  const showSupplierColumn = canAccessSupplierDirectory(activeShop);
  const showPurchaseColumn = canAccessPurchaseWorkflow(activeShop);
  const lowStockItems = items
    .filter((item) => item.stock_on_hand <= 5)
    .sort((left, right) => left.stock_on_hand - right.stock_on_hand)
    .slice(0, 6);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="inventory"
      title="Inventory overview"
      subtitle="Check stock, review product status, and spot restock risk without opening a heavy back-office flow."
    >
      {!activeShop ? (
        <EmptyState
          title="No inventory workspace available"
          body="This web workspace needs an active shop membership before it can show the product catalog and stock view for a store."
        />
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Products live"
              value={(inventorySummary?.total_items ?? items.length).toString()}
              detail={`${inventorySummary?.categories ?? 0} categories currently in the store catalog`}
              icon="CAT"
            />
            <MetricCard
              label="Ready to sell"
              value={(inventorySummary?.available_items ?? 0).toString()}
              detail="Products that still have stock available"
              accent="green"
              icon="AVL"
            />
            <MetricCard
              label="Needs restock"
              value={(inventorySummary?.low_stock_items ?? 0).toString()}
              detail="Products at five units or lower"
              accent="rose"
              icon="LOW"
            />
            {canUseAdvancedReports ? (
              <MetricCard
                label="Retail value"
                value={formatCurrency(
                  Number(inventorySummary?.projected_sell_value ?? 0),
                  activeShop.shop.currency_code,
                )}
                detail="Current sell-side value of visible inventory"
                accent="blue"
                icon="VAL"
              />
            ) : (
              <MetricCard
                label="Plan insight"
                value={`${formatPlanTier(activeShop.shop.plan_tier)} plan`}
                detail="Inventory value rollups unlock on Pro."
                accent="blue"
                icon="PLN"
              />
            )}
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
            <div className="space-y-6">
              {domainState && inventoryMode ? (
                <section
                  className={`panel-soft rounded-[28px] border px-6 py-5 ${inventoryMode.accent}`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="eyebrow text-current/70">Inventory health</p>
                      <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">
                        {inventoryMode.title}
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
                        {inventoryMode.body}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm text-[var(--text-secondary)] md:min-w-[270px]">
                      <div className="rounded-[18px] border border-current/20 bg-[rgba(0,0,0,0.12)] px-4 py-3">
                        <div className="font-semibold text-[var(--text-primary)]">
                          {inventoryMode.badge}
                        </div>
                        <div className="mt-1">
                          Write owner{" "}
                          <span className="font-mono text-[var(--text-primary)]">
                            {domainState.write_master}
                          </span>
                        </div>
                        <div>
                          Bridge mode{" "}
                          <span className="font-mono text-[var(--text-primary)]">
                            {domainState.bridge_mode}
                          </span>
                        </div>
                        <div>
                          Status{" "}
                          <span className="font-mono text-[var(--text-primary)]">
                            {domainState.cutover_status}
                          </span>
                        </div>
                      </div>
                      <DomainPilotSignoffCard
                        domainState={domainState}
                        domainLabel="Inventory"
                      />
                    </div>
                  </div>
                </section>
              ) : null}

              <section className="panel-soft rounded-[28px] px-6 py-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="eyebrow">Stock list</p>
                    <h2 className="mt-3 text-2xl font-bold">Current catalog</h2>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      Use this view to review stock, price, category, and product availability for
                      the active store.
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
                    showSupplierColumn={showSupplierColumn}
                    showPurchaseColumn={showPurchaseColumn}
                  />
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Restock watch</p>
                <h2 className="mt-3 text-2xl font-bold">Products needing review</h2>
                <div className="mt-5 space-y-3">
                  {lowStockItems.length ? (
                    lowStockItems.map((item) => (
                      <div
                        key={item.id}
                        className="surface-muted flex items-center justify-between rounded-[20px] px-4 py-4"
                      >
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {item.category || "Uncategorized"} | {item.sku || "No SKU"}
                          </p>
                        </div>
                        <span className="rounded-full border border-[rgba(255,138,106,0.18)] px-3 py-1 text-sm font-semibold text-[var(--warning)]">
                          {item.stock_on_hand} left
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      No urgent restock items are showing in this store right now.
                    </p>
                  )}
                </div>
              </section>

              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Use this page for</p>
                <h2 className="mt-3 text-2xl font-bold">Fast stock decisions</h2>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                  <li>- Check whether a product is still available before the next sale.</li>
                  <li>- Review low-stock items before they become stock-outs.</li>
                  <li>- Confirm pricing and status without opening technical inventory tools.</li>
                  {showSupplierColumn ? (
                    <li>- Review supplier-linked products without exposing a full purchase system.</li>
                  ) : null}
                  {showPurchaseColumn ? (
                    <li>- Track last purchase visibility only on workspaces that have deeper procurement enabled.</li>
                  ) : null}
                </ul>
              </section>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
