"""Razorpay integration via Payment Links.

Payment Links (rather than the checkout SDK) keep the mobile app free of any
gateway dependency: the server creates a link, the app opens it in the browser,
and the webhook is what actually grants access. That also means a customer who
pays but closes the app still gets activated.

The whole module is inert until RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are set,
so the product runs end-to-end without keys and starts charging the moment they
are added.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
from decimal import Decimal

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

_API_ROOT = "https://api.razorpay.com/v1"
_TIMEOUT = 20


class PaymentGatewayError(Exception):
    """Raised when the gateway is unusable or rejects a request."""


def is_configured() -> bool:
    return bool(
        getattr(settings, "RAZORPAY_KEY_ID", "")
        and getattr(settings, "RAZORPAY_KEY_SECRET", "")
    )


def _auth() -> tuple[str, str]:
    return (settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)


def create_payment_link(
    *,
    amount: Decimal,
    reference_id: str,
    description: str,
    customer_name: str = "",
    customer_email: str = "",
    customer_phone: str = "",
    callback_url: str = "",
) -> dict:
    """Create a Razorpay Payment Link. Returns {id, short_url}."""
    if not is_configured():
        raise PaymentGatewayError(
            "Online payment is not configured yet. Please contact support to "
            "activate your plan."
        )

    payload: dict = {
        # Razorpay works in paise.
        "amount": int((Decimal(amount) * Decimal("100")).to_integral_value()),
        "currency": "INR",
        "accept_partial": False,
        "description": description[:255],
        "reference_id": reference_id,
        "notify": {"sms": bool(customer_phone), "email": bool(customer_email)},
        "reminder_enable": True,
    }
    customer: dict = {}
    if customer_name:
        customer["name"] = customer_name[:120]
    if customer_email:
        customer["email"] = customer_email
    if customer_phone:
        customer["contact"] = customer_phone
    if customer:
        payload["customer"] = customer
    if callback_url:
        payload["callback_url"] = callback_url
        payload["callback_method"] = "get"

    try:
        response = requests.post(
            f"{_API_ROOT}/payment_links",
            json=payload,
            auth=_auth(),
            timeout=_TIMEOUT,
        )
    except requests.RequestException as exc:
        logger.warning("Razorpay payment link request failed: %s", exc)
        raise PaymentGatewayError(
            "Could not reach the payment provider. Please try again."
        ) from exc

    if response.status_code >= 400:
        logger.warning(
            "Razorpay rejected payment link (%s): %s",
            response.status_code,
            response.text[:500],
        )
        raise PaymentGatewayError("The payment provider rejected this request.")

    body = response.json()
    return {"id": body.get("id", ""), "short_url": body.get("short_url", "")}


def verify_webhook_signature(*, body: bytes, signature: str) -> bool:
    """Constant-time check that a webhook really came from Razorpay.

    Without a configured webhook secret we refuse the request rather than trust
    it — an unauthenticated caller must never be able to mark an invoice paid.
    """
    secret = getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "")
    if not secret or not signature:
        return False
    expected = hmac.new(
        secret.encode("utf-8"), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
