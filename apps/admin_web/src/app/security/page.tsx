import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { PasskeyControlPanel } from "@/components/passkey-control-panel";
import {
  beginMfaEnrollmentAction,
  disableMfaAction,
  verifyMfaCodeAction,
} from "@/app/security/actions";
import {
  getSession,
  getUserMfaStatus,
  getUserPasskeys,
  resolveActiveShop,
} from "@/lib/admin-api";
import { getAdminWebMfaPosture } from "@/lib/mfa";
import { canManageWorkspace } from "@/lib/roles";

type SearchParams = Record<string, string | string[] | undefined>;

type SecurityPageProps = {
  searchParams?: Promise<SearchParams>;
};

function getSearchParamValue(searchParams: SearchParams, key: string) {
  const raw = searchParams[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function buildBanner(searchParams: SearchParams) {
  const status = getSearchParamValue(searchParams, "status");
  const message = getSearchParamValue(searchParams, "message");

  if (!status) {
    return null;
  }

  if (status === "pending") {
    return {
      accent:
        "border-[rgba(71,176,255,0.18)] bg-[rgba(11,24,41,0.72)] text-[var(--accent)]" as const,
      title: "Authenticator setup started",
      body: "Scan the QR link or copy the manual secret below, then verify your first code to finish MFA enrollment.",
    };
  }

  if (status === "enabled") {
    return {
      accent:
        "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.76)] text-[var(--success)]" as const,
      title: "MFA is now enabled",
      body: "Sensitive owner/admin surfaces are now unlocked for this verified window.",
    };
  }

  if (status === "verified") {
    return {
      accent:
        "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.76)] text-[var(--success)]" as const,
      title: "MFA verification refreshed",
      body: "Your sensitive admin surfaces are unlocked again for this verification window.",
    };
  }

  if (status === "disabled") {
    return {
      accent:
        "border-[rgba(245,158,11,0.18)] bg-[rgba(77,49,9,0.34)] text-[var(--warning)]" as const,
      title: "MFA disabled",
      body: "Sensitive surfaces will require fresh enrollment before they can open again.",
    };
  }

  return {
    accent:
      "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.76)] text-[var(--warning)]" as const,
    title: "Security action failed",
    body: message || "The MFA action did not complete.",
  };
}

export default async function SecurityPage({ searchParams }: SecurityPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const canUseSecurity =
    session.user.is_platform_admin || canManageWorkspace(activeShop?.role ?? null);
  const mfaStatus = canUseSecurity ? await getUserMfaStatus() : null;
  const passkeys = canUseSecurity ? await getUserPasskeys() : [];
  const mfaPosture = canUseSecurity
    ? await getAdminWebMfaPosture(session.user, true)
    : { required: false, enabled: false, verified: false };
  const banner = buildBanner(resolvedSearchParams);
  const returnTo = getSearchParamValue(resolvedSearchParams, "returnTo") ?? "";

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="security"
      title="Security"
      subtitle="Protect owner/admin controls with a real second factor before plan, team, audit, internal, and advanced financial surfaces open."
    >
      {!canUseSecurity || !mfaStatus ? (
        <EmptyState
          title="Security controls stay with elevated roles"
          body="Daily operators should not handle MFA policy or sensitive owner/admin control surfaces from the admin workspace."
        />
      ) : (
        <div className="space-y-8">
          {banner ? (
            <section className={`panel-soft rounded-[28px] border px-6 py-5 ${banner.accent}`}>
              <p className="eyebrow text-current/70">Security signal</p>
              <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">{banner.title}</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{banner.body}</p>
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="MFA posture"
              value={
                mfaStatus.totp_enabled || mfaStatus.passkey_enabled
                  ? "Enabled"
                  : mfaStatus.totp_pending_enrollment
                    ? "Pending"
                    : "Not set"
              }
              detail="TOTP and passkeys both count as second-factor protection"
              icon="MFA"
            />
            <MetricCard
              label="Verification"
              value={mfaPosture.verified ? "Fresh" : "Needed"}
              detail="Sensitive admin surfaces require a fresh verified window"
              accent={mfaPosture.verified ? "green" : "blue"}
              icon="CHK"
            />
            <MetricCard
              label="Passkeys"
              value={mfaStatus.passkey_count.toString()}
              detail={mfaStatus.passkey_enabled ? "Registered device factors" : "No registered passkeys yet"}
              accent="blue"
              icon="KEY"
            />
            <MetricCard
              label="Window"
              value={`${Math.round(mfaStatus.challenge_window_seconds / 3600)}h`}
              detail="How long a fresh owner/admin verification stays open"
              accent="rose"
              icon="WIN"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
            <div className="space-y-6">
              {!mfaStatus.totp_enabled ? (
                <section className="panel-soft rounded-[28px] px-6 py-6">
                  <p className="eyebrow">Step 1</p>
                  <h2 className="mt-3 text-2xl font-bold">Set up your authenticator app</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Business Hub now requires MFA before owner/admin surfaces can open. Start enrollment, add the secret
                    to your authenticator app, then verify the first code.
                  </p>
                  {!mfaStatus.totp_pending_enrollment ? (
                    <form action={beginMfaEnrollmentAction} className="mt-6">
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <button
                        type="submit"
                        className="inline-flex rounded-full border border-[rgba(92,174,254,0.22)] bg-[rgba(10,36,68,0.82)] px-5 py-2.5 text-sm font-semibold text-[var(--accent)] transition-transform duration-150 hover:-translate-y-0.5"
                      >
                        Start MFA setup
                      </button>
                    </form>
                  ) : (
                    <div className="mt-6 space-y-4">
                      <div className="surface-muted rounded-[22px] px-5 py-5">
                        <p className="eyebrow">Manual secret</p>
                        <p className="mt-3 break-all font-mono text-sm text-[var(--text-primary)]">
                          {mfaStatus.pending_manual_secret}
                        </p>
                      </div>
                      <div className="surface-muted rounded-[22px] px-5 py-5">
                        <p className="eyebrow">Authenticator link</p>
                        <p className="mt-3 break-all text-sm text-[var(--text-secondary)]">
                          {mfaStatus.pending_otpauth_uri}
                        </p>
                      </div>
                      <form action={verifyMfaCodeAction} className="surface-muted rounded-[22px] px-5 py-5">
                        <input type="hidden" name="purpose" value="enroll" />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <label className="block">
                          <span className="eyebrow">Verification code</span>
                          <input
                            name="code"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="123456"
                            className="mt-3 w-full rounded-[18px] border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                          />
                        </label>
                        <button
                          type="submit"
                          className="mt-4 inline-flex rounded-full border border-[rgba(58,215,162,0.18)] bg-[rgba(9,42,31,0.64)] px-5 py-2.5 text-sm font-semibold text-[var(--success)] transition-transform duration-150 hover:-translate-y-0.5"
                        >
                          Verify and enable MFA
                        </button>
                      </form>
                    </div>
                  )}
                </section>
              ) : (
                <section className="panel-soft rounded-[28px] px-6 py-6">
                  <p className="eyebrow">Step 1</p>
                  <h2 className="mt-3 text-2xl font-bold">Refresh your secure access window</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Verify one current MFA code before opening protected owner/admin surfaces like Workspace plan, Team,
                    Sessions, Audit, Migration, and ERPNext control.
                  </p>
                  <form action={verifyMfaCodeAction} className="mt-6 surface-muted rounded-[22px] px-5 py-5">
                    <input type="hidden" name="purpose" value="challenge" />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label className="block">
                      <span className="eyebrow">Verification code</span>
                      <input
                        name="code"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        className="mt-3 w-full rounded-[18px] border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                      />
                    </label>
                    <button
                      type="submit"
                      className="mt-4 inline-flex rounded-full border border-[rgba(58,215,162,0.18)] bg-[rgba(9,42,31,0.64)] px-5 py-2.5 text-sm font-semibold text-[var(--success)] transition-transform duration-150 hover:-translate-y-0.5"
                    >
                      Verify now
                    </button>
                  </form>
                </section>
              )}

              {mfaStatus.totp_enabled ? (
                <section className="panel-soft rounded-[28px] px-6 py-6">
                  <p className="eyebrow">Step 2</p>
                  <h2 className="mt-3 text-2xl font-bold">Disable MFA only if you are replacing the authenticator</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Disabling MFA immediately closes the current secure-access window and forces a new setup before
                    protected owner/admin surfaces can reopen.
                  </p>
                  <form action={disableMfaAction} className="mt-6 surface-muted rounded-[22px] px-5 py-5">
                    <label className="block">
                      <span className="eyebrow">Current code</span>
                      <input
                        name="code"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        className="mt-3 w-full rounded-[18px] border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                      />
                    </label>
                    <button
                      type="submit"
                      className="mt-4 inline-flex rounded-full border border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.76)] px-5 py-2.5 text-sm font-semibold text-[var(--warning)] transition-transform duration-150 hover:-translate-y-0.5"
                    >
                      Disable MFA
                    </button>
                  </form>
                </section>
              ) : null}

              <PasskeyControlPanel
                initialPasskeys={passkeys}
                returnTo={returnTo}
              />
            </div>

            <div className="space-y-6">
              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Protection map</p>
                <h2 className="mt-3 text-2xl font-bold">What MFA protects now</h2>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
                  <li>Workspace plan and upgrade controls</li>
                  <li>Team management and ownership transfer</li>
                  <li>Workspace session revoke / remote wipe</li>
                  <li>Audit trail review</li>
                  <li>Owner/admin payments review</li>
                  <li>Migration and ERPNext internal control pages</li>
                  <li>Matching owner/admin mobile security gates</li>
                </ul>
              </section>

              <section className="panel-soft rounded-[28px] px-6 py-6">
                <p className="eyebrow">Current status</p>
                <h2 className="mt-3 text-2xl font-bold">How your account looks right now</h2>
                <div className="mt-5 space-y-4 text-sm text-[var(--text-secondary)]">
                  <div className="surface-muted rounded-[20px] px-4 py-4">
                    <p className="eyebrow">Enabled at</p>
                    <p className="mt-2 text-base font-semibold text-[var(--text-primary)]">
                      {mfaStatus.enabled_at || "Not enabled"}
                    </p>
                  </div>
                  <div className="surface-muted rounded-[20px] px-4 py-4">
                    <p className="eyebrow">Last verified</p>
                    <p className="mt-2 text-base font-semibold text-[var(--text-primary)]">
                      {mfaStatus.last_verified_at || "No successful challenge yet"}
                    </p>
                  </div>
                  <div className="surface-muted rounded-[20px] px-4 py-4">
                    <p className="eyebrow">Secure window</p>
                    <p className="mt-2 text-base font-semibold text-[var(--text-primary)]">
                      {mfaPosture.verified ? "Open right now" : "Needs verification"}
                    </p>
                  </div>
                  <div className="surface-muted rounded-[20px] px-4 py-4">
                    <p className="eyebrow">Last passkey verification</p>
                    <p className="mt-2 text-base font-semibold text-[var(--text-primary)]">
                      {mfaStatus.passkey_last_verified_at || "No passkey verification yet"}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
