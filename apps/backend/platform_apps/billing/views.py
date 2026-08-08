from __future__ import annotations

import json
import logging

from django.conf import settings
from django.db import transaction
from rest_framework import exceptions, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_apps.billing import gateway
from platform_apps.billing.models import Subscription, SubscriptionInvoice
from platform_apps.billing.pricing import price_for, public_catalog
from platform_apps.billing.serializers import (
    CheckoutRequestSerializer,
    PlanOptionSerializer,
    SubscriptionInvoiceSerializer,
    SubscriptionSerializer,
)
from platform_apps.shops.models import ShopMembership
from platform_apps.shops.permissions import get_membership_or_403

logger = logging.getLogger(__name__)


def _subscription_for(shop) -> Subscription:
    """Every shop has a subscription; older shops get their trial lazily."""
    subscription = getattr(shop, "subscription", None)
    if subscription is None:
        subscription = Subscription.start_trial(shop)
    subscription.refresh_status()
    return subscription


class SubscriptionView(APIView):
    """Current plan state for a workspace, plus what it can upgrade to."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, shop_id):
        membership = get_membership_or_403(
            request.user, shop_id, ShopMembership.Role.VIEWER
        )
        subscription = _subscription_for(membership.shop)
        return Response(
            {
                "subscription": SubscriptionSerializer(subscription).data,
                "plans": PlanOptionSerializer(public_catalog(), many=True).data,
                "payments_enabled": gateway.is_configured(),
            }
        )


class SubscriptionCheckoutView(APIView):
    """Open a payment for one billing period and hand back a payment URL."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, shop_id):
        # Only an owner/admin may spend the shop's money.
        membership = get_membership_or_403(
            request.user, shop_id, ShopMembership.Role.ADMIN
        )
        serializer = CheckoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        period = serializer.validated_data["billing_period"]

        subscription = _subscription_for(membership.shop)
        invoice = SubscriptionInvoice.open_for(subscription, period)

        try:
            link = gateway.create_payment_link(
                amount=price_for(period),
                reference_id=invoice.invoice_number,
                description=f"Business Hub Pro - {period} - {membership.shop.name}",
                customer_name=membership.shop.name,
                customer_email=getattr(request.user, "email", "") or "",
                customer_phone=(membership.shop.settings_json or {}).get(
                    "business_phone", ""
                ),
            )
        except gateway.PaymentGatewayError as error:
            invoice.status = SubscriptionInvoice.Status.FAILED
            invoice.save(update_fields=["status", "updated_at"])
            # 503: the request was fine, the provider just isn't usable yet.
            return Response(
                {"detail": str(error)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        invoice.provider_payment_link_id = link["id"]
        invoice.payment_url = link["short_url"]
        invoice.save(
            update_fields=["provider_payment_link_id", "payment_url", "updated_at"]
        )

        return Response(
            {
                "invoice": SubscriptionInvoiceSerializer(invoice).data,
                "payment_url": invoice.payment_url,
            },
            status=status.HTTP_201_CREATED,
        )


class SubscriptionInvoiceListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, shop_id):
        membership = get_membership_or_403(
            request.user, shop_id, ShopMembership.Role.ADMIN
        )
        subscription = _subscription_for(membership.shop)
        invoices = subscription.invoices.all()[:50]
        return Response(SubscriptionInvoiceSerializer(invoices, many=True).data)


class RazorpayWebhookView(APIView):
    """Payment confirmation from Razorpay. This is what actually grants access.

    Unauthenticated by design (Razorpay calls it), so every request must carry a
    valid HMAC signature — an unsigned or wrongly-signed call is rejected before
    anything is read.
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []

    def post(self, request):
        raw_body = request.body
        signature = request.headers.get("X-Razorpay-Signature", "")
        if not gateway.verify_webhook_signature(body=raw_body, signature=signature):
            logger.warning("Rejected Razorpay webhook with an invalid signature.")
            raise exceptions.PermissionDenied("Invalid webhook signature.")

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            raise exceptions.ValidationError("Malformed webhook payload.")

        event = payload.get("event", "")
        if event not in {"payment_link.paid", "payment.captured"}:
            # Acknowledge everything else so Razorpay stops retrying.
            return Response({"detail": f"Ignored event {event}."})

        entities = payload.get("payload", {})
        reference_id = ""
        payment_id = ""
        link_id = ""

        link_entity = (entities.get("payment_link") or {}).get("entity") or {}
        if link_entity:
            reference_id = link_entity.get("reference_id", "") or ""
            link_id = link_entity.get("id", "") or ""
        payment_entity = (entities.get("payment") or {}).get("entity") or {}
        if payment_entity:
            payment_id = payment_entity.get("id", "") or ""
            reference_id = reference_id or (
                payment_entity.get("notes", {}) or {}
            ).get("reference_id", "")

        invoice = None
        if reference_id:
            invoice = SubscriptionInvoice.objects.filter(
                invoice_number=reference_id
            ).first()
        if invoice is None and link_id:
            invoice = SubscriptionInvoice.objects.filter(
                provider_payment_link_id=link_id
            ).first()

        if invoice is None:
            logger.warning("Razorpay webhook for unknown invoice ref=%s", reference_id)
            return Response({"detail": "No matching invoice."})

        with transaction.atomic():
            invoice = SubscriptionInvoice.objects.select_for_update().get(pk=invoice.pk)
            # mark_paid is idempotent, so a replayed webhook can't extend the
            # subscription twice.
            newly_paid = invoice.mark_paid(provider_payment_id=payment_id)
            if newly_paid:
                invoice.subscription.activate_paid_period(invoice.billing_period)

        return Response({"detail": "ok", "applied": newly_paid})


class SubscriptionRefreshView(APIView):
    """Manual 'I've paid, check again' — re-evaluates status right away."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, shop_id):
        membership = get_membership_or_403(
            request.user, shop_id, ShopMembership.Role.VIEWER
        )
        subscription = _subscription_for(membership.shop)
        return Response(SubscriptionSerializer(subscription).data)
