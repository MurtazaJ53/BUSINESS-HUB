"""Blind index for searchable-but-encrypted PII (e.g. customer phone).

The phone/email columns are stored with non-deterministic encryption (ciphertext
differs every row), which is safe but **unsearchable** — a lookup would have to
decrypt every row. A blind index adds a separate, *keyed-hash* column that IS
searchable by exact match, without weakening the encryption.

We use HMAC-SHA256 with a static ``BLIND_INDEX_PEPPER`` (kept in the environment,
never in the DB), so an attacker who dumps the database still can't reverse the
low-entropy phone numbers via a rainbow table.
"""

from __future__ import annotations

import hashlib
import hmac

from django.conf import settings


def generate_blind_index(raw_value: str | None) -> str:
    """Return the keyed hash of ``raw_value`` (digits only, normalized), or ""
    when there is nothing to index."""
    if not raw_value:
        return ""
    normalized = "".join(ch for ch in str(raw_value) if ch.isdigit())
    if not normalized:
        return ""
    # Normalize to the national number so "+91 98765 43210", "09876543210" and
    # "9876543210" all match (drop country/trunk prefixes by keeping the last 10).
    if len(normalized) > 10:
        normalized = normalized[-10:]
    return hmac.new(
        settings.BLIND_INDEX_PEPPER.encode("utf-8"),
        normalized.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
