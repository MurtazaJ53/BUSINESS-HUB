from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.customers.models import Customer, CustomerLedgerEntry
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class CustomerKhataTimelineTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="owner@example.com", password="secret", full_name="Owner"
        )
        self.shop = Shop.objects.create(name="Demo Shop", slug="demo-shop")
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_timeline_computes_running_balance_newest_first(self):
        customer = Customer.objects.create(shop=self.shop, name="Rahul", balance=Decimal("60.00"))
        now = timezone.now()
        # Credit sale of 100, then a 40 part-payment.
        CustomerLedgerEntry.objects.create(
            shop=self.shop,
            customer=customer,
            event_type=CustomerLedgerEntry.EventType.SALE,
            amount_delta=Decimal("100.00"),
            total_spent_delta=Decimal("100.00"),
            occurred_at=now - timedelta(days=2),
        )
        CustomerLedgerEntry.objects.create(
            shop=self.shop,
            customer=customer,
            event_type=CustomerLedgerEntry.EventType.PAYMENT,
            amount_delta=Decimal("-40.00"),
            occurred_at=now - timedelta(days=1),
        )

        response = self.client.get(
            f"/api/v1/shops/{self.shop.id}/customers/{customer.id}/timeline/"
        )
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual(Decimal(str(body["balance"])), Decimal("60.00"))

        entries = body["entries"]
        self.assertEqual(len(entries), 2)
        # Newest-first: payment (running 60) then the credit sale (running 100).
        self.assertEqual(entries[0]["event_type"], "payment")
        self.assertEqual(Decimal(str(entries[0]["running_balance"])), Decimal("60.00"))
        self.assertEqual(entries[1]["event_type"], "sale")
        self.assertEqual(Decimal(str(entries[1]["running_balance"])), Decimal("100.00"))
