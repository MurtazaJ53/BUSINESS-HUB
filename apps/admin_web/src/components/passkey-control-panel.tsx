"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { buildCreationOptions, buildRequestOptions, encodeBytesToBase64Url } from "@/lib/webauthn";
import type { UserPasskeyCredentialPayload } from "@/lib/types";

type PasskeyControlPanelProps = {
  initialPasskeys: UserPasskeyCredentialPayload[];
  returnTo?: string;
};

type BannerState = {
  tone: "success" | "error" | "info";
  title: string;
  body: string;
} | null;

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not verified yet";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function bannerClasses(tone: NonNullable<BannerState>["tone"]) {
  switch (tone) {
    case "success":
      return "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.76)] text-[var(--success)]";
    case "error":
      return "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.76)] text-[var(--warning)]";
    default:
      return "border-[rgba(71,176,255,0.18)] bg-[rgba(11,24,41,0.72)] text-[var(--accent)]";
  }
}

export function PasskeyControlPanel({
  initialPasskeys,
  returnTo,
}: PasskeyControlPanelProps) {
  const router = useRouter();
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(null);
  const [label, setLabel] = useState("");

  const passkeySupport = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.PublicKeyCredential !== "undefined" &&
      typeof navigator.credentials?.create === "function" &&
      typeof navigator.credentials?.get === "function",
    [],
  );

  async function handleRegisterPasskey() {
    if (!passkeySupport) {
      setBanner({
        tone: "error",
        title: "Passkeys are not available here",
        body: "This browser does not expose the WebAuthn APIs required for Business Hub passkeys.",
      });
      return;
    }

    setBusyAction("register");
    setBanner(null);
    try {
      const beginResponse = await fetch("/api/security/passkeys/register/begin", {
        method: "POST",
      });
      const beginPayload = await beginResponse.json();
      if (!beginResponse.ok) {
        throw new Error(beginPayload.error || "Unable to start passkey registration.");
      }

      const credential = await navigator.credentials.create({
        publicKey: buildCreationOptions(beginPayload),
      });
      if (!(credential instanceof PublicKeyCredential)) {
        throw new Error("The browser did not return a valid public-key credential.");
      }

      const response = credential.response;
      if (!(response instanceof AuthenticatorAttestationResponse)) {
        throw new Error("The browser returned an unexpected registration response.");
      }

      const finishResponse = await fetch("/api/security/passkeys/register/finish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challenge_token: beginPayload.challenge_token,
          credential_id: encodeBytesToBase64Url(credential.rawId),
          client_data_json: encodeBytesToBase64Url(response.clientDataJSON),
          attestation_object: encodeBytesToBase64Url(response.attestationObject),
          transports:
            typeof response.getTransports === "function"
              ? response.getTransports()
              : [],
          label: label.trim(),
        }),
      });
      const finishPayload = await finishResponse.json();
      if (!finishResponse.ok) {
        throw new Error(finishPayload.error || "Unable to finish passkey registration.");
      }

      const nextPasskeys = [finishPayload.credential, ...passkeys];
      setPasskeys(nextPasskeys);
      setLabel("");
      setBanner({
        tone: "success",
        title: "Passkey registered",
        body: "This device can now refresh owner/admin access without typing a TOTP code.",
      });
      router.refresh();
    } catch (error) {
      setBanner({
        tone: "error",
        title: "Passkey registration failed",
        body:
          error instanceof Error
            ? error.message
            : "The browser could not complete the passkey setup.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleVerifyPasskey() {
    if (!passkeySupport) {
      setBanner({
        tone: "error",
        title: "Passkeys are not available here",
        body: "This browser does not expose the WebAuthn APIs required for Business Hub passkeys.",
      });
      return;
    }

    setBusyAction("verify");
    setBanner(null);
    try {
      const beginResponse = await fetch("/api/security/passkeys/verify/begin", {
        method: "POST",
      });
      const beginPayload = await beginResponse.json();
      if (!beginResponse.ok) {
        throw new Error(beginPayload.error || "Unable to start passkey verification.");
      }

      const assertion = await navigator.credentials.get({
        publicKey: buildRequestOptions(beginPayload),
      });
      if (!(assertion instanceof PublicKeyCredential)) {
        throw new Error("The browser did not return a valid passkey assertion.");
      }
      const response = assertion.response;
      if (!(response instanceof AuthenticatorAssertionResponse)) {
        throw new Error("The browser returned an unexpected passkey verification response.");
      }

      const finishResponse = await fetch("/api/security/passkeys/verify/finish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challenge_token: beginPayload.challenge_token,
          credential_id: encodeBytesToBase64Url(assertion.rawId),
          client_data_json: encodeBytesToBase64Url(response.clientDataJSON),
          authenticator_data: encodeBytesToBase64Url(response.authenticatorData),
          signature: encodeBytesToBase64Url(response.signature),
        }),
      });
      const finishPayload = await finishResponse.json();
      if (!finishResponse.ok) {
        throw new Error(finishPayload.error || "Unable to finish passkey verification.");
      }

      setPasskeys((currentPasskeys) =>
        currentPasskeys.map((passkey) =>
          passkey.id === finishPayload.credential.id
            ? finishPayload.credential
            : passkey,
        ),
      );
      setBanner({
        tone: "success",
        title: "Secure window opened",
        body: "Protected owner/admin surfaces are now unlocked through your passkey verification window.",
      });
      router.refresh();
      if (returnTo) {
        router.push(returnTo);
      }
    } catch (error) {
      setBanner({
        tone: "error",
        title: "Passkey verification failed",
        body:
          error instanceof Error
            ? error.message
            : "The browser could not complete passkey verification.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRemovePasskey(passkeyId: string) {
    setBusyAction(`delete:${passkeyId}`);
    setBanner(null);
    try {
      const response = await fetch(`/api/security/passkeys/${passkeyId}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to remove this passkey.");
      }
      setPasskeys((currentPasskeys) =>
        currentPasskeys.filter((passkey) => passkey.id !== passkeyId),
      );
      setBanner({
        tone: "info",
        title: "Passkey removed",
        body: "That device will no longer be able to refresh the owner/admin access window.",
      });
      router.refresh();
    } catch (error) {
      setBanner({
        tone: "error",
        title: "Passkey removal failed",
        body:
          error instanceof Error
            ? error.message
            : "The selected passkey could not be removed.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6">
      {banner ? (
        <section className={`panel-soft rounded-[24px] border px-5 py-5 ${bannerClasses(banner.tone)}`}>
          <p className="eyebrow text-current/70">Passkey signal</p>
          <h3 className="mt-3 text-xl font-bold text-[var(--text-primary)]">{banner.title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{banner.body}</p>
        </section>
      ) : null}

      <section className="panel-soft rounded-[28px] px-6 py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="eyebrow">Passkeys</p>
            <h2 className="mt-3 text-2xl font-bold">Use this device as a second factor</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Register a passkey so owner/admin surfaces can be unlocked with the device itself instead of only typing TOTP codes.
            </p>
          </div>
          <span className="rounded-full border border-[rgba(71,176,255,0.16)] bg-[rgba(71,176,255,0.08)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
            {passkeys.length} registered
          </span>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="surface-muted rounded-[22px] px-5 py-5">
            <p className="eyebrow">Register this device</p>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Optional label</span>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Office laptop"
                className="mt-3 w-full rounded-[18px] border border-[rgba(152,164,189,0.14)] bg-[rgba(8,14,24,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
            </label>
            <button
              type="button"
              onClick={handleRegisterPasskey}
              disabled={busyAction !== null}
              className="mt-4 inline-flex rounded-full border border-[rgba(71,176,255,0.18)] bg-[rgba(10,36,68,0.82)] px-5 py-2.5 text-sm font-semibold text-[var(--accent)] transition-transform duration-150 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyAction === "register" ? "Registering..." : "Register passkey"}
            </button>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Best for devices you personally control. Shared cashier hardware should stay on the simpler daily operator path instead.
            </p>
          </div>

          <div className="surface-muted rounded-[22px] px-5 py-5">
            <p className="eyebrow">Verify protected surfaces</p>
            <h3 className="mt-3 text-lg font-bold text-[var(--text-primary)]">
              Open the secure owner/admin window with a passkey
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Use a registered passkey to unlock Workspace plan, Team, Sessions, Audit, Migration, ERPNext, and other protected control surfaces.
            </p>
            <button
              type="button"
              onClick={handleVerifyPasskey}
              disabled={busyAction !== null || passkeys.length === 0}
              className="mt-4 inline-flex rounded-full border border-[rgba(58,215,162,0.18)] bg-[rgba(9,42,31,0.64)] px-5 py-2.5 text-sm font-semibold text-[var(--success)] transition-transform duration-150 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyAction === "verify" ? "Verifying..." : "Verify with passkey"}
            </button>
          </div>
        </div>
      </section>

      <section className="panel-soft rounded-[28px] px-6 py-6">
        <p className="eyebrow">Registered devices</p>
        <h2 className="mt-3 text-2xl font-bold">Passkey inventory</h2>
        <div className="mt-6 space-y-4">
          {passkeys.length ? (
            passkeys.map((passkey) => (
              <article key={passkey.id} className="surface-muted rounded-[22px] px-5 py-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-[var(--text-primary)]">
                        {passkey.label || "Unnamed passkey"}
                      </p>
                      <span className="rounded-full border border-[rgba(152,164,189,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                        {passkey.transports_json.join(", ") || "local device"}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
                      <p>Last verified: {formatDateTime(passkey.last_verified_at)}</p>
                      <p>Counter: {passkey.sign_count}</p>
                      <p className="break-all">Credential: {passkey.credential_id}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemovePasskey(passkey.id)}
                    disabled={busyAction !== null}
                    className="inline-flex items-center justify-center rounded-full border border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.76)] px-4 py-2 text-sm font-semibold text-[var(--warning)] transition hover:bg-[rgba(57,15,26,0.84)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === `delete:${passkey.id}` ? "Removing..." : "Remove"}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">
              No passkeys are registered yet for this owner/admin account.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
