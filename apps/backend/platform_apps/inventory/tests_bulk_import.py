from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from platform_apps.inventory.models import InventoryItem
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class InventoryBulkImportTests(TestCase):
    """Re-importing the same sheet used to create a second copy of every item.
    The duplicates started at zero stock and went negative the moment one was
    sold, leaving the shop with several rows for one product and a stock count
    nobody could trust."""

    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="imp@example.com", password="secret", full_name="Owner"
        )
        self.shop = Shop.objects.create(name="Imp Shop", slug="imp-shop")
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _import(self, items):
        return self.client.post(
            f"/api/v1/shops/{self.shop.id}/inventory/bulk/",
            {"items": items},
            format="json",
        )

    def test_first_import_creates_items(self):
        response = self._import(
            [
                {"name": "Woolen Caps Kids", "sku": "CAP-1", "sell_price": "80.00",
                 "opening_stock": 100},
                {"name": "Cotton Vest", "sku": "VEST-1", "sell_price": "60.00",
                 "opening_stock": 50},
            ]
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["created"], 2)
        self.assertEqual(InventoryItem.objects.count(), 2)

    def test_reimporting_the_same_sheet_does_not_duplicate(self):
        rows = [
            {"name": "Woolen Caps Kids", "sku": "CAP-1", "sell_price": "80.00",
             "opening_stock": 100},
        ]
        self._import(rows)
        response = self._import(rows)
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertEqual(body["created"], 0)
        self.assertEqual(body["updated"], 1)
        self.assertEqual(InventoryItem.objects.count(), 1)

    def test_reimport_refreshes_the_price(self):
        self._import(
            [{"name": "Cap", "sku": "CAP-1", "sell_price": "80.00"}]
        )
        self._import(
            [{"name": "Cap", "sku": "CAP-1", "sell_price": "95.00"}]
        )
        item = InventoryItem.objects.get()
        self.assertEqual(item.sell_price, Decimal("95.00"))

    def test_items_without_a_sku_match_on_name_and_size(self):
        rows = [{"name": "Loose Rice", "size": "1kg", "sell_price": "60.00"}]
        self._import(rows)
        self._import(rows)
        self.assertEqual(InventoryItem.objects.count(), 1)

    def test_same_name_different_size_stays_two_items(self):
        # A garment shop's "Cotton Vest" in S and XL are genuinely different
        # products and must not be collapsed into one.
        self._import([{"name": "Cotton Vest", "size": "S", "sell_price": "60.00"}])
        self._import([{"name": "Cotton Vest", "size": "XL", "sell_price": "80.00"}])
        self.assertEqual(InventoryItem.objects.count(), 2)

    def test_matching_is_case_insensitive(self):
        self._import([{"name": "Woolen Caps", "sku": "cap-1", "sell_price": "80.00"}])
        self._import([{"name": "WOOLEN CAPS", "sku": "CAP-1", "sell_price": "80.00"}])
        self.assertEqual(InventoryItem.objects.count(), 1)

    def test_invalid_rows_are_reported_not_silently_dropped(self):
        response = self._import(
            [
                {"name": "Good", "sku": "G-1", "sell_price": "10.00"},
                {"sell_price": "not a number"},
            ]
        )
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertEqual(body["created"], 1)
        self.assertEqual(body["skipped"], 1)
        self.assertTrue(body["errors"])
