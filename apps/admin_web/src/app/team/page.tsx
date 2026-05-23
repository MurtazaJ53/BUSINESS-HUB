import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { MfaGateCard } from "@/components/mfa-gate-card";
import {
  inviteWorkspaceMemberAction,
  transferWorkspaceOwnershipAction,
  updateWorkspaceMemberAction,
} from "@/app/team/actions";
import { getSession, getWorkspaceTeamMembers, resolveActiveShop } from "@/lib/admin-api";
import { getAdminWebMfaPosture } from "@/lib/mfa";
import { canManageWorkspace, canTransferWorkspaceOwnership } from "@/lib/roles";
import type { WorkspaceTeamMemberPayload } from "@/lib/types";

type SearchParams = Record<string, string | string[] | undefined>;

type TeamPageProps = {
  searchParams?: Promise<SearchParams>;
};

function getSearchParamValue(searchParams: SearchParams, key: string) {
  const raw = searchParams[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function buildActionBanner(searchParams: SearchParams) {
  const status = getSearchParamValue(searchParams, "status");
  const action = getSearchParamValue(searchParams, "action");
  const member = getSearchParamValue(searchParams, "member");
  const message = getSearchParamValue(searchParams, "message");

  if (!status) {
    return null;
  }

  if (status === "success") {
    return {
      accent:
        "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.76)] text-[var(--success)]" as const,
      title:
        action === "invite"
          ? "Workspace member saved"
          : action === "transfer"
            ? "Workspace ownership transferred"
          : "Workspace member updated",
      body:
        action === "invite"
          ? `${member || "The member"} is now attached to this workspace.`
          : action === "transfer"
            ? `${member || "The selected member"} now controls workspace ownership for this store.`
          : `${member || "The member"} now has the updated role or status.`,
    };
  }

  return {
    accent:
      "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.76)] text-[var(--warning)]" as const,
    title: "Workspace team action failed",
    body: message || "The team-management action did not complete.",
  };
}

function buildTeamStats(members: WorkspaceTeamMemberPayload[]) {
  return {
    total: members.length,
    active: members.filter((member) => member.status === "active").length,
    invited: members.filter((member) => member.status === "invited").length,
    disabled: members.filter((member) => member.status === "disabled").length,
  };
}

function getRoleChoices(role: WorkspaceTeamMemberPayload["role"]) {
  switch (role) {
    case "admin":
      return [
        { value: "admin", label: "Store admin" },
        { value: "staff", label: "Staff operator" },
        { value: "viewer", label: "Read-only viewer" },
      ];
    case "viewer":
      return [
        { value: "viewer", label: "Read-only viewer" },
        { value: "staff", label: "Staff operator" },
      ];
    case "staff":
      return [
        { value: "staff", label: "Staff operator" },
        { value: "viewer", label: "Read-only viewer" },
      ];
    default:
      return [{ value: role, label: role }];
  }
}

function getOwnershipCandidates(members: WorkspaceTeamMemberPayload[]) {
  return members.filter(
    (member) =>
      !member.is_current_user &&
      member.status === "active" &&
      member.role !== "owner",
  );
}

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const role = activeShop?.role ?? null;
  const canUseTeam = canManageWorkspace(role);
  const canTransferOwnership = canTransferWorkspaceOwnership(role);
  const mfaPosture = await getAdminWebMfaPosture(session.user, canUseTeam);
  const members = activeShop && canUseTeam && mfaPosture.verified ? await getWorkspaceTeamMembers(activeShop.shop.id) : [];
  const banner = buildActionBanner(resolvedSearchParams);
  const stats = buildTeamStats(members);
  const ownershipCandidates = getOwnershipCandidates(members);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="team"
      title="Workspace team"
      subtitle="Manage who can run the counter, who can control store operations, and who stays on read-only review."
    >
      {!activeShop ? (
        <EmptyState
          title="No workspace selected"
          body="Choose or add a shop membership before managing team access for a store."
        />
      ) : (
        <div className="space-y-8">
          {banner ? (
            <section className={`panel-soft rounded-[28px] border px-6 py-5 ${banner.accent}`}>
              <p className="eyebrow text-current/70">Workspace team signal</p>
              <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">{banner.title}</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{banner.body}</p>
            </section>
          ) : null}
          {!canUseTeam ? (
            <EmptyState
              title="Team management is owner and admin only"
              body="Daily users should stay focused on selling and operations. Workspace member control stays limited to owners and admins."
            />
          ) : !mfaPosture.verified ? (
            <MfaGateCard href="/security?returnTo=/team" enabled={mfaPosture.enabled} title="Workspace team" />
          ) : (
            <>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="panel-soft rounded-[28px] px-6 py-6">
                  <p className="eyebrow">Members</p>
                  <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">{stats.total}</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Total memberships attached to this workspace
                  </p>
                </div>
                <div className="panel-soft rounded-[28px] px-6 py-6">
                  <p className="eyebrow">Active</p>
                  <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">{stats.active}</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Members who can use the workspace right now
                  </p>
                </div>
                <div className="panel-soft rounded-[28px] px-6 py-6">
                  <p className="eyebrow">Invited</p>
                  <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">{stats.invited}</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Members prepared for access but not fully activated yet
                  </p>
                </div>
                <div className="panel-soft rounded-[28px] px-6 py-6">
                  <p className="eyebrow">Disabled</p>
                  <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">{stats.disabled}</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Members kept out of the workspace until re-enabled
                  </p>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,0.92fr)]">
                <div className="space-y-6">
                  <section className="panel-soft rounded-[28px] px-6 py-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="eyebrow">Team roster</p>
                        <h2 className="mt-3 text-2xl font-bold">Who can do what in this store</h2>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">
                          Owners can manage admins, staff, and viewers. Admins can manage staff and viewers, but not other admins or owners.
                        </p>
                      </div>
                      <div className="rounded-[18px] border border-[rgba(152,164,189,0.12)] bg-[rgba(13,18,28,0.68)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                        Workspace
                        <div className="mt-1 text-base font-semibold text-[var(--text-primary)]">
                          {activeShop.shop.name}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 space-y-4">
                      {members.map((member) => {
                        const roleChoices = getRoleChoices(member.role);
                        return (
                          <div key={member.id} className="surface-muted rounded-[24px] px-5 py-5">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-lg font-semibold text-[var(--text-primary)]">
                                    {member.member_name}
                                  </p>
                                  <span className="rounded-full border border-[rgba(71,176,255,0.16)] bg-[rgba(71,176,255,0.08)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
                                    {member.role_label}
                                  </span>
                                  <span className="rounded-full border border-[rgba(152,164,189,0.12)] bg-[rgba(9,14,22,0.52)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                                    {member.status}
                                  </span>
                                  {member.is_current_user ? (
                                    <span className="rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(77,49,9,0.34)] px-3 py-1 text-xs font-medium text-[var(--warning)]">
                                      You
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                                  {member.member_email}
                                  {member.phone ? ` | ${member.phone}` : ""}
                                </p>
                                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                                  {member.role_summary}
                                </p>
                              </div>

                              {member.can_manage ? (
                                <form action={updateWorkspaceMemberAction} className="grid min-w-[280px] gap-3">
                                  <input type="hidden" name="shopId" value={activeShop.shop.id} />
                                  <input type="hidden" name="membershipId" value={member.id} />
                                  <input type="hidden" name="member" value={member.member_email} />
                                  <label className="block">
                                    <span className="eyebrow">Role</span>
                                    <select
                                      name="role"
                                      defaultValue={member.role}
                                      className="mt-2 w-full rounded-[18px] border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none"
                                    >
                                      {roleChoices.map((choice) => (
                                        <option key={choice.value} value={choice.value}>
                                          {choice.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="block">
                                    <span className="eyebrow">Status</span>
                                    <select
                                      name="status"
                                      defaultValue={member.status}
                                      className="mt-2 w-full rounded-[18px] border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none"
                                    >
                                      <option value="active">Active</option>
                                      <option value="invited">Invited</option>
                                      <option value="disabled">Disabled</option>
                                    </select>
                                  </label>
                                  <button
                                    type="submit"
                                    className="inline-flex items-center justify-center rounded-full border border-[rgba(71,176,255,0.16)] bg-[rgba(71,176,255,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(71,176,255,0.18)]"
                                  >
                                    Save member
                                  </button>
                                </form>
                              ) : (
                                <div className="min-w-[280px] rounded-[20px] border border-[rgba(152,164,189,0.12)] bg-[rgba(13,18,28,0.68)] px-4 py-4 text-sm text-[var(--text-secondary)]">
                                  {member.is_current_user
                                    ? "Use another owner/admin account to change your own workspace role."
                                    : "This membership is outside your current role-control scope."}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <section className="panel-soft rounded-[28px] px-6 py-6">
                    <p className="eyebrow">Add member</p>
                    <h2 className="mt-3 text-2xl font-bold">Invite or attach someone to the store</h2>
                    <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                      Use this to add a new daily operator, a read-only reviewer, or a store admin when the workspace owner needs backup control.
                    </p>
                    <form action={inviteWorkspaceMemberAction} className="mt-5 space-y-4">
                      <input type="hidden" name="shopId" value={activeShop.shop.id} />
                      <label className="block">
                        <span className="eyebrow">Email</span>
                        <input
                          name="email"
                          type="email"
                          required
                          placeholder="operator@example.com"
                          className="mt-2 w-full rounded-[18px] border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                        />
                      </label>
                      <label className="block">
                        <span className="eyebrow">Full name</span>
                        <input
                          name="fullName"
                          type="text"
                          placeholder="Floor Operator"
                          className="mt-2 w-full rounded-[18px] border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                        />
                      </label>
                      <label className="block">
                        <span className="eyebrow">Phone</span>
                        <input
                          name="phone"
                          type="text"
                          placeholder="+91-9999999999"
                          className="mt-2 w-full rounded-[18px] border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                        />
                      </label>
                      <label className="block">
                        <span className="eyebrow">Role</span>
                        <select
                          name="role"
                          defaultValue="staff"
                          className="mt-2 w-full rounded-[18px] border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none"
                        >
                          {role === "owner" ? <option value="admin">Store admin</option> : null}
                          <option value="staff">Staff operator</option>
                          <option value="viewer">Read-only viewer</option>
                        </select>
                      </label>
                      <button
                        type="submit"
                        className="inline-flex items-center rounded-full border border-[rgba(71,176,255,0.16)] bg-[rgba(71,176,255,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(71,176,255,0.18)]"
                      >
                        Save member
                      </button>
                    </form>
                  </section>

                  {canTransferOwnership ? (
                    <section className="panel-soft rounded-[28px] px-6 py-6">
                      <p className="eyebrow">Ownership transfer</p>
                      <h2 className="mt-3 text-2xl font-bold">Move workspace control safely</h2>
                      <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                        Transfer ownership only when the next person should control the business, the workspace plan, and the team. The current owner will move down to a lower role after transfer.
                      </p>
                      {ownershipCandidates.length > 0 ? (
                        <form action={transferWorkspaceOwnershipAction} className="mt-5 space-y-4">
                          <input type="hidden" name="shopId" value={activeShop.shop.id} />
                          <label className="block">
                            <span className="eyebrow">Next owner</span>
                            <select
                              name="targetMembershipId"
                              defaultValue={ownershipCandidates[0]?.id}
                              className="mt-2 w-full rounded-[18px] border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none"
                            >
                              {ownershipCandidates.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.member_name} | {member.role_label} | {member.member_email}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="eyebrow">Your next role</span>
                            <select
                              name="previousOwnerRole"
                              defaultValue="admin"
                              className="mt-2 w-full rounded-[18px] border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none"
                            >
                              <option value="admin">Store admin</option>
                              <option value="staff">Staff operator</option>
                              <option value="viewer">Read-only viewer</option>
                            </select>
                          </label>
                          <label className="block">
                            <span className="eyebrow">Confirm workspace slug</span>
                            <input
                              name="confirmationText"
                              type="text"
                              required
                              placeholder={activeShop.shop.slug}
                              className="mt-2 w-full rounded-[18px] border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                            />
                          </label>
                          <button
                            type="submit"
                            className="inline-flex items-center rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(77,49,9,0.34)] px-4 py-2 text-sm font-semibold text-[var(--warning)] transition hover:bg-[rgba(77,49,9,0.46)]"
                          >
                            Transfer ownership
                          </button>
                        </form>
                      ) : (
                        <div className="mt-5 rounded-[20px] border border-[rgba(152,164,189,0.12)] bg-[rgba(13,18,28,0.68)] px-4 py-4 text-sm text-[var(--text-secondary)]">
                          Add or reactivate another workspace member before transferring ownership.
                        </div>
                      )}
                    </section>
                  ) : null}

                  <section className="panel-soft rounded-[28px] px-6 py-6">
                    <p className="eyebrow">Rules</p>
                    <h2 className="mt-3 text-2xl font-bold">Control stays role-safe</h2>
                    <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                      <li>- Owners can manage admins, staff, and viewers.</li>
                      <li>- Admins can manage staff and viewers, but not owners or other admins.</li>
                      <li>- Nobody can demote or disable their own membership from this screen.</li>
                      <li>- Ownership transfer is owner-only and requires exact workspace-slug confirmation.</li>
                    </ul>
                  </section>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </AdminShell>
  );
}
