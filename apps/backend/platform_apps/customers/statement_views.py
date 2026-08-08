"""A khata statement the customer can open themselves.

Until now a reminder was a WhatsApp message the shopkeeper typed, and the
customer had to take the figure on trust. This backs it with a page showing
the balance and the entries behind it, reachable without an account.

That makes it the only unauthenticated view of customer data in the product,
so the rules are tighter than anywhere else:

- The token is 32 random bytes and only its SHA-256 is stored, so neither a
  database dump nor a support engineer reading the row yields a working link.
- Statements expire, and a link can be revoked on its own.
- The payload is deliberately narrow: the customer's own name, what they owe,
  their own recent entries, and how to pay. No phone number (they know it, and
  whoever intercepted the link should not learn it), no other customer, no
  costs or margins.
- A dedicated throttle scope, because the shared anonymous bucket is 100/hour
  across every anonymous request and a busy shop's customers would exhaust it.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta
from decimal import Decimal
from urllib.parse import quote

from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import exceptions, permissions, status, throttling
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_apps.customers.models import (
    Customer,
    CustomerLedgerEntry,
    CustomerStatementLink,
)
from platform_apps.shops.models import ShopMembership
from platform_apps.shops.permissions import get_membership_or_403

#: Long enough to survive a slow payer, short enough that a leaked link dies.
DEFAULT_VALID_DAYS = 30
MAX_VALID_DAYS = 180

#: How much history the customer sees. Enough to recognise the purchases behind
#: the balance without turning the page into a full account export.
STATEMENT_ENTRY_LIMIT = 25


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class StatementThrottle(throttling.AnonRateThrottle):
    """Own bucket, so customers checking balances cannot starve other traffic."""

    scope = "khata_statement"


class CustomerStatementLinkView(APIView):
    """Issue (or re-issue) the link a shop sends to one customer."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, shop_id, customer_id):
        # Staff send reminders, so staff can mint the link. It reveals only
        # what that customer already knows about their own account.
        membership = get_membership_or_403(
            request.user, shop_id, ShopMembership.Role.STAFF
        )
        customer = get_object_or_404(
            Customer, id=customer_id, shop=membership.shop, tombstone=False
        )

        try:
            days = int(request.data.get("valid_days", DEFAULT_VALID_DAYS))
        except (TypeError, ValueError):
            days = DEFAULT_VALID_DAYS
        days = max(1, min(days, MAX_VALID_DAYS))

        # Re-issuing retires the old link rather than leaving both alive: a
        # shopkeeper pressing the button again usually means "the last one got
        # to the wrong person".
        CustomerStatementLink.objects.filter(
            customer=customer, revoked_at__isnull=True
        ).update(revoked_at=timezone.now())

        token = secrets.token_urlsafe(32)
        link = CustomerStatementLink.objects.create(
            customer=customer,
            token_hash=_hash(token),
            created_by=request.user,
            expires_at=timezone.now() + timedelta(days=days),
        )

        return Response(
            {
                "id": str(link.id),
                # The only moment the plaintext token exists. It is not stored
                # and cannot be shown again; re-issue to get a new one.
                "token": token,
                "path": f"/khata/{token}",
                "expires_at": link.expires_at.isoformat(),
            },
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, shop_id, customer_id):
        """Kill every live link for this customer."""
        membership = get_membership_or_403(
            request.user, shop_id, ShopMembership.Role.STAFF
        )
        customer = get_object_or_404(
            Customer, id=customer_id, shop=membership.shop, tombstone=False
        )
        revoked = CustomerStatementLink.objects.filter(
            customer=customer, revoked_at__isnull=True
        ).update(revoked_at=timezone.now())
        return Response({"revoked": revoked})


#: A collection round covers a shop's debtors, not its whole customer list.
#: Also bounds the write amplification: each mint retires the previous link.
MAX_BULK_LINKS = 200


class CustomerStatementLinkBulkView(APIView):
    """Mint statement links for many customers in one request.

    Chasing khata is a weekly ritual over a whole debtor list, and doing it one
    customer at a time meant a server round-trip between every message. Worse,
    that round-trip sat inside the click handler that opens WhatsApp, so the
    browser saw an await before window.open and blocked it as a pop-up.

    Minting the whole round up front removes both problems: the walk through
    customers afterwards is pure client-side work.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, shop_id):
        membership = get_membership_or_403(
            request.user, shop_id, ShopMembership.Role.STAFF
        )

        raw_ids = request.data.get("customer_ids")
        if not isinstance(raw_ids, list) or not raw_ids:
            raise exceptions.ValidationError(
                {"customer_ids": "Give at least one customer."}
            )
        # De-duplicated so `missing` cannot report the same unknown id twice
        # and so the cap counts customers rather than list entries. The token
        # itself is already safe without this: filter(id__in=...) returns each
        # customer once however many times its id was sent.
        ids = list(dict.fromkeys(str(value) for value in raw_ids))
        if len(ids) > MAX_BULK_LINKS:
            raise exceptions.ValidationError(
                {"customer_ids": f"At most {MAX_BULK_LINKS} customers at a time."}
            )

        customers = list(
            Customer.objects.filter(
                id__in=ids, shop=membership.shop, tombstone=False
            )
        )

        try:
            days = int(request.data.get("valid_days", DEFAULT_VALID_DAYS))
        except (TypeError, ValueError):
            days = DEFAULT_VALID_DAYS
        days = max(1, min(days, MAX_VALID_DAYS))
        expires_at = timezone.now() + timedelta(days=days)

        links = {}
        with transaction.atomic():
            CustomerStatementLink.objects.filter(
                customer__in=customers, revoked_at__isnull=True
            ).update(revoked_at=timezone.now())

            fresh = []
            for customer in customers:
                token = secrets.token_urlsafe(32)
                fresh.append(
                    CustomerStatementLink(
                        customer=customer,
                        token_hash=_hash(token),
                        created_by=request.user,
                        expires_at=expires_at,
                    )
                )
                links[str(customer.id)] = {
                    "token": token,
                    "path": f"/khata/{token}",
                }
            CustomerStatementLink.objects.bulk_create(fresh)

        return Response(
            {
                "links": links,
                # Ids that matched no customer in this shop are reported rather
                # than silently dropped, so a caller can tell "skipped" from
                # "failed".
                "missing": [i for i in ids if i not in links],
                "expires_at": expires_at.isoformat(),
            },
            status=status.HTTP_201_CREATED,
        )


def _upi_link(shop, amount: Decimal, note: str) -> str | None:
    """A `upi://pay` deep link, which every Indian payment app understands."""
    settings_json = getattr(shop, "settings_json", None) or {}
    vpa = str(settings_json.get("upi_vpa") or "").strip()
    if not vpa or amount <= Decimal("0"):
        return None
    return (
        f"upi://pay?pa={quote(vpa)}&pn={quote(shop.name)}"
        f"&am={amount:.2f}&cu=INR&tn={quote(note[:50])}"
    )


class PublicCustomerStatementView(APIView):
    """What the customer sees. No authentication, by design."""

    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []
    throttle_classes = [StatementThrottle]

    def get(self, request, token):
        link = (
            CustomerStatementLink.objects.select_related("customer__shop")
            .filter(token_hash=_hash(token))
            .first()
        )
        # One message for "wrong token", "expired" and "revoked". Telling them
        # apart would let someone probe which tokens ever existed.
        if link is None or not link.is_usable():
            raise exceptions.NotFound(
                "This statement link is no longer valid. Ask the shop for a new one."
            )

        customer = link.customer
        shop = customer.shop

        entries = CustomerLedgerEntry.objects.filter(customer=customer).order_by(
            "-occurred_at", "-created_at"
        )[:STATEMENT_ENTRY_LIMIT]

        balance = customer.balance or Decimal("0.00")

        # F() so two devices opening the link at once both count, rather than
        # one overwriting the other's read-modify-write.
        CustomerStatementLink.objects.filter(pk=link.pk).update(
            view_count=F("view_count") + 1, last_viewed_at=timezone.now()
        )

        return Response(
            {
                "customer_name": customer.name,
                "shop": {
                    "name": shop.name,
                    # The shop's own number is public information; the
                    # customer's is not and is never included.
                    "phone": getattr(shop, "phone", "") or "",
                },
                "balance": str(balance),
                "currency_code": getattr(shop, "currency_code", "INR"),
                "upi_link": _upi_link(shop, balance, f"Khata {shop.name}"),
                "entries": [
                    {
                        "occurred_at": entry.occurred_at.isoformat(),
                        "event_type": entry.event_type,
                        "amount": str(entry.amount_delta),
                        "note": entry.note,
                    }
                    for entry in entries
                ],
                "expires_at": link.expires_at.isoformat(),
            }
        )
