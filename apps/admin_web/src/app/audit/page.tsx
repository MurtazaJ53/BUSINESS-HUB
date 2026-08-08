import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { getSession, getWorkspaceAuditEvents, resolveActiveShop } from "@/lib/admin-api";
import { formatDateTime, formatRole } from "@/lib/formatters";
import { getAdminWebMfaPosture } from "@/lib/mfa";
import { canManageWorkspace } from "@/lib/roles";
import { MfaGateCard } from "@/components/mfa-gate-card";
import type { WorkspaceAuditEventPayload } from "@/lib/types";

type SearchParams = Record<string, string | string[] | undefined>;

type AuditPageProps = {
  searchParams?: Promise<SearchParams>;
};

function getSearchParamValue(searchParams: SearchParams, key: string) {
  const raw = searchParams[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function countByCategory(events: WorkspaceAuditEventPayload[], category: WorkspaceAuditEventPayload["category"]) {
  return events.filter((event) => event.category === category).length;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const q = getSearchParamValue(resolvedSearchParams, "q") ?? "";
  const category = getSearchParamValue(resolvedSearchParams, "category") ?? "";
  const actorRole = getSearchParamValue(resolvedSearchParams, "actorRole") ?? "";
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const role = activeShop?.role ?? null;
  const canUseAudit = canManageWorkspace(role);
  const mfaPosture = await getAdminWebMfaPosture(session.user, canUseAudit);
  const events =
    activeShop && canUseAudit && mfaPosture.verified
      ? await getWorkspaceAuditEvents(activeShop.shop.id, {
          q: q || undefined,
          category: category || undefined,
          actorRole: actorRole || undefined,
        })
      : [];

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="audit"
      title="Workspace audit trail"
      subtitle="Review who changed roles, plans, customers, stock, sales, and payments without relying on guesswork or raw database access."
    >
      {!activeShop ? (
        <EmptyState
          title="No workspace selected"
          body="Choose an active shop membership before reviewing audit activity for a store."
        />
      ) : canUseAudit && !mfaPosture.verified ? (
        <MfaGateCard href="/security?returnTo=/audit" enabled={mfaPosture.enabled} title="Workspace audit trail" />
      ) : !canUseAudit ? (
        <EmptyState
          title="Audit review is owner and admin only"
          body="Daily users should stay focused on selling and operations. Sensitive business-control review stays limited to workspace owners and admins."
        />
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Audit events"
              value={events.length.toString()}
              detail="Captured activity entries for this workspace"
              icon="AUD"
            />
            <MetricCard
              label="Workspace actions"
              value={countByCategory(events, "workspace").toString()}
              detail="Plan, team, and ownership changes"
              accent="blue"
              icon="WRK"
            />
            <MetricCard
              label="Stock actions"
              value={countByCategory(events, "inventory").toString()}
              detail="Inventory changes and stock adjustments"
              accent="green"
              icon="INV"
            />
            <MetricCard
              label="Commerce actions"
              value={(countByCategory(events, "sale") + countByCategory(events, "payment")).toString()}
              detail="Sales and payment acceptance events"
              accent="rose"
              icon="SAL"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
            <div className="space-y-6">
              <section className="panel-soft rounded-[28px] px-6 py-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="eyebrow">Audit filters</p>
                    <h2 className="mt-3 text-2xl font-bold">Find the exact change</h2>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      Search by member, receipt, item, customer, or event summary. Use category and role filters to tighten the trail quickly.
                    </p>
                  </div>
                </div>

                <form method="get" className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="block xl:col-span-2">
                    <span className="eyebrow">Search</span>
                    <input
                      name="q"
                      defaultValue={q}
                      placeholder="Search member, item, receipt, or summary"
                      className="mt-2 w-full rounded-[18px] border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                    />
                  </label>
                  <label className="block">
                    <span className="eyebrow">Category</span>
                    <select
                      name="category"
                      defaultValue={category}
                      className="mt-2 w-full rounded-[18px] border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none"
                    >
                      <option value="">All categories</option>
                      <option value="workspace">Workspace</option>
                      <option value="inventory">Inventory</option>
                      <option value="customer">Customer</option>
                      <option value="sale">Sale</option>
                      <option value="payment">Payment</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="eyebrow">Actor role</span>
                    <select
                      name="actorRole"
                      defaultValue={actorRole}
                      className="mt-2 w-full rounded-[18px] border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none"
                    >
                      <option value="">All roles</option>
                      <option value="owner">Owner</option>
                      <option value="admin">Store admin</option>
                      <option value="staff">Staff operator</option>
                      <option value="viewer">Read-only viewer</option>
                    </select>
                  </label>
                  <div className="md:col-span-2 xl:col-span-4 flex flex-wrap gap-3">
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-full border border-[rgba(71,176,255,0.16)] bg-[rgba(71,176,255,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(71,176,255,0.18)]"
                    >
                      Apply filters
                    </button>
                    <a
                      href="/audit"
                      className="inline-flex items-center rounded-full border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.64)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                    >
                      Clear
                    </a>
                  </div>
                </form>
              </section>

              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Audit stream</p>
                <h2 className="mt-3 text-2xl font-bold">Recent business-control activity</h2>
                <div className="mt-6 space-y-4">
                  {events.length ? (
                    events.map((event) => (
                      <article key={event.id} className="surface-muted rounded-[24px] px-5 py-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[rgba(71,176,255,0.16)] bg-[rgba(71,176,255,0.08)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
                            {event.category}
                          </span>
                          <span className="rounded-full border border-[rgba(152,164,189,0.12)] bg-[rgba(9,14,22,0.52)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                            {event.event_type}
                          </span>
                          {event.actor_role ? (
                            <span className="rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(77,49,9,0.34)] px-3 py-1 text-xs font-medium text-[var(--warning)]">
                              {formatRole(event.actor_role)}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">
                          {event.entity_label || event.summary}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{event.summary}</p>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-[18px] border border-[rgba(152,164,189,0.12)] bg-[rgba(13,18,28,0.68)] px-4 py-4 text-sm text-[var(--text-secondary)]">
                            Actor
                            <div className="mt-1 text-base font-semibold text-[var(--text-primary)]">
                              {event.actor_name || "System"}
                            </div>
                            <div className="mt-1 text-xs text-[var(--text-muted)]">
                              {formatDateTime(event.occurred_at)}
                            </div>
                          </div>
                          <div className="rounded-[18px] border border-[rgba(152,164,189,0.12)] bg-[rgba(13,18,28,0.68)] px-4 py-4 text-sm text-[var(--text-secondary)]">
                            Entity
                            <div className="mt-1 text-base font-semibold text-[var(--text-primary)]">
                              {event.entity_type}
                            </div>
                            <div className="mt-1 text-xs text-[var(--text-muted)]">
                              {event.entity_id || "No entity id"}
                            </div>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      No audit events match the current filters yet.
                    </p>
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">What is tracked</p>
                <h2 className="mt-3 text-2xl font-bold">Current audit coverage</h2>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                  <li>- workspace plan requests</li>
                  <li>- team add, update, and ownership transfer</li>
                  <li>- inventory create, update, archive, and stock adjustments</li>
                  <li>- customer create, update, archive, and ledger entries</li>
                  <li>- sale creation and accepted sale commands</li>
                  <li>- accepted payment commands</li>
                </ul>
              </section>

              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Why it matters</p>
                <h2 className="mt-3 text-2xl font-bold">Owner trust and accountability</h2>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                  <li>- prove who changed stock, team roles, or customer balances</li>
                  <li>- review sensitive activity without opening internal database tools</li>
                  <li>- create a cleaner base for later anomaly detection and automation</li>
                </ul>
              </section>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
