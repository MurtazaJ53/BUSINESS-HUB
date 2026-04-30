from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.payments.models import SalePayment
from platform_apps.sales.models import Sale
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class PaymentsApiTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(email="owner@example.com", password="secret", full_name="Owner")
        self.shop = Shop.objects.create(name="Demo Shop", slug="demo-shop")
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.sale = Sale.objects.create(
            shop=self.shop,
            actor_user=self.user,
            receipt_number="S-DEMO0001",
            subtotal_amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            amount_received=Decimal("500.00"),
            amount_due=Decimal("0.00"),
            payment_mode=Sale.PaymentMode.CASH,
            customer_name_snapshot="Walk-in",
            sale_date=timezone.localdate(),
            occurred_at=timezone.now(),
        )
        SalePayment.objects.create(
            sale=self.sale,
            shop=self.shop,
            actor_user=self.user,
            payment_method=SalePayment.PaymentMethod.CASH,
            amount=Decimal("500.00"),
            occurred_at=timezone.now(),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_list_payments_for_shop(self):
        response = self.client.get(f"/api/v1/shops/{self.shop.id}/payments/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
