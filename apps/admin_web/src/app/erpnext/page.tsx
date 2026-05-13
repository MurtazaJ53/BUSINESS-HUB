import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import {
  enqueueCycleAction,
  pushPaymentsAction,
  pushSalesAction,
  runCycleAction,
  syncCustomersAction,
  syncItemsAction,
  syncPurchasesAction,
  syncStockAction,
  syncSupplierPaymentsAction,
  syncSuppliersAction,
  verifyConnectionAction,
} from "@/app/erpnext/actions";
import {
  getERPNextBinding,
  getERPNextDocumentLinks,
  getERPNextHealth,
  getERPNextMeta,
  getERPNextPocSummary,
  getERPNextPurchases,
  getERPNextSupplierPayments,
  getERPNextSuppliers,
  getERPNextSyncState,
  getSession,
  resolveActiveShop,
} from "@/lib/admin-api";
import { formatCurrency } from "@/lib/formatters";

type SearchParams = Record<string, string | string[] | undefined>;

type ERPNextPageProps = {
  searchParams?: Promise<SearchParams>;
};

function getSearchParamValue(searchParams: SearchParams, key: string) {
  const raw = searchParams[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function buildActionBanner(searchParams: SearchParams) {
  const status = getSearchParamValue(searchParams, "status");
  const action = getSearchParamValue(searchParams, "action");
  const shop = getSearchParamValue(searchParams, "shop");
  const message = getSearchParamValue(searchParams, "message");
  const summary = getSearchParamValue(searchParams, "summary");

  if (!status || !action) {
    return null;
  }

  if (status === "success") {
    return {
      accent:
        "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.76)] text-[var(--success)]" as const,
      title: `ERPNext action succeeded: ${action}`,
      body: `${shop || "Selected shop"} completed the requested ERPNext control-plane action successfully.${summary ? ` Result: ${summary}` : ""}`,
    };
  }

  return {
    accent:
      "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.76)] text-[var(--warning)]" as const,
    title: `ERPNext action failed: ${action}`,
    body: `${shop || "Selected shop"} could not complete the requested ERPNext action.${message ? ` ${message}` : ""}`,
  };
}

function ActionForm({
  action,
  shopId,
  shopSlug,
  label,
  detail,
}: {
  action: (formData: FormData) => Promise<void>;
  shopId: string;
  shopSlug: string;
  label: string;
  detail: string;
}) {
  return (
    <form action={action} className="rounded-[22px] border border-[rgba(148,163,184,0.12)] bg-[rgba(10,18,31,0.72)] p-4">
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="shopSlug" value={shopSlug} />
      <input type="hidden" name="limit" value="100" />
      <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{detail}</p>
      <button
        type="submit"
        className="mt-4 inline-flex rounded-full border border-[rgba(92,174,254,0.22)] bg-[rgba(10,36,68,0.82)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition-transform duration-150 hover:-translate-y-0.5"
      >
        Run
      </button>
    </form>
  );
}

export default async function ERPNextPage({ searchParams }: ERPNextPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const actionBanner = buildActionBanner(resolvedSearchParams);

  if (!activeShop) {
    return (
      <AdminShell
        session={session}
        activeShop={activeShop}
        activeRoute="erpnext"
        title="ERPNext Control"
        subtitle="No shop is active yet, so the ERPNext command surface cannot resolve a binding."
      >
        <EmptyState
          title="No shop membership found"
          body="The backend session resolved your operator account, but there is no active shop membership yet. Bootstrap a shop membership before using the ERPNext control plane."
        />
      </AdminShell>
    );
  }

  const [meta, health, binding, syncState, summary, suppliers, purchases, supplierPayments, documentLinks] =
    await Promise.all([
      getERPNextMeta(),
      getERPNextHealth(),
      getERPNextBinding(activeShop.shop.id),
      getERPNextSyncState(activeShop.shop.id),
      getERPNextPocSummary(activeShop.shop.id),
      getERPNextSuppliers(activeShop.shop.id),
      getERPNextPurchases(activeShop.shop.id),
      getERPNextSupplierPayments(activeShop.shop.id),
      getERPNextDocumentLinks(activeShop.shop.id),
    ]);

  const recentFailedLinks = documentLinks.filter((link) => link.sync_status === "failed").slice(0, 5);
  const purchasePreview = purchases.slice(0, 6);
  const supplierPaymentPreview = supplierPayments.slice(0, 6);
  const supplierPreview = suppliers.slice(0, 6);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="erpnext"
      title="ERPNext Control"
      subtitle="End-to-end ERPNext control plane for one-shop execution, recurring cycle policy, and purchase-side mirror visibility."
    >
      <div className="space-y-8">
        {actionBanner ? (
          <section className={`panel-soft rounded-[28px] border px-6 py-5 ${actionBanner.accent}`}>
            <p className="eyebrow text-current/70">Operator feedback</p>
            <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">{actionBanner.title}</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{actionBanner.body}</p>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="ERPNext health"
            value={health.status.toUpperCase()}
            detail={`${health.reachable ? "Reachable" : "Not reachable"} • ${health.authenticated ? "Authenticated" : "Not authenticated"}`}
            accent={health.status === "ok" ? "green" : "rose"}
            icon="ERP"
          />
          <MetricCard
            label="Document links"
            value={summary.document_links.linked.toString()}
            detail={`${summary.document_links.failed} failed • ${summary.document_links.pending} pending`}
            accent="blue"
            icon="LNK"
          />
          <MetricCard
            label="Purchase mirrors"
            value={summary.local_counts.erpnext_purchases.toString()}
            detail={`${summary.local_counts.erpnext_purchase_orders} orders • ${summary.local_counts.erpnext_purchase_invoices} invoices`}
            accent="green"
            icon="PUR"
          />
          <MetricCard
            label="Supplier payments"
            value={summary.local_counts.erpnext_supplier_payments.toString()}
            detail={`Beat ${meta.cycle_beat_enabled ? "enabled" : "disabled"} every ${meta.cycle_beat_minutes} min`}
            accent="blue"
            icon="SUP"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
          <div className="space-y-6">
            <section className="panel-soft rounded-[28px] px-6 py-6">
              <p className="eyebrow">Binding posture</p>
              <h2 className="mt-3 text-2xl font-bold">Current ERPNext mapping</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-[20px] border border-[rgba(92,174,254,0.14)] bg-[rgba(10,22,39,0.72)] px-4 py-4">
                  <p className="text-sm text-[var(--text-secondary)]">Base URL</p>
                  <p className="mt-2 font-semibold">{meta.base_url || "Not configured"}</p>
                </div>
                <div className="rounded-[20px] border border-[rgba(92,174,254,0.14)] bg-[rgba(10,22,39,0.72)] px-4 py-4">
                  <p className="text-sm text-[var(--text-secondary)]">Site / mode</p>
                  <p className="mt-2 font-semibold">
                    {meta.site_name || "Unset"} • {meta.is_mock_mode ? "mock" : binding.environment}
                  </p>
                </div>
                <div className="rounded-[20px] border border-[rgba(92,174,254,0.14)] bg-[rgba(10,22,39,0.72)] px-4 py-4">
                  <p className="text-sm text-[var(--text-secondary)]">Company / warehouse</p>
                  <p className="mt-2 font-semibold">{binding.company || "Unset"}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{binding.warehouse || "No warehouse set"}</p>
                </div>
                <div className="rounded-[20px] border border-[rgba(92,174,254,0.14)] bg-[rgba(10,22,39,0.72)] px-4 py-4">
                  <p className="text-sm text-[var(--text-secondary)]">Recurring cycle policy</p>
                  <p className="mt-2 font-semibold">
                    {meta.cycle_beat_enabled ? "Enabled" : "Disabled"} • {meta.cycle_beat_minutes} min cadence
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">Limit {meta.cycle_beat_limit} per cycle</p>
                </div>
              </div>
            </section>

            <section className="panel-soft rounded-[28px] px-6 py-6">
              <p className="eyebrow">Action deck</p>
              <h2 className="mt-3 text-2xl font-bold">ERPNext operations</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <ActionForm action={verifyConnectionAction} shopId={activeShop.shop.id} shopSlug={activeShop.shop.slug} label="Verify connection" detail="Check site reachability, auth posture, and bootstrap cursors." />
                <ActionForm action={syncItemsAction} shopId={activeShop.shop.id} shopSlug={activeShop.shop.slug} label="Sync items" detail="Pull ERPNext Item masters into Business Hub inventory." />
                <ActionForm action={syncCustomersAction} shopId={activeShop.shop.id} shopSlug={activeShop.shop.slug} label="Sync customers" detail="Pull ERPNext Customer masters into the local customer registry." />
                <ActionForm action={syncStockAction} shopId={activeShop.shop.id} shopSlug={activeShop.shop.slug} label="Sync stock" detail="Reconcile local stock against ERPNext Bin quantities." />
                <ActionForm action={syncSuppliersAction} shopId={activeShop.shop.id} shopSlug={activeShop.shop.slug} label="Sync suppliers" detail="Mirror ERPNext Supplier masters for the active shop." />
                <ActionForm action={syncPurchasesAction} shopId={activeShop.shop.id} shopSlug={activeShop.shop.slug} label="Sync purchases" detail="Import purchase orders, receipts, invoices, and return posture." />
                <ActionForm action={syncSupplierPaymentsAction} shopId={activeShop.shop.id} shopSlug={activeShop.shop.slug} label="Sync supplier payments" detail="Mirror outgoing supplier payment entries from ERPNext." />
                <ActionForm action={pushSalesAction} shopId={activeShop.shop.id} shopSlug={activeShop.shop.slug} label="Push sales" detail="Publish local Business Hub sales into ERPNext Sales Invoice." />
                <ActionForm action={pushPaymentsAction} shopId={activeShop.shop.id} shopSlug={activeShop.shop.slug} label="Push payments" detail="Publish local customer payments into ERPNext Payment Entry." />
                <ActionForm action={runCycleAction} shopId={activeShop.shop.id} shopSlug={activeShop.shop.slug} label="Run full cycle" detail="Verify, sync, and push the entire ERPNext cycle inline." />
                <ActionForm action={enqueueCycleAction} shopId={activeShop.shop.id} shopSlug={activeShop.shop.slug} label="Enqueue cycle" detail="Queue the full ERPNext cycle on the erpnext-sync worker lane." />
              </div>
            </section>

            <section className="panel-soft rounded-[28px] px-6 py-6">
              <p className="eyebrow">Cursors and links</p>
              <h2 className="mt-3 text-2xl font-bold">Current sync posture</h2>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  {syncState.cursors.map((cursor) => (
                    <div
                      key={cursor.id}
                      className="rounded-[20px] border border-[rgba(148,163,184,0.12)] bg-[rgba(10,18,31,0.72)] px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold">{cursor.domain.replace(/_/g, " ")}</p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {cursor.direction} • {cursor.last_result_count} last rows
                          </p>
                        </div>
                        <span className="rounded-full border border-[rgba(92,174,254,0.18)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                          {cursor.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  {recentFailedLinks.length ? (
                    recentFailedLinks.map((link) => (
                      <div
                        key={link.id}
                        className="rounded-[20px] border border-[rgba(251,113,133,0.14)] bg-[rgba(39,14,18,0.72)] px-4 py-4"
                      >
                        <p className="font-semibold text-[var(--warning)]">
                          {link.remote_doctype} • {link.remote_name}
                        </p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {link.local_domain} / {link.local_object_id}
                        </p>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">
                          {link.last_error_message || "No error message attached."}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[20px] border border-[rgba(52,211,153,0.16)] bg-[rgba(7,33,25,0.72)] px-4 py-4 text-sm text-[var(--success)]">
                      No failed ERPNext document links right now.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="panel-soft rounded-[28px] px-6 py-6">
              <p className="eyebrow">Summary</p>
              <h2 className="mt-3 text-2xl font-bold">Shop ERP posture</h2>
              <div className="mt-5 space-y-3">
                <div className="rounded-[20px] border border-[rgba(148,163,184,0.12)] bg-[rgba(10,18,31,0.72)] px-4 py-4">
                  <p className="text-sm text-[var(--text-secondary)]">Recommendation</p>
                  <p className="mt-2 text-sm text-[var(--text-primary)]">{summary.recommendation}</p>
                </div>
                <div className="rounded-[20px] border border-[rgba(148,163,184,0.12)] bg-[rgba(10,18,31,0.72)] px-4 py-4">
                  <p className="text-sm text-[var(--text-secondary)]">Purchase-side totals</p>
                  <p className="mt-2 text-sm text-[var(--text-primary)]">
                    {summary.local_counts.erpnext_purchase_orders} orders • {summary.local_counts.erpnext_purchase_receipts} receipts • {summary.local_counts.erpnext_purchase_invoices} invoices • {summary.local_counts.erpnext_purchase_returns} returns
                  </p>
                </div>
                <div className="rounded-[20px] border border-[rgba(148,163,184,0.12)] bg-[rgba(10,18,31,0.72)] px-4 py-4">
                  <p className="text-sm text-[var(--text-secondary)]">Supplier finance</p>
                  <p className="mt-2 text-sm text-[var(--text-primary)]">
                    {summary.local_counts.erpnext_supplier_payments} mirrored supplier payments
                  </p>
                </div>
              </div>
            </section>

            <section className="panel-soft rounded-[28px] px-6 py-6">
              <p className="eyebrow">Suppliers</p>
              <h2 className="mt-3 text-2xl font-bold">Latest supplier mirror</h2>
              <div className="mt-5 space-y-3">
                {supplierPreview.length ? supplierPreview.map((supplier) => (
                  <div key={supplier.id} className="rounded-[20px] border border-[rgba(148,163,184,0.12)] bg-[rgba(10,18,31,0.72)] px-4 py-4">
                    <p className="font-semibold">{supplier.supplier_name}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {supplier.remote_name} • {supplier.supplier_group || "No group"}
                    </p>
                  </div>
                )) : <p className="text-sm text-[var(--text-secondary)]">No suppliers mirrored yet.</p>}
              </div>
            </section>

            <section className="panel-soft rounded-[28px] px-6 py-6">
              <p className="eyebrow">Purchases</p>
              <h2 className="mt-3 text-2xl font-bold">Recent purchase documents</h2>
              <div className="mt-5 space-y-3">
                {purchasePreview.length ? purchasePreview.map((purchase) => (
                  <div key={purchase.id} className="rounded-[20px] border border-[rgba(148,163,184,0.12)] bg-[rgba(10,18,31,0.72)] px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{purchase.remote_doctype}</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {purchase.remote_name} • {purchase.supplier_name || purchase.supplier_remote_name}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-[var(--accent)]">
                        {formatCurrency(Number(purchase.grand_total || 0), activeShop.shop.currency_code)}
                      </span>
                    </div>
                    {purchase.is_return ? (
                      <p className="mt-2 text-xs font-semibold text-[var(--warning)]">
                        Return against {purchase.return_against_remote_name || "unknown"}
                      </p>
                    ) : null}
                  </div>
                )) : <p className="text-sm text-[var(--text-secondary)]">No purchase mirrors yet.</p>}
              </div>
            </section>

            <section className="panel-soft rounded-[28px] px-6 py-6">
              <p className="eyebrow">Supplier payments</p>
              <h2 className="mt-3 text-2xl font-bold">Recent outgoing settlements</h2>
              <div className="mt-5 space-y-3">
                {supplierPaymentPreview.length ? supplierPaymentPreview.map((payment) => (
                  <div key={payment.id} className="rounded-[20px] border border-[rgba(148,163,184,0.12)] bg-[rgba(10,18,31,0.72)] px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{payment.supplier_name || payment.supplier_remote_name}</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {payment.remote_name} • {payment.mode_of_payment || "No mode"}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-[var(--accent)]">
                        {formatCurrency(Number(payment.paid_amount || 0), activeShop.shop.currency_code)}
                      </span>
                    </div>
                  </div>
                )) : <p className="text-sm text-[var(--text-secondary)]">No supplier payment mirrors yet.</p>}
              </div>
            </section>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
