from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote


TOTP_PERIOD_SECONDS = 30
TOTP_DIGITS = 6
TOTP_VALID_WINDOW_STEPS = 1
MFA_CHALLENGE_WINDOW_SECONDS = 8 * 60 * 60
MFA_ISSUER_LABEL = "Business Hub"


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def format_totp_secret(secret: str) -> str:
    compact = secret.strip().replace(" ", "").upper()
    return " ".join(
        compact[index : index + 4] for index in range(0, len(compact), 4)
    )


def build_totp_otpauth_uri(*, secret: str, account_label: str, issuer: str = MFA_ISSUER_LABEL) -> str:
    quoted_issuer = quote(issuer)
    quoted_account = quote(account_label)
    return (
        f"otpauth://totp/{quoted_issuer}:{quoted_account}"
        f"?secret={secret}&issuer={quoted_issuer}&algorithm=SHA1&digits={TOTP_DIGITS}&period={TOTP_PERIOD_SECONDS}"
    )


def verify_totp_code(
    *,
    secret: str,
    code: str,
    at_time: int | None = None,
    valid_window_steps: int = TOTP_VALID_WINDOW_STEPS,
) -> bool:
    normalized_code = "".join(character for character in code if character.isdigit())
    if len(normalized_code) != TOTP_DIGITS:
        return False

    unix_time = int(at_time or time.time())
    current_counter = unix_time // TOTP_PERIOD_SECONDS

    for offset in range(-valid_window_steps, valid_window_steps + 1):
        if _generate_totp_code(secret=secret, counter=current_counter + offset) == normalized_code:
            return True

    return False


def generate_totp_code(secret: str, at_time: int | None = None) -> str:
    unix_time = int(at_time or time.time())
    current_counter = unix_time // TOTP_PERIOD_SECONDS
    return _generate_totp_code(secret=secret, counter=current_counter)


def _generate_totp_code(*, secret: str, counter: int) -> str:
    padded_secret = _pad_base32(secret)
    key = base64.b32decode(padded_secret, casefold=True)
    counter_bytes = struct.pack(">Q", counter)
    digest = hmac.new(key, counter_bytes, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    binary = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    otp = binary % (10**TOTP_DIGITS)
    return str(otp).zfill(TOTP_DIGITS)


def _pad_base32(secret: str) -> str:
    compact = secret.strip().replace(" ", "").upper()
    padding = "=" * ((8 - len(compact) % 8) % 8)
    return f"{compact}{padding}"
