from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.inventory.models import InventoryItem, InventoryStockLedger
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class InventoryApiTests(TestCase):
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

    def test_create_inventory_item_with_opening_stock(self):
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/inventory/",
            {
                "name": "Classic Socks",
                "sku": "SOCK-001",
                "category": "Socks",
                "sell_price": "199.00",
                "opening_stock": 12,
                "private_cost_price": "99.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        item = InventoryItem.objects.get()
        self.assertEqual(item.name, "Classic Socks")
        self.assertEqual(item.private.cost_price, Decimal("99.00"))
        self.assertEqual(item.ledger_entries.count(), 1)
        self.assertEqual(item.ledger_entries.first().quantity_delta, 12)

    def test_adjust_inventory_stock(self):
        item = InventoryItem.objects.create(shop=self.shop, name="Classic Socks", sell_price=Decimal("199.00"))
        InventoryStockLedger.objects.create(
            shop=self.shop,
            item=item,
            actor_user=self.user,
            event_type=InventoryStockLedger.EventType.OPENING_BALANCE,
            quantity_delta=5,
            unit_price=Decimal("199.00"),
            occurred_at=timezone.now(),
        )
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/inventory/{item.id}/adjust-stock/",
            {"quantity_delta": -2, "note": "Damage"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        item.refresh_from_db()
        total = sum(item.ledger_entries.values_list("quantity_delta", flat=True))
        self.assertEqual(total, 3)
