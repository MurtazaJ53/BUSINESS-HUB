"""Khata collection: who owes money, and who has already been chased.

Udhaar (informal credit) is how most Indian small shops actually trade, and
chasing it is a weekly ritual. The only thing this has to get right is not
nudging the same person twice — a customer chased three times in a day stops
answering the phone, and the shop loses both the money and the customer.
"""
from __future__ import annotations

from decimal import Decimal

from django.utils import timezone
from rest_framework import exceptions, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_apps.audit.services import create_workspace_audit_event
from platform_apps.customers.models import Customer
from platform_apps.shops.models import ShopMembership
from platform_apps.shops.permissions import get_membership_or_403

#: A shopkeeper's own rhythm: chase again once a week has passed. Mirrors
#: `KhataDebtor.isOverdue` in the mobile app.
OVERDUE_AFTER_DAYS = 7


class DebtorListView(APIView):
    """Everyone carrying a balance, biggest first."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, shop_id):
        membership = get_membership_or_403(
            request.user, shop_id, ShopMembership.Role.STAFF
        )
        rows = (
            Customer.objects.filter(
                shop=membership.shop, tombstone=False, balance__gt=Decimal("0")
            )
            .order_by("-balance", "name")
        )

        now = timezone.now()
        today = timezone.localdate()
        items = []
        for customer in rows:
            reminded_at = customer.last_reminded_at
            days_since = (
                (now - reminded_at).days if reminded_at is not None else None
            )
            phone = (customer.phone or "").strip()
            # "-" is the model's placeholder for "no number recorded".
            digits = "".join(ch for ch in phone if ch.isdigit())
            items.append(
                {
                    "id": str(customer.id),
                    "name": customer.name,
                    "phone": phone if digits else "",
                    "has_phone": len(digits) >= 10,
                    "balance": customer.balance,
                    "last_reminded_at": reminded_at,
                    "days_since_reminder": days_since,
                    # Skip these on a collection run: chasing twice in one day
                    # is how a shop loses a customer.
                    "reminded_today": (
                        reminded_at is not None
                        and timezone.localtime(reminded_at).date() == today
                    ),
                    "is_overdue": (days_since if days_since is not None else 999)
                    >= OVERDUE_AFTER_DAYS,
                }
            )

        return Response(
            {
                "overdue_after_days": OVERDUE_AFTER_DAYS,
                "total_outstanding": sum(
                    (row["balance"] for row in items), Decimal("0.00")
                ),
                "unreachable_count": sum(1 for row in items if not row["has_phone"]),
                "items": items,
            }
        )


class CustomerRemindView(APIView):
    """Record that a reminder went out.

    Stored server-side so the owner on the web and the cashier on the phone
    see the same "already chased today" state.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, shop_id, customer_id):
        membership = get_membership_or_403(
            request.user, shop_id, ShopMembership.Role.STAFF
        )
        customer = Customer.objects.filter(
            shop=membership.shop, pk=customer_id, tombstone=False
        ).first()
        if customer is None:
            raise exceptions.NotFound("Customer not found.")

        previous = customer.last_reminded_at
        customer.last_reminded_at = timezone.now()
        customer.save(update_fields=["last_reminded_at", "updated_at"])

        create_workspace_audit_event(
            shop=membership.shop,
            actor_user=request.user,
            actor_role=membership.role,
            category="customers",
            event_type="customer.reminder.sent",
            entity_type="customer",
            entity_id=customer.id,
            entity_label=customer.name,
            summary=f"Recorded a payment reminder for {customer.name}.",
            source_surface="backend_api",
            before={"last_reminded_at": previous.isoformat() if previous else None},
            after={"last_reminded_at": customer.last_reminded_at.isoformat()},
        )

        return Response(
            {
                "id": str(customer.id),
                "last_reminded_at": customer.last_reminded_at,
            }
        )
