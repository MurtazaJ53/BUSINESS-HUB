import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { MfaGateCard } from "@/components/mfa-gate-card";
import { updateWorkspaceSessionAction } from "@/app/sessions/actions";
import { getSession, getWorkspaceAccessSessions, resolveActiveShop } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/formatters";
import { getAdminWebMfaPosture } from "@/lib/mfa";
import { canManageWorkspace } from "@/lib/roles";
import type { WorkspaceAccessSessionPayload } from "@/lib/types";

type SearchParams = Record<string, string | string[] | undefined>;

type SessionsPageProps = {
  searchParams?: Promise<SearchParams>;
};

function getSearchParamValue(searchParams: SearchParams, key: string) {
  const raw = searchParams[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function buildActionBanner(searchParams: SearchParams) {
  const status = getSearchParamValue(searchParams, "status");
  const action = getSearchParamValue(searchParams, "action");
  const device = getSearchParamValue(searchParams, "device");
  const message = getSearchParamValue(searchParams, "message");

  if (!status) {
    return null;
  }

  if (status === "success") {
    const title =
      action === "request_wipe"
        ? "Remote wipe requested"
        : action === "restore"
          ? "Device session restored"
          : "Device session revoked";
    const body =
      action === "request_wipe"
        ? `${device || "The selected session"} will clear local workspace data when that app comes online.`
        : action === "restore"
          ? `${device || "The selected session"} can use the workspace again.`
          : `${device || "The selected session"} can no longer use this workspace.`;
    return {
      accent:
        "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.76)] text-[var(--success)]" as const,
      title,
      body,
    };
  }

  return {
    accent:
      "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.76)] text-[var(--warning)]" as const,
    title: "Workspace session action failed",
    body: message || "The device session action did not complete.",
  };
}

function countSessions(
  sessions: WorkspaceAccessSessionPayload[],
  predicate: (session: WorkspaceAccessSessionPayload) => boolean,
) {
  return sessions.filter(predicate).length;
}

function statusLabel(session: WorkspaceAccessSessionPayload) {
  if (session.wipe_requested) {
    return "wipe pending";
  }
  return session.status;
}

export default async function SessionsPage({ searchParams }: SessionsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const role = activeShop?.role ?? null;
  const canUseSessions = canManageWorkspace(role);
  const mfaPosture = await getAdminWebMfaPosture(session.user, canUseSessions);
  const sessions = activeShop && canUseSessions && mfaPosture.verified ? await getWorkspaceAccessSessions(activeShop.shop.id) : [];
  const banner = buildActionBanner(resolvedSearchParams);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="sessions"
      title="Workspace sessions"
      subtitle="Control which mobile devices can keep using this store and remotely cut off or wipe a lost app instance."
    >
      {!activeShop ? (
        <EmptyState
          title="No workspace selected"
          body="Choose an active shop membership before reviewing mobile device sessions for a store."
        />
      ) : canUseSessions && !mfaPosture.verified ? (
        <MfaGateCard href="/security?returnTo=/sessions" enabled={mfaPosture.enabled} title="Workspace sessions" />
      ) : !canUseSessions ? (
        <EmptyState
          title="Session control is owner and admin only"
          body="Daily users should stay focused on selling and operations. Device-session control stays limited to workspace owners and admins."
        />
      ) : (
        <div className="space-y-8">
          {banner ? (
            <section className={`panel-soft rounded-[28px] border px-6 py-5 ${banner.accent}`}>
              <p className="eyebrow text-current/70">Workspace session signal</p>
              <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">{banner.title}</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{banner.body}</p>
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Known sessions"
              value={sessions.length.toString()}
              detail="Mobile app instances seen for this workspace"
              icon="SES"
            />
            <MetricCard
              label="Active"
              value={countSessions(sessions, (item) => item.status === "active" && !item.wipe_requested).toString()}
              detail="Devices still allowed to use the workspace"
              accent="green"
              icon="ACT"
            />
            <MetricCard
              label="Revoked"
              value={countSessions(sessions, (item) => item.status === "revoked").toString()}
              detail="Devices blocked from further workspace use"
              accent="rose"
              icon="REV"
            />
            <MetricCard
              label="Wipe pending"
              value={countSessions(sessions, (item) => item.wipe_requested).toString()}
              detail="Devices that should clear local data on next contact"
              accent="blue"
              icon="WIP"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,0.92fr)]">
            <div className="space-y-6">
              <section className="panel-soft rounded-[28px] px-6 py-6">
                <div>
                  <p className="eyebrow">Device list</p>
                  <h2 className="mt-3 text-2xl font-bold">Which mobile app instances can still work</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Use this page to cut off a lost device, request a local wipe, or restore an app instance after a false alarm.
                  </p>
                </div>

                <div className="mt-6 space-y-4">
                  {sessions.length ? (
                    sessions.map((item) => (
                      <article key={item.id} className="surface-muted rounded-[24px] px-5 py-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold text-[var(--text-primary)]">{item.device_label}</p>
                              <span className="rounded-full border border-[rgba(71,176,255,0.16)] bg-[rgba(71,176,255,0.08)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
                                {item.role_label}
                              </span>
                              <span className="rounded-full border border-[rgba(152,164,189,0.12)] bg-[rgba(9,14,22,0.52)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                                {statusLabel(item)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-[var(--text-secondary)]">{item.member_email}</p>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <div className="rounded-[18px] border border-[rgba(152,164,189,0.12)] bg-[rgba(13,18,28,0.68)] px-4 py-4 text-sm text-[var(--text-secondary)]">
                                Platform
                                <div className="mt-1 text-base font-semibold text-[var(--text-primary)]">
                                  {item.platform_name || "mobile"}
                                </div>
                                <div className="mt-1 text-xs text-[var(--text-muted)]">
                                  {item.package_name || "Unknown package"}
                                </div>
                              </div>
                              <div className="rounded-[18px] border border-[rgba(152,164,189,0.12)] bg-[rgba(13,18,28,0.68)] px-4 py-4 text-sm text-[var(--text-secondary)]">
                                Last seen
                                <div className="mt-1 text-base font-semibold text-[var(--text-primary)]">
                                  {formatDateTime(item.last_seen_at)}
                                </div>
                                <div className="mt-1 text-xs text-[var(--text-muted)]">
                                  {item.app_version ? `v${item.app_version}+${item.build_number || "?"}` : "Version unknown"}
                                </div>
                              </div>
                            </div>
                            {item.revoke_reason ? (
                              <p className="mt-4 text-sm text-[var(--text-secondary)]">
                                Reason: {item.revoke_reason}
                              </p>
                            ) : null}
                          </div>

                          {item.can_manage ? (
                            <div className="grid min-w-[280px] gap-3">
                              {item.status === "active" ? (
                                <>
                                  <form action={updateWorkspaceSessionAction}>
                                    <input type="hidden" name="shopId" value={activeShop.shop.id} />
                                    <input type="hidden" name="sessionId" value={item.id} />
                                    <input type="hidden" name="action" value="revoke" />
                                    <input type="hidden" name="device" value={item.device_label} />
                                    <input type="hidden" name="note" value="Revoked from workspace sessions." />
                                    <button
                                      type="submit"
                                      className="w-full rounded-full border border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.76)] px-4 py-2 text-sm font-semibold text-[var(--warning)] transition hover:bg-[rgba(55,14,25,0.82)]"
                                    >
                                      Revoke access
                                    </button>
                                  </form>
                                  <form action={updateWorkspaceSessionAction}>
                                    <input type="hidden" name="shopId" value={activeShop.shop.id} />
                                    <input type="hidden" name="sessionId" value={item.id} />
                                    <input type="hidden" name="action" value="request_wipe" />
                                    <input type="hidden" name="device" value={item.device_label} />
                                    <input type="hidden" name="note" value="Requested remote wipe from workspace sessions." />
                                    <button
                                      type="submit"
                                      className="w-full rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(77,49,9,0.34)] px-4 py-2 text-sm font-semibold text-[var(--warning)] transition hover:bg-[rgba(92,58,10,0.46)]"
                                    >
                                      Revoke and wipe
                                    </button>
                                  </form>
                                </>
                              ) : (
                                <form action={updateWorkspaceSessionAction}>
                                  <input type="hidden" name="shopId" value={activeShop.shop.id} />
                                  <input type="hidden" name="sessionId" value={item.id} />
                                  <input type="hidden" name="action" value="restore" />
                                  <input type="hidden" name="device" value={item.device_label} />
                                  <input type="hidden" name="note" value="Restored from workspace sessions." />
                                  <button
                                    type="submit"
                                    className="w-full rounded-full border border-[rgba(58,215,162,0.18)] bg-[rgba(9,42,31,0.64)] px-4 py-2 text-sm font-semibold text-[var(--success)] transition hover:bg-[rgba(11,54,39,0.78)]"
                                  >
                                    Restore session
                                  </button>
                                </form>
                              )}
                            </div>
                          ) : (
                            <div className="min-w-[280px] rounded-[20px] border border-[rgba(152,164,189,0.12)] bg-[rgba(13,18,28,0.68)] px-4 py-4 text-sm text-[var(--text-secondary)]">
                              This device is outside your current session-control scope.
                            </div>
                          )}
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      No mobile device sessions have checked in for this workspace yet.
                    </p>
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">What happens</p>
                <h2 className="mt-3 text-2xl font-bold">Session control rules</h2>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                  <li>- Revoke blocks a mobile app instance from continued workspace use.</li>
                  <li>- Revoke and wipe tells that app to clear local workspace data the next time it checks in.</li>
                  <li>- Restore lets a previously blocked device work again.</li>
                  <li>- Admins can manage their own sessions and lower roles. Owners can manage every workspace device session.</li>
                </ul>
              </section>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
