from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from platform_apps.customers.models import Customer, CustomerLedgerEntry
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class CustomerApiTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(email="owner@example.com", password="secret", full_name="Owner")
        self.shop = Shop.objects.create(name="Demo Shop", slug="demo-shop")
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_customer_with_opening_balance(self):
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/customers/",
            {
                "name": "Ayaan Retail",
                "phone": "9876543210",
                "opening_balance": "420.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        customer = Customer.objects.get()
        self.assertEqual(customer.balance, Decimal("420.00"))
        self.assertEqual(customer.ledger_entries.count(), 1)
        self.assertEqual(customer.ledger_entries.first().event_type, CustomerLedgerEntry.EventType.OPENING_BALANCE)

    def test_record_customer_payment_updates_balance(self):
        customer = Customer.objects.create(
            shop=self.shop,
            name="Ayaan Retail",
            phone="9876543210",
            balance=Decimal("500.00"),
            total_spent=Decimal("1200.00"),
        )

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/customers/{customer.id}/ledger/",
            {
                "event_type": "payment",
                "amount_delta": "-200.00",
                "total_spent_delta": "0.00",
                "note": "Received UPI settlement",
                "occurred_at": "2026-04-30T12:00:00+05:30",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        customer.refresh_from_db()
        self.assertEqual(customer.balance, Decimal("300.00"))
        self.assertEqual(customer.total_spent, Decimal("1200.00"))

# Create your tests here.
