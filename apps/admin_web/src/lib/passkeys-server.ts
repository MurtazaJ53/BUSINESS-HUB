import "server-only";

import { apiFetch, apiMutation, getSession, resolveActiveShop } from "@/lib/admin-api";
import { canManageWorkspace } from "@/lib/roles";
import type {
  UserPasskeyBeginPayload,
  UserPasskeyCredentialPayload,
  UserPasskeyVerifyPayload,
} from "@/lib/types";

async function assertPasskeySecurityAccess() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);
  const canUseSecurity =
    session.user.is_platform_admin || canManageWorkspace(activeShop?.role ?? null);
  if (!canUseSecurity) {
    throw new Error("Passkey controls stay with owner/admin roles.");
  }
  return session;
}

export async function getUserPasskeysServer() {
  await assertPasskeySecurityAccess();
  return apiFetch<UserPasskeyCredentialPayload[]>("/session/passkeys/");
}

export async function beginUserPasskeyRegistrationServer() {
  await assertPasskeySecurityAccess();
  return apiMutation<UserPasskeyBeginPayload>("/session/passkeys/register/begin/", {
    method: "POST",
    body: {},
  });
}

export async function finishUserPasskeyRegistrationServer(body: unknown) {
  await assertPasskeySecurityAccess();
  return apiMutation<{
    credential: UserPasskeyCredentialPayload;
  }>("/session/passkeys/register/finish/", {
    method: "POST",
    body,
  });
}

export async function beginUserPasskeyVerificationServer() {
  await assertPasskeySecurityAccess();
  return apiMutation<UserPasskeyBeginPayload>("/session/passkeys/verify/begin/", {
    method: "POST",
    body: {},
  });
}

export async function finishUserPasskeyVerificationServer(body: unknown) {
  const session = await assertPasskeySecurityAccess();
  const result = await apiMutation<UserPasskeyVerifyPayload>("/session/passkeys/verify/finish/", {
    method: "POST",
    body,
  });
  return { session, result };
}

export async function deleteUserPasskeyServer(passkeyId: string) {
  await assertPasskeySecurityAccess();
  return apiMutation<{
    credential: UserPasskeyCredentialPayload;
  }>(`/session/passkeys/${passkeyId}/`, {
    method: "DELETE",
  });
}
