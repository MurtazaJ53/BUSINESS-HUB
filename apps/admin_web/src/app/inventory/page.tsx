import { AdminShell } from "@/components/admin-shell";
import { DomainPilotSignoffCard } from "@/components/domain-pilot-signoff-card";
import { EmptyState } from "@/components/empty-state";
import { InventoryTable } from "@/components/inventory-table";
import { MetricCard } from "@/components/metric-card";
import {
  buildInventoryStats,
  getInventory,
  getSession,
  getShopDomainState,
  resolveActiveShop,
} from "@/lib/admin-api";
import { formatCurrency } from "@/lib/formatters";

function buildInventoryModeCopy(
  domainState: Awaited<ReturnType<typeof getShopDomainState>>,
) {
  if (domainState.can_write_on_postgres_surface) {
    return {
      accent:
        "border-[rgba(52,211,153,0.22)] bg-[rgba(7,33,25,0.84)] text-[var(--success)]" as const,
      badge: "Postgres primary",
      title: "Inventory pilot is now running on PostgreSQL.",
      body:
        "This shop is already promoted on the new inventory path. New Django-admin inventory writes are allowed, bridge replay is still tracked, and rollback is available from the migration console if drift appears.",
    };
  }

  if (domainState.control_present) {
    return {
      accent:
        "border-[rgba(251,113,133,0.22)] bg-[rgba(40,12,19,0.84)] text-[var(--warning)]" as const,
      badge: "Shadow / pilot guard",
      title: "Inventory is still protected by legacy ownership.",
      body:
        "This shop is in a migration pilot posture, but PostgreSQL is not yet the write master. Reads can be verified here, while write ownership and final promotion must still be confirmed through the migration gate.",
    };
  }

  return {
    accent:
      "border-[rgba(92,174,254,0.22)] bg-[rgba(9,18,34,0.82)] text-[var(--accent)]" as const,
    badge: "Legacy baseline",
    title: "Inventory is still operating in the legacy migration baseline.",
    body:
      "No explicit migration control exists for this shop/domain yet. The Django contract is useful for shadow validation and reporting, but Firebase still represents the default source of truth for inventory ownership.",
  };
}

export default async function InventoryPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const items = activeShop ? await getInventory(activeShop.shop.id) : [];
  const domainState = activeShop
    ? await getShopDomainState(activeShop.shop.id, "inventory")
    : null;
  const stats = buildInventoryStats(items);
  const inventoryMode = domainState ? buildInventoryModeCopy(domainState) : null;

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="inventory"
      title="Inventory Ledger"
      subtitle="Phase 3 inventory surface powered by Django, with migration ownership, pilot visibility, and cutover-safe read/write posture for each shop."
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

          {domainState && inventoryMode ? (
            <section className={`panel-soft rounded-[28px] border px-6 py-5 ${inventoryMode.accent}`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="eyebrow text-current/70">Inventory migration mode</p>
                  <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">
                    {inventoryMode.title}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
                    {inventoryMode.body}
                  </p>
                </div>
                <div className="grid gap-2 text-sm text-[var(--text-secondary)] md:min-w-[270px]">
                  <div className="rounded-[18px] border border-current/20 bg-[rgba(0,0,0,0.12)] px-4 py-3">
                    <div className="font-semibold text-[var(--text-primary)]">{inventoryMode.badge}</div>
                    <div className="mt-1">
                      write_master=
                      {" "}
                      <span className="font-mono text-[var(--text-primary)]">{domainState.write_master}</span>
                    </div>
                    <div>
                      bridge_mode=
                      {" "}
                      <span className="font-mono text-[var(--text-primary)]">{domainState.bridge_mode}</span>
                    </div>
                    <div>
                      cutover_status=
                      {" "}
                      <span className="font-mono text-[var(--text-primary)]">{domainState.cutover_status}</span>
                    </div>
                    <div>
                      epoch=
                      {" "}
                      <span className="font-mono text-[var(--text-primary)]">{domainState.current_epoch}</span>
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
                <p className="eyebrow">Inventory dataset</p>
                <h2 className="mt-3 text-2xl font-bold">Live backend results</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  This table is being resolved against
                  {" "}
                  <code>/api/v1/shops/{activeShop.shop.id}/inventory/</code>
                  {" "}
                  plus the membership-safe domain-state endpoint for pilot visibility.
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
