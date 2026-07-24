"""Transactional email via Resend.

A thin, dependency-free wrapper over the Resend HTTP API (urllib only). It is
safe to call anywhere: if RESEND_API_KEY is not configured (local/dev/tests),
it logs and no-ops instead of failing, so email is never a hard dependency of a
request path.
"""
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request

logger = logging.getLogger(__name__)

_RESEND_ENDPOINT = "https://api.resend.com/emails"


def _api_key() -> str:
    return os.getenv("RESEND_API_KEY", "").strip()


def _from_address() -> str:
    # Resend requires a verified sender; onboarding@resend.dev works out of the
    # box for testing before a domain is verified.
    return os.getenv("RESEND_FROM", "Business Hub <onboarding@resend.dev>")


def send_email(*, to: str, subject: str, html: str, text: str = "") -> bool:
    """Send one email. Returns True if handed to Resend, False if skipped/failed.

    Never raises - callers treat email as best-effort so a mail outage can't
    break registration or invitations.
    """
    key = _api_key()
    if not key:
        logger.info("Email skipped (no RESEND_API_KEY): to=%s subject=%s", to, subject)
        return False

    payload = json.dumps(
        {
            "from": _from_address(),
            "to": [to],
            "subject": subject,
            "html": html,
            **({"text": text} if text else {}),
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        _RESEND_ENDPOINT,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            if 200 <= response.status < 300:
                return True
            logger.warning("Resend returned %s for to=%s", response.status, to)
            return False
    except urllib.error.HTTPError as exc:  # pragma: no cover - network dependent
        body = exc.read().decode("utf-8", "replace")[:300]
        logger.warning("Resend HTTPError %s for to=%s: %s", exc.code, to, body)
        return False
    except Exception as exc:  # pragma: no cover - network dependent
        logger.warning("Resend send failed for to=%s: %s", to, exc)
        return False


def send_invite_email(
    *, to: str, shop_name: str, role_label: str, invite_code: str, inviter: str = ""
) -> bool:
    """Compose and send a shop invitation email."""
    who = f"{inviter} invited you" if inviter else "You've been invited"
    subject = f"{who} to join {shop_name} on Business Hub"
    html = f"""
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#0d6e8c">Join {shop_name} on Business Hub</h2>
      <p>{who} as <b>{role_label}</b>.</p>
      <p>Open the Business Hub app, choose <b>“Join with invite code”</b>, and enter this code:</p>
      <p style="font-size:22px;font-weight:700;letter-spacing:2px;background:#e4f1f5;
                padding:12px 16px;border-radius:10px;display:inline-block">{invite_code}</p>
      <p style="color:#54617a;font-size:13px">This invite expires in 7 days. If you didn't expect it, you can ignore this email.</p>
    </div>
    """
    text = (
        f"{who} to join {shop_name} as {role_label} on Business Hub.\n"
        f'Open the app, choose "Join with invite code", and enter: {invite_code}\n'
        f"This invite expires in 7 days."
    )
    return send_email(to=to, subject=subject, html=html, text=text)
