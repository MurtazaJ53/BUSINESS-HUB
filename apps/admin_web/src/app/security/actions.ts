"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { apiMutation, getSession } from "@/lib/admin-api";
import { clearAdminWebMfaCookie, setAdminWebMfaCookie } from "@/lib/mfa";
import type { UserMfaStatusPayload, UserMfaVerifyPayload } from "@/lib/types";

function getOptionalField(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getRequiredField(formData: FormData, key: string, label: string) {
  const value = getOptionalField(formData, key);
  if (!value) {
    throw new Error(`Missing ${label}.`);
  }
  return value;
}

function buildRedirectUrl(params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return `/security?${searchParams.toString()}`;
}

export async function beginMfaEnrollmentAction(formData: FormData) {
  const returnTo = getOptionalField(formData, "returnTo");
  try {
    await apiMutation<UserMfaStatusPayload>("/session/mfa/enroll/", {
      method: "POST",
      body: {},
    });
    revalidatePath("/security");
    redirect(
      buildRedirectUrl({
        status: "pending",
        returnTo,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 220) : "MFA setup failed.";
    redirect(buildRedirectUrl({ status: "error", message, returnTo }));
  }
}

export async function verifyMfaCodeAction(formData: FormData) {
  const purpose = getRequiredField(formData, "purpose", "purpose");
  const code = getRequiredField(formData, "code", "authentication code");
  const returnTo = getOptionalField(formData, "returnTo");

  try {
    const result = await apiMutation<UserMfaVerifyPayload>("/session/mfa/verify/", {
      method: "POST",
      body: { purpose, code },
    });
    const session = await getSession();
    if (!session.user.mfa_totp_enabled_at && !result.status.enabled_at) {
      throw new Error("MFA verification completed without an enabled timestamp.");
    }
    await setAdminWebMfaCookie({
      userId: session.user.id,
      enabledAt: result.status.enabled_at || session.user.mfa_totp_enabled_at || result.verified_at,
      verifiedUntil: result.verified_until,
    });
    revalidatePath("/security");
    redirect(
      returnTo || buildRedirectUrl({ status: purpose === "enroll" ? "enabled" : "verified" }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 220) : "MFA verification failed.";
    redirect(
      buildRedirectUrl({
        status: "error",
        purpose,
        message,
        returnTo,
      }),
    );
  }
}

export async function disableMfaAction(formData: FormData) {
  const code = getRequiredField(formData, "code", "authentication code");

  try {
    await apiMutation<UserMfaStatusPayload>("/session/mfa/disable/", {
      method: "POST",
      body: { code },
    });
    await clearAdminWebMfaCookie();
    revalidatePath("/security");
    redirect(buildRedirectUrl({ status: "disabled" }));
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 220) : "MFA disable failed.";
    redirect(buildRedirectUrl({ status: "error", message }));
  }
}
