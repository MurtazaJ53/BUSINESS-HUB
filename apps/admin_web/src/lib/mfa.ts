import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import type { SessionUser } from "@/lib/types";

export const MFA_COOKIE_NAME = "business_hub_admin_mfa";
const MFA_COOKIE_SEPARATOR = "|";

type AdminWebMfaPosture = {
  required: boolean;
  enabled: boolean;
  verified: boolean;
};

function getMfaCookieSecret() {
  return (
    process.env.BUSINESS_HUB_ADMIN_MFA_SECRET?.trim() ||
    process.env.BUSINESS_HUB_API_BASE_URL?.trim() ||
    "business-hub-admin-mfa-dev-secret"
  );
}

function createSignature(userId: string, enabledAt: string, verifiedUntil: string) {
  return createHmac("sha256", getMfaCookieSecret())
    .update(`v1:${userId}:${enabledAt}:${verifiedUntil}`)
    .digest("hex");
}

export async function getAdminWebMfaPosture(
  user: SessionUser,
  required: boolean,
): Promise<AdminWebMfaPosture> {
  if (!required) {
    return { required: false, enabled: user.mfa_totp_enabled, verified: true };
  }

  if (!user.mfa_totp_enabled || !user.mfa_totp_enabled_at) {
    return { required: true, enabled: false, verified: false };
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(MFA_COOKIE_NAME)?.value ?? "";
  if (!raw) {
    return { required: true, enabled: true, verified: false };
  }

  const [userId, enabledAt, verifiedUntil, signature] = raw.split(MFA_COOKIE_SEPARATOR);
  if (!userId || !enabledAt || !verifiedUntil || !signature) {
    return { required: true, enabled: true, verified: false };
  }

  if (userId !== user.id || enabledAt !== user.mfa_totp_enabled_at) {
    return { required: true, enabled: true, verified: false };
  }

  const expected = createSignature(userId, enabledAt, verifiedUntil);
  const isSignatureValid =
    expected.length === signature.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!isSignatureValid) {
    return { required: true, enabled: true, verified: false };
  }

  const verifiedUntilDate = new Date(verifiedUntil);
  if (Number.isNaN(verifiedUntilDate.getTime()) || verifiedUntilDate.getTime() <= Date.now()) {
    return { required: true, enabled: true, verified: false };
  }

  return { required: true, enabled: true, verified: true };
}

export async function setAdminWebMfaCookie(options: {
  userId: string;
  enabledAt: string;
  verifiedUntil: string;
}) {
  const cookieStore = await cookies();
  const signature = createSignature(options.userId, options.enabledAt, options.verifiedUntil);
  cookieStore.set(
    MFA_COOKIE_NAME,
    `${options.userId}${MFA_COOKIE_SEPARATOR}${options.enabledAt}${MFA_COOKIE_SEPARATOR}${options.verifiedUntil}${MFA_COOKIE_SEPARATOR}${signature}`,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(options.verifiedUntil),
    },
  );
}

export async function clearAdminWebMfaCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(MFA_COOKIE_NAME);
}
