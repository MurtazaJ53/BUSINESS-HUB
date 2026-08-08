from __future__ import annotations

import hashlib
import hmac
import json
from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.billing.models import Subscription, SubscriptionInvoice
from platform_apps.billing.pricing import BillingPeriod, price_for
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser

WEBHOOK_SECRET = "test-webhook-secret"


def _sign(body: bytes) -> str:
    return hmac.new(
        WEBHOOK_SECRET.encode("utf-8"), body, hashlib.sha256
    ).hexdigest()


class SubscriptionLifecycleTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="bill@example.com", password="secret", full_name="Owner"
        )
        self.shop = Shop.objects.create(name="Bill Shop", slug="bill-shop")
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )

    def test_trial_grants_pro_for_30_days(self):
        sub = Subscription.start_trial(self.shop)
        self.assertEqual(sub.status, Subscription.Status.TRIALING)
        self.assertTrue(sub.has_paid_access())
        self.assertEqual(sub.effective_plan_tier, "pro")
        self.shop.refresh_from_db()
        self.assertEqual(self.shop.plan_tier, "pro")
        self.assertTrue(self.shop.enabled_features["purchase_workflow"])

    def test_expired_trial_falls_back_to_starter_and_locks_paid_features(self):
        sub = Subscription.start_trial(self.shop)
        sub.trial_ends_at = timezone.now() - timedelta(days=40)
        sub.save(update_fields=["trial_ends_at"])

        self.assertEqual(sub.refresh_status(), Subscription.Status.EXPIRED)
        self.assertFalse(sub.has_paid_access())
        self.shop.refresh_from_db()
        self.assertEqual(self.shop.plan_tier, "starter")
        self.assertFalse(self.shop.enabled_features["purchase_workflow"])
        self.assertFalse(self.shop.enabled_features["expenses"])

    def test_grace_period_keeps_access_just_after_expiry(self):
        sub = Subscription.start_trial(self.shop)
        sub.trial_ends_at = timezone.now() - timedelta(days=1)
        sub.save(update_fields=["trial_ends_at"])
        # Inside the 3-day grace window, the shop must keep trading.
        self.assertTrue(sub.has_paid_access())
        self.assertEqual(sub.refresh_status(), Subscription.Status.PAST_DUE)
        self.shop.refresh_from_db()
        self.assertEqual(self.shop.plan_tier, "pro")

    def test_payment_stacks_on_remaining_trial_instead_of_truncating_it(self):
        sub = Subscription.start_trial(self.shop)
        trial_end = sub.trial_ends_at
        sub.activate_paid_period(BillingPeriod.MONTHLY)
        # Paying on day 1 of a 30-day trial must not throw away the trial.
        self.assertEqual(sub.status, Subscription.Status.ACTIVE)
        self.assertGreater(sub.current_period_end, trial_end + timedelta(days=29))

    def test_renewal_extends_from_current_period_end(self):
        sub = Subscription.start_trial(self.shop)
        sub.trial_ends_at = timezone.now() - timedelta(days=1)
        sub.save(update_fields=["trial_ends_at"])
        sub.activate_paid_period(BillingPeriod.MONTHLY)
        first_end = sub.current_period_end
        sub.activate_paid_period(BillingPeriod.MONTHLY)
        self.assertEqual(sub.current_period_end, first_end + timedelta(days=30))

    def test_yearly_costs_less_per_month_than_monthly(self):
        self.assertEqual(price_for(BillingPeriod.MONTHLY), Decimal("500.00"))
        self.assertEqual(price_for(BillingPeriod.YEARLY), Decimal("5500.00"))
        self.assertLess(price_for(BillingPeriod.YEARLY), price_for(BillingPeriod.MONTHLY) * 12)


class SubscriptionApiTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="api@example.com", password="secret", full_name="Owner"
        )
        self.shop = Shop.objects.create(name="Api Shop", slug="api-shop")
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_subscription_endpoint_returns_state_and_all_four_plans(self):
        response = self.client.get(f"/api/v1/shops/{self.shop.id}/subscription/")
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual(body["subscription"]["status"], "trialing")
        self.assertEqual(body["subscription"]["plan_tier"], "pro")
        periods = {p["period"] for p in body["plans"]}
        self.assertEqual(
            periods, {"monthly", "quarterly", "half_yearly", "yearly"}
        )
        # No keys configured in tests -> the app must know not to offer payment.
        self.assertFalse(body["payments_enabled"])

    def test_checkout_without_gateway_keys_returns_503_not_a_crash(self):
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/subscription/checkout/",
            {"billing_period": "monthly"},
            format="json",
        )
        self.assertEqual(response.status_code, 503, response.content)

    def test_checkout_rejects_an_unknown_billing_period(self):
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/subscription/checkout/",
            {"billing_period": "weekly"},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.content)

    def test_staff_cannot_start_a_checkout(self):
        staff = PlatformUser.objects.create_user(
            email="staff@example.com", password="secret", full_name="Staff"
        )
        ShopMembership.objects.create(
            user=staff,
            shop=self.shop,
            role=ShopMembership.Role.STAFF,
            status=ShopMembership.Status.ACTIVE,
        )
        client = APIClient()
        client.force_authenticate(user=staff)
        response = client.post(
            f"/api/v1/shops/{self.shop.id}/subscription/checkout/",
            {"billing_period": "monthly"},
            format="json",
        )
        self.assertEqual(response.status_code, 403, response.content)

    @mock.patch("platform_apps.billing.gateway.is_configured", return_value=True)
    @mock.patch("platform_apps.billing.gateway.create_payment_link")
    def test_checkout_returns_a_payment_url(self, mock_link, _mock_configured):
        mock_link.return_value = {
            "id": "plink_123",
            "short_url": "https://rzp.io/i/abc",
        }
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/subscription/checkout/",
            {"billing_period": "yearly"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["payment_url"], "https://rzp.io/i/abc")
        invoice = SubscriptionInvoice.objects.get()
        self.assertEqual(invoice.amount, Decimal("5500.00"))
        self.assertEqual(invoice.status, SubscriptionInvoice.Status.PENDING)


@override_settings(RAZORPAY_WEBHOOK_SECRET=WEBHOOK_SECRET)
class RazorpayWebhookTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="hook@example.com", password="secret", full_name="Owner"
        )
        self.shop = Shop.objects.create(name="Hook Shop", slug="hook-shop")
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.subscription = Subscription.start_trial(self.shop)
        # Pretend the trial already lapsed so activation is observable.
        self.subscription.trial_ends_at = timezone.now() - timedelta(days=40)
        self.subscription.save(update_fields=["trial_ends_at"])
        self.subscription.refresh_status()
        self.invoice = SubscriptionInvoice.open_for(
            self.subscription, BillingPeriod.MONTHLY
        )
        self.client = APIClient()

    def _payload(self) -> bytes:
        return json.dumps(
            {
                "event": "payment_link.paid",
                "payload": {
                    "payment_link": {
                        "entity": {
                            "id": "plink_1",
                            "reference_id": self.invoice.invoice_number,
                        }
                    },
                    "payment": {"entity": {"id": "pay_1"}},
                },
            }
        ).encode("utf-8")

    def _post(self, body: bytes, signature: str):
        return self.client.post(
            "/api/v1/billing/webhooks/razorpay/",
            data=body,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=signature,
        )

    def test_unsigned_webhook_is_rejected_and_grants_nothing(self):
        response = self._post(self._payload(), "")
        self.assertEqual(response.status_code, 403, response.content)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, SubscriptionInvoice.Status.PENDING)

    def test_forged_signature_is_rejected(self):
        response = self._post(self._payload(), "deadbeef")
        self.assertEqual(response.status_code, 403, response.content)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, SubscriptionInvoice.Status.PENDING)

    def test_valid_webhook_activates_the_subscription(self):
        body = self._payload()
        response = self._post(body, _sign(body))
        self.assertEqual(response.status_code, 200, response.content)

        self.invoice.refresh_from_db()
        self.subscription.refresh_from_db()
        self.assertEqual(self.invoice.status, SubscriptionInvoice.Status.PAID)
        self.assertEqual(self.invoice.provider_payment_id, "pay_1")
        self.assertEqual(self.subscription.status, Subscription.Status.ACTIVE)
        self.assertTrue(self.subscription.has_paid_access())

        self.shop.refresh_from_db()
        self.assertEqual(self.shop.plan_tier, "pro")
        self.assertTrue(self.shop.enabled_features["purchase_workflow"])

    def test_replayed_webhook_does_not_extend_the_period_twice(self):
        body = self._payload()
        self._post(body, _sign(body))
        self.subscription.refresh_from_db()
        first_end = self.subscription.current_period_end

        second = self._post(body, _sign(body))
        self.assertEqual(second.status_code, 200, second.content)
        self.assertFalse(second.json()["applied"])

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.current_period_end, first_end)

    def test_webhook_for_unknown_invoice_is_acknowledged_not_crashed(self):
        body = json.dumps(
            {
                "event": "payment_link.paid",
                "payload": {
                    "payment_link": {
                        "entity": {"id": "plink_x", "reference_id": "BH-nope"}
                    }
                },
            }
        ).encode("utf-8")
        response = self._post(body, _sign(body))
        self.assertEqual(response.status_code, 200, response.content)
