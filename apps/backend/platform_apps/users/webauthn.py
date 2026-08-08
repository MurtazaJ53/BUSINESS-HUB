from __future__ import annotations

import base64
import hashlib
import json
import secrets
import struct
import uuid
from datetime import timedelta
from dataclasses import dataclass
from typing import Any

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, ed25519, rsa
from cryptography.hazmat.primitives.asymmetric.padding import PKCS1v15
from django.conf import settings
from django.core import signing
from django.utils import timezone
from rest_framework import serializers

from platform_apps.users.models import PlatformUser, UserPasskeyCredential


WEBAUTHN_CHALLENGE_TTL_SECONDS = 5 * 60
WEBAUTHN_VERIFY_WINDOW_SECONDS = 8 * 60 * 60
WEBAUTHN_CHALLENGE_BYTES = 32
WEBAUTHN_SIGNER_SALT = "platform_apps.users.webauthn"


def webauthn_b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def webauthn_b64decode(value: str) -> bytes:
    compact = value.strip()
    padding = "=" * ((4 - len(compact) % 4) % 4)
    return base64.urlsafe_b64decode(f"{compact}{padding}")


def generate_webauthn_challenge() -> str:
    return webauthn_b64encode(secrets.token_bytes(WEBAUTHN_CHALLENGE_BYTES))


def build_webauthn_challenge_token(
    *,
    user: PlatformUser,
    purpose: str,
    challenge: str,
) -> str:
    payload = json.dumps(
        {
            "user_id": str(user.id),
            "purpose": purpose,
            "challenge": challenge,
        },
        separators=(",", ":"),
        sort_keys=True,
    )
    signer = signing.TimestampSigner(salt=WEBAUTHN_SIGNER_SALT)
    return signer.sign(payload)


def read_webauthn_challenge_token(
    *,
    user: PlatformUser,
    token: str,
    expected_purpose: str,
) -> dict[str, str]:
    signer = signing.TimestampSigner(salt=WEBAUTHN_SIGNER_SALT)
    try:
        unsigned = signer.unsign(token, max_age=WEBAUTHN_CHALLENGE_TTL_SECONDS)
    except signing.BadSignature as exc:
        raise serializers.ValidationError(
            {"challenge_token": "The passkey challenge is missing or expired."}
        ) from exc

    try:
        payload = json.loads(unsigned)
    except json.JSONDecodeError as exc:
        raise serializers.ValidationError(
            {"challenge_token": "The passkey challenge payload is invalid."}
        ) from exc

    if payload.get("user_id") != str(user.id):
        raise serializers.ValidationError(
            {"challenge_token": "This passkey challenge does not belong to the current account."}
        )
    if payload.get("purpose") != expected_purpose:
        raise serializers.ValidationError(
            {"challenge_token": "This passkey challenge does not match the requested action."}
        )
    return {
        "challenge": str(payload.get("challenge") or ""),
        "purpose": str(payload.get("purpose") or ""),
    }


def get_webauthn_rp_id() -> str:
    configured = getattr(settings, "BUSINESS_HUB_WEBAUTHN_RP_ID", "").strip()
    if configured:
        return configured

    for host in getattr(settings, "ALLOWED_HOSTS", []):
        normalized = str(host).strip()
        if normalized and normalized not in {"*", "testserver"}:
            return normalized
    return "localhost"


def get_webauthn_rp_name() -> str:
    return getattr(settings, "BUSINESS_HUB_WEBAUTHN_RP_NAME", "Business Hub").strip() or "Business Hub"


def get_webauthn_allowed_origins() -> list[str]:
    configured = getattr(settings, "BUSINESS_HUB_WEBAUTHN_ALLOWED_ORIGINS", [])
    normalized = [str(origin).rstrip("/").strip() for origin in configured if str(origin).strip()]
    if normalized:
        return normalized
    return ["http://localhost:3000", "http://127.0.0.1:3000"]


def build_passkey_registration_options(*, user: PlatformUser) -> dict[str, Any]:
    challenge = generate_webauthn_challenge()
    token = build_webauthn_challenge_token(
        user=user,
        purpose="register",
        challenge=challenge,
    )
    exclude_credentials = [
        {
            "type": "public-key",
            "id": credential.credential_id,
            "transports": list(credential.transports_json or []),
        }
        for credential in user.passkeys.filter(is_active=True).order_by("-updated_at")
    ]
    return {
        "challenge_token": token,
        "options": {
            "challenge": challenge,
            "rp": {
                "name": get_webauthn_rp_name(),
                "id": get_webauthn_rp_id(),
            },
            "user": {
                "id": webauthn_b64encode(str(user.id).encode("utf-8")),
                "name": user.email,
                "displayName": user.full_name or user.email,
            },
            "pubKeyCredParams": [
                {"type": "public-key", "alg": -7},
                {"type": "public-key", "alg": -8},
                {"type": "public-key", "alg": -257},
            ],
            "timeout": 60000,
            "attestation": "none",
            "authenticatorSelection": {
                "residentKey": "preferred",
                "userVerification": "preferred",
            },
            "excludeCredentials": exclude_credentials,
        },
    }


def build_passkey_authentication_options(*, user: PlatformUser) -> dict[str, Any]:
    challenge = generate_webauthn_challenge()
    token = build_webauthn_challenge_token(
        user=user,
        purpose="authenticate",
        challenge=challenge,
    )
    allow_credentials = [
        {
            "type": "public-key",
            "id": credential.credential_id,
            "transports": list(credential.transports_json or []),
        }
        for credential in user.passkeys.filter(is_active=True).order_by("-last_verified_at", "-updated_at")
    ]
    return {
        "challenge_token": token,
        "options": {
            "challenge": challenge,
            "rpId": get_webauthn_rp_id(),
            "timeout": 60000,
            "userVerification": "preferred",
            "allowCredentials": allow_credentials,
        },
    }


@dataclass(slots=True)
class ParsedClientData:
    type: str
    challenge: str
    origin: str
    raw_json: bytes


@dataclass(slots=True)
class ParsedAttestation:
    credential_id: str
    public_key_spki: bytes
    cose_algorithm: int
    sign_count: int
    aaguid: str


@dataclass(slots=True)
class ParsedAssertion:
    sign_count: int
    authenticator_data: bytes


def parse_client_data_json(
    *,
    encoded_client_data_json: str,
    expected_type: str,
    expected_challenge: str,
) -> ParsedClientData:
    try:
        raw_json = webauthn_b64decode(encoded_client_data_json)
        payload = json.loads(raw_json.decode("utf-8"))
    except Exception as exc:
        raise serializers.ValidationError(
            {"client_data_json": "The passkey client data payload is invalid."}
        ) from exc

    challenge = str(payload.get("challenge") or "")
    credential_type = str(payload.get("type") or "")
    origin = str(payload.get("origin") or "").rstrip("/")

    if credential_type != expected_type:
        raise serializers.ValidationError(
            {"client_data_json": "The passkey response type does not match the requested action."}
        )
    if challenge != expected_challenge:
        raise serializers.ValidationError(
            {"client_data_json": "The passkey challenge does not match the expected value."}
        )
    if origin not in get_webauthn_allowed_origins():
        raise serializers.ValidationError(
            {"client_data_json": "The passkey origin is not trusted for this workspace."}
        )

    return ParsedClientData(
        type=credential_type,
        challenge=challenge,
        origin=origin,
        raw_json=raw_json,
    )


def register_passkey_credential(
    *,
    user: PlatformUser,
    challenge_token: str,
    credential_id: str,
    client_data_json: str,
    attestation_object: str,
    transports: list[str] | None = None,
    label: str = "",
) -> UserPasskeyCredential:
    token_payload = read_webauthn_challenge_token(
        user=user,
        token=challenge_token,
        expected_purpose="register",
    )
    parse_client_data_json(
        encoded_client_data_json=client_data_json,
        expected_type="webauthn.create",
        expected_challenge=token_payload["challenge"],
    )
    parsed = parse_attestation_object(attestation_object)
    normalized_credential_id = credential_id.strip()
    if normalized_credential_id != parsed.credential_id:
        raise serializers.ValidationError(
            {"credential_id": "The passkey credential id does not match the authenticator payload."}
        )
    if UserPasskeyCredential.objects.filter(credential_id=normalized_credential_id).exists():
        raise serializers.ValidationError(
            {"credential_id": "This passkey is already registered for a Business Hub account."}
        )

    return UserPasskeyCredential.objects.create(
        user=user,
        label=label.strip()[:255],
        credential_id=normalized_credential_id,
        public_key_spki=webauthn_b64encode(parsed.public_key_spki),
        cose_algorithm=parsed.cose_algorithm,
        sign_count=parsed.sign_count,
        transports_json=list(transports or []),
        aaguid=parsed.aaguid,
        last_verified_at=timezone.now(),
        is_active=True,
    )


def verify_passkey_assertion(
    *,
    user: PlatformUser,
    challenge_token: str,
    credential_id: str,
    client_data_json: str,
    authenticator_data: str,
    signature: str,
) -> dict[str, Any]:
    token_payload = read_webauthn_challenge_token(
        user=user,
        token=challenge_token,
        expected_purpose="authenticate",
    )
    parsed_client = parse_client_data_json(
        encoded_client_data_json=client_data_json,
        expected_type="webauthn.get",
        expected_challenge=token_payload["challenge"],
    )
    credential = user.passkeys.filter(
        credential_id=credential_id.strip(),
        is_active=True,
    ).first()
    if credential is None:
        raise serializers.ValidationError(
            {"credential_id": "The selected passkey is not active for this account."}
        )

    parsed_assertion = parse_assertion_authenticator_data(
        encoded_authenticator_data=authenticator_data,
    )
    signed_data = parsed_assertion.authenticator_data + hashlib.sha256(
        parsed_client.raw_json
    ).digest()
    verify_passkey_signature(
        encoded_public_key_spki=credential.public_key_spki,
        cose_algorithm=credential.cose_algorithm,
        signature=webauthn_b64decode(signature),
        signed_data=signed_data,
    )

    if credential.sign_count and parsed_assertion.sign_count:
        if parsed_assertion.sign_count <= credential.sign_count:
            raise serializers.ValidationError(
                {"signature": "The passkey counter did not advance as expected."}
            )

    credential.sign_count = max(credential.sign_count, parsed_assertion.sign_count)
    credential.last_verified_at = timezone.now()
    credential.save(update_fields=["sign_count", "last_verified_at", "updated_at"])

    now = timezone.now()
    return {
        "credential": credential,
        "verified_at": now,
        "verified_until": now + timedelta(seconds=WEBAUTHN_VERIFY_WINDOW_SECONDS),
    }


def delete_passkey_credential(*, user: PlatformUser, passkey_id: uuid.UUID) -> UserPasskeyCredential:
    credential = user.passkeys.filter(id=passkey_id, is_active=True).first()
    if credential is None:
        raise serializers.ValidationError(
            {"passkey_id": "That passkey could not be found for this account."}
        )
    credential.is_active = False
    credential.save(update_fields=["is_active", "updated_at"])
    return credential


def build_mfa_security_stamp(user: PlatformUser) -> str:
    active_passkeys = user.passkeys.filter(is_active=True).order_by("-updated_at")
    passkey_count = active_passkeys.count()
    latest_passkey_update = active_passkeys.values_list("updated_at", flat=True).first()
    latest_passkey_update_text = latest_passkey_update.isoformat() if latest_passkey_update else "off"
    totp_stamp = user.mfa_totp_enabled_at.isoformat() if user.mfa_totp_enabled_at else "off"
    return f"totp:{totp_stamp}|passkeys:{passkey_count}|passkey-updated:{latest_passkey_update_text}"


def build_passkey_summary(user: PlatformUser) -> dict[str, Any]:
    active_passkeys = list(
        user.passkeys.filter(is_active=True).order_by("-last_verified_at", "-updated_at")
    )
    last_verified_at = next(
        (credential.last_verified_at for credential in active_passkeys if credential.last_verified_at),
        None,
    )
    return {
        "passkey_enabled": bool(active_passkeys),
        "passkey_count": len(active_passkeys),
        "passkey_last_verified_at": last_verified_at,
    }


def parse_attestation_object(encoded_attestation_object: str) -> ParsedAttestation:
    try:
        attestation_bytes = webauthn_b64decode(encoded_attestation_object)
        payload, consumed = decode_cbor(attestation_bytes)
    except Exception as exc:
        raise serializers.ValidationError(
            {"attestation_object": "The passkey attestation payload is invalid."}
        ) from exc

    if consumed != len(attestation_bytes) or not isinstance(payload, dict):
        raise serializers.ValidationError(
            {"attestation_object": "The passkey attestation payload could not be decoded."}
        )

    auth_data = payload.get("authData")
    if not isinstance(auth_data, bytes):
        raise serializers.ValidationError(
            {"attestation_object": "The passkey attestation payload is missing authenticator data."}
        )
    return parse_attested_auth_data(auth_data)


def parse_assertion_authenticator_data(*, encoded_authenticator_data: str) -> ParsedAssertion:
    try:
        authenticator_data = webauthn_b64decode(encoded_authenticator_data)
    except Exception as exc:
        raise serializers.ValidationError(
            {"authenticator_data": "The passkey authenticator data is invalid."}
        ) from exc

    rp_hash, flags, sign_count = parse_basic_authenticator_data(authenticator_data)
    expected_rp_hash = hashlib.sha256(get_webauthn_rp_id().encode("utf-8")).digest()
    if rp_hash != expected_rp_hash:
        raise serializers.ValidationError(
            {"authenticator_data": "The passkey rp id hash does not match this workspace."}
        )
    if not flags & 0x01:
        raise serializers.ValidationError(
            {"authenticator_data": "The passkey assertion did not confirm user presence."}
        )
    return ParsedAssertion(
        sign_count=sign_count,
        authenticator_data=authenticator_data,
    )


def parse_attested_auth_data(auth_data: bytes) -> ParsedAttestation:
    rp_hash, flags, sign_count = parse_basic_authenticator_data(auth_data)
    expected_rp_hash = hashlib.sha256(get_webauthn_rp_id().encode("utf-8")).digest()
    if rp_hash != expected_rp_hash:
        raise serializers.ValidationError(
            {"attestation_object": "The passkey rp id hash does not match this workspace."}
        )
    if not flags & 0x01:
        raise serializers.ValidationError(
            {"attestation_object": "The passkey registration did not confirm user presence."}
        )
    if not flags & 0x40:
        raise serializers.ValidationError(
            {"attestation_object": "The passkey registration is missing attested credential data."}
        )

    index = 37
    if len(auth_data) < index + 18:
        raise serializers.ValidationError(
            {"attestation_object": "The passkey registration payload is truncated."}
        )
    aaguid_bytes = auth_data[index : index + 16]
    index += 16
    credential_id_length = struct.unpack(">H", auth_data[index : index + 2])[0]
    index += 2
    credential_id_bytes = auth_data[index : index + credential_id_length]
    index += credential_id_length
    if len(credential_id_bytes) != credential_id_length:
        raise serializers.ValidationError(
            {"attestation_object": "The passkey credential id is truncated."}
        )

    cose_key, consumed = decode_cbor(auth_data, index)
    if not isinstance(cose_key, dict) or consumed <= index:
        raise serializers.ValidationError(
            {"attestation_object": "The passkey public key is missing from the attested data."}
        )
    public_key_spki, cose_algorithm = cose_key_to_spki(cose_key)

    return ParsedAttestation(
        credential_id=webauthn_b64encode(credential_id_bytes),
        public_key_spki=public_key_spki,
        cose_algorithm=cose_algorithm,
        sign_count=sign_count,
        aaguid=str(uuid.UUID(bytes=aaguid_bytes)),
    )


def parse_basic_authenticator_data(auth_data: bytes) -> tuple[bytes, int, int]:
    if len(auth_data) < 37:
        raise serializers.ValidationError(
            {"authenticator_data": "The passkey authenticator data is too short."}
        )
    rp_hash = auth_data[:32]
    flags = auth_data[32]
    sign_count = struct.unpack(">I", auth_data[33:37])[0]
    return rp_hash, flags, sign_count


def decode_cbor(data: bytes, offset: int = 0) -> tuple[Any, int]:
    if offset >= len(data):
        raise ValueError("Unexpected end of CBOR payload.")

    initial = data[offset]
    major_type = initial >> 5
    additional = initial & 0x1F
    offset += 1

    if major_type in {0, 1}:
        value, offset = _read_cbor_argument(data, offset, additional)
        return (value if major_type == 0 else -1 - value), offset
    if major_type == 2:
        length, offset = _read_cbor_argument(data, offset, additional)
        end = offset + length
        if end > len(data):
            raise ValueError("CBOR byte string exceeds payload length.")
        return data[offset:end], end
    if major_type == 3:
        length, offset = _read_cbor_argument(data, offset, additional)
        end = offset + length
        if end > len(data):
            raise ValueError("CBOR text string exceeds payload length.")
        return data[offset:end].decode("utf-8"), end
    if major_type == 4:
        length, offset = _read_cbor_argument(data, offset, additional)
        values: list[Any] = []
        for _ in range(length):
            item, offset = decode_cbor(data, offset)
            values.append(item)
        return values, offset
    if major_type == 5:
        length, offset = _read_cbor_argument(data, offset, additional)
        value: dict[Any, Any] = {}
        for _ in range(length):
            key, offset = decode_cbor(data, offset)
            item, offset = decode_cbor(data, offset)
            value[key] = item
        return value, offset
    if major_type == 7 and additional == 20:
        return False, offset
    if major_type == 7 and additional == 21:
        return True, offset
    if major_type == 7 and additional == 22:
        return None, offset

    raise ValueError(f"Unsupported CBOR major type {major_type}.")


def _read_cbor_argument(data: bytes, offset: int, additional: int) -> tuple[int, int]:
    if additional < 24:
        return additional, offset
    if additional == 24:
        end = offset + 1
        return data[offset], end
    if additional == 25:
        end = offset + 2
        return struct.unpack(">H", data[offset:end])[0], end
    if additional == 26:
        end = offset + 4
        return struct.unpack(">I", data[offset:end])[0], end
    if additional == 27:
        end = offset + 8
        return struct.unpack(">Q", data[offset:end])[0], end
    raise ValueError("Unsupported indefinite CBOR value.")


def cose_key_to_spki(cose_key: dict[Any, Any]) -> tuple[bytes, int]:
    key_type = int(cose_key.get(1) or 0)
    cose_algorithm = int(cose_key.get(3) or -7)

    if key_type == 2:
        curve = int(cose_key.get(-1) or 0)
        x = cose_key.get(-2)
        y = cose_key.get(-3)
        if curve != 1 or not isinstance(x, bytes) or not isinstance(y, bytes):
            raise serializers.ValidationError(
                {"attestation_object": "Unsupported passkey EC public key format."}
            )
        public_key = ec.EllipticCurvePublicKey.from_encoded_point(
            ec.SECP256R1(),
            b"\x04" + x + y,
        )
    elif key_type == 3:
        modulus = cose_key.get(-1)
        exponent = cose_key.get(-2)
        if not isinstance(modulus, bytes) or not isinstance(exponent, bytes):
            raise serializers.ValidationError(
                {"attestation_object": "Unsupported passkey RSA public key format."}
            )
        public_key = rsa.RSAPublicNumbers(
            e=int.from_bytes(exponent, "big"),
            n=int.from_bytes(modulus, "big"),
        ).public_key()
    elif key_type == 1:
        curve = int(cose_key.get(-1) or 0)
        x = cose_key.get(-2)
        if curve != 6 or not isinstance(x, bytes):
            raise serializers.ValidationError(
                {"attestation_object": "Unsupported passkey OKP public key format."}
            )
        public_key = ed25519.Ed25519PublicKey.from_public_bytes(x)
    else:
        raise serializers.ValidationError(
            {"attestation_object": "Unsupported passkey key type."}
        )

    spki = public_key.public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return spki, cose_algorithm


def verify_passkey_signature(
    *,
    encoded_public_key_spki: str,
    cose_algorithm: int,
    signature: bytes,
    signed_data: bytes,
) -> None:
    try:
        public_key = serialization.load_der_public_key(
            webauthn_b64decode(encoded_public_key_spki)
        )
    except Exception as exc:
        raise serializers.ValidationError(
            {"signature": "The stored passkey public key could not be loaded."}
        ) from exc

    try:
        if isinstance(public_key, ec.EllipticCurvePublicKey):
            public_key.verify(signature, signed_data, ec.ECDSA(hashes.SHA256()))
        elif isinstance(public_key, rsa.RSAPublicKey):
            public_key.verify(signature, signed_data, PKCS1v15(), hashes.SHA256())
        elif isinstance(public_key, ed25519.Ed25519PublicKey):
            public_key.verify(signature, signed_data)
        else:
            raise serializers.ValidationError(
                {"signature": "Unsupported passkey public key type."}
            )
    except Exception as exc:
        raise serializers.ValidationError(
            {"signature": "The passkey signature could not be verified."}
        ) from exc
