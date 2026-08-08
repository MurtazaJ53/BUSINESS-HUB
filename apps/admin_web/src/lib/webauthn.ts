import type { UserPasskeyBeginPayload } from "@/lib/types";

function padBase64(value: string) {
  return value + "=".repeat((4 - (value.length % 4 || 4)) % 4);
}

export function decodeBase64UrlToBytes(value: string) {
  const binary = atob(padBase64(value.replace(/-/g, "+").replace(/_/g, "/")));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function encodeBytesToBase64Url(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function buildCreationOptions(payload: UserPasskeyBeginPayload) {
  const options = payload.options;
  return {
    challenge: decodeBase64UrlToBytes(options.challenge),
    rp: options.rp,
    user: options.user
      ? {
          ...options.user,
          id: decodeBase64UrlToBytes(options.user.id),
        }
      : undefined,
    pubKeyCredParams: options.pubKeyCredParams ?? [],
    timeout: options.timeout,
    attestation: options.attestation as AttestationConveyancePreference | undefined,
    authenticatorSelection: options.authenticatorSelection
      ? {
          residentKey:
            options.authenticatorSelection.residentKey as ResidentKeyRequirement | undefined,
          userVerification:
            options.authenticatorSelection.userVerification as
              | UserVerificationRequirement
              | undefined,
        }
      : undefined,
    excludeCredentials: (options.excludeCredentials ?? []).map((credential) => ({
      type: credential.type,
      id: decodeBase64UrlToBytes(credential.id),
      transports: credential.transports as AuthenticatorTransport[] | undefined,
    })),
  } as PublicKeyCredentialCreationOptions;
}

export function buildRequestOptions(payload: UserPasskeyBeginPayload) {
  const options = payload.options;
  return {
    challenge: decodeBase64UrlToBytes(options.challenge),
    rpId: options.rpId,
    timeout: options.timeout,
    userVerification:
      options.userVerification as UserVerificationRequirement | undefined,
    allowCredentials: (options.allowCredentials ?? []).map((credential) => ({
      type: credential.type,
      id: decodeBase64UrlToBytes(credential.id),
      transports: credential.transports as AuthenticatorTransport[] | undefined,
    })),
  } as PublicKeyCredentialRequestOptions;
}
