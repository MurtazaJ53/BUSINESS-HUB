"""Performance and N+1 query regression tests for summary and list endpoints."""
from __future__ import annotations

from decimal import Decimal
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.db import connection
from rest_framework.test import APIClient

from platform_apps.customers.models import Customer
from platform_apps.inventory.models import InventoryItem
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


def _make_shop(slug: str) -> Shop:
    return Shop.objects.create(name=slug.title(), slug=slug, settings_json={"plan_tier": "starter"})


def _make_owner(email: str, shop: Shop) -> PlatformUser:
    user = PlatformUser.objects.create_user(email=email, password="secret", full_name="Owner")
    ShopMembership.objects.create(
        user=user, shop=shop, role=ShopMembership.Role.OWNER, status=ShopMembership.Status.ACTIVE
    )
    return user


class QueryCountPerformanceTests(TestCase):
    """Endpoints must maintain O(1) query complexity with respect to record counts."""

    def setUp(self):
        self.shop = _make_shop("perf-shop")
        self.owner = _make_owner("owner@perf.com", self.shop)
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def test_customer_summary_query_count_is_bounded(self):
        """Customer summary aggregate query count should not scale with number of customers."""
        # Seed 10 customers
        for i in range(10):
            Customer.objects.create(
                shop=self.shop,
                name=f"Customer {i}",
                balance=Decimal("100.00"),
                total_spent=Decimal("500.00"),
            )

        with CaptureQueriesContext(connection) as ctx1:
            resp = self.client.get(f"/api/v1/shops/{self.shop.id}/customers/summary/")
            self.assertEqual(resp.status_code, 200)
        query_count_10 = len(ctx1.captured_queries)

        # Seed 20 more customers (total 30)
        for i in range(10, 30):
            Customer.objects.create(
                shop=self.shop,
                name=f"Customer {i}",
                balance=Decimal("100.00"),
                total_spent=Decimal("500.00"),
            )

        with CaptureQueriesContext(connection) as ctx2:
            resp = self.client.get(f"/api/v1/shops/{self.shop.id}/customers/summary/")
            self.assertEqual(resp.status_code, 200)
        query_count_30 = len(ctx2.captured_queries)

        # The query count must be identical (O(1) database queries regardless of row count)
        self.assertEqual(
            query_count_10,
            query_count_30,
            f"Customer summary queries scaled with data: {query_count_10} -> {query_count_30}",
        )

    def test_inventory_summary_query_count_is_bounded(self):
        """Inventory summary query count should not scale with number of items."""
        for i in range(10):
            InventoryItem.objects.create(
                shop=self.shop,
                name=f"Item {i}",
                sku=f"SKU-{i}",
                sell_price=Decimal("15.00"),
                gst_rate=Decimal("18.00"),
            )

        with CaptureQueriesContext(connection) as ctx1:
            resp = self.client.get(f"/api/v1/shops/{self.shop.id}/inventory/summary/")
            self.assertEqual(resp.status_code, 200)
        count_10 = len(ctx1.captured_queries)

        for i in range(10, 30):
            InventoryItem.objects.create(
                shop=self.shop,
                name=f"Item {i}",
                sku=f"SKU-{i}",
                sell_price=Decimal("15.00"),
                gst_rate=Decimal("18.00"),
            )

        with CaptureQueriesContext(connection) as ctx2:
            resp = self.client.get(f"/api/v1/shops/{self.shop.id}/inventory/summary/")
            self.assertEqual(resp.status_code, 200)
        count_30 = len(ctx2.captured_queries)

        self.assertEqual(
            count_10,
            count_30,
            f"Inventory summary queries scaled with data: {count_10} -> {count_30}",
        )
