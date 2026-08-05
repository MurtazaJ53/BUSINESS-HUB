from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.inventory.models import (
    InventoryItem,
    InventoryItemPrivate,
    InventoryStockLedger,
)
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class StockReportTests(TestCase):
    """Dead stock and the reorder list decide what a shop spends money on, so
    the rules here must match the mobile app's local queries exactly."""

    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="stock@example.com", password="secret", full_name="Owner"
        )
        self.shop = Shop.objects.create(name="Stock Shop", slug="stock-shop")
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _item(self, name, *, stock=0, sell="100.00", cost=None, reorder=None, unit=""):
        item = InventoryItem.objects.create(
            shop=self.shop,
            name=name,
            sell_price=Decimal(sell),
            reorder_level=reorder,
            unit=unit,
        )
        if stock:
            InventoryStockLedger.objects.create(
                shop=self.shop,
                item=item,
                event_type=InventoryStockLedger.EventType.OPENING_BALANCE,
                quantity_delta=Decimal(str(stock)),
                occurred_at=timezone.now(),
            )
        if cost is not None:
            InventoryItemPrivate.objects.create(item=item, cost_price=Decimal(cost))
        return item

    def _sold(self, item, *, days_ago, qty="1"):
        InventoryStockLedger.objects.create(
            shop=self.shop,
            item=item,
            event_type=InventoryStockLedger.EventType.SALE,
            quantity_delta=Decimal(f"-{qty}"),
            occurred_at=timezone.now() - timedelta(days=days_ago),
        )

    def _dead_stock(self, days=90):
        return self.client.get(
            f"/api/v1/shops/{self.shop.id}/reports/dead-stock/?days={days}"
        ).json()

    def _reorder(self):
        return self.client.get(
            f"/api/v1/shops/{self.shop.id}/reports/reorder-list/"
        ).json()

    # --- dead stock ------------------------------------------------------

    def test_recently_sold_items_are_not_dead(self):
        item = self._item("Moving", stock=10)
        self._sold(item, days_ago=3)
        self.assertEqual(self._dead_stock()["items"], [])

    def test_an_item_sold_long_ago_is_dead(self):
        item = self._item("Stale", stock=10)
        self._sold(item, days_ago=200)
        body = self._dead_stock(days=90)
        self.assertEqual(len(body["items"]), 1)
        self.assertFalse(body["items"][0]["never_sold"])

    def test_an_item_never_sold_is_dead_and_flagged(self):
        self._item("Never", stock=4)
        body = self._dead_stock()
        self.assertEqual(len(body["items"]), 1)
        self.assertTrue(body["items"][0]["never_sold"])
        self.assertEqual(body["never_sold_count"], 1)

    def test_items_with_no_stock_are_not_dead_money(self):
        # Nothing on the shelf means no cash is tied up, however long ago it
        # last sold.
        self._item("Empty", stock=0)
        self.assertEqual(self._dead_stock()["items"], [])

    def test_value_uses_cost_when_known(self):
        self._item("Costed", stock=10, sell="100.00", cost="60.00")
        row = self._dead_stock()["items"][0]
        self.assertEqual(Decimal(row["tied_up_value"]), Decimal("600.000"))
        self.assertEqual(row["valued_at"], "cost")

    def test_value_falls_back_to_sale_price_and_says_so(self):
        # A stored 0.00 cost means "not recorded". Valuing the shelf at zero
        # would hide the very problem this report exists to surface.
        self._item("Uncosted", stock=10, sell="100.00", cost="0.00")
        row = self._dead_stock()["items"][0]
        self.assertEqual(Decimal(row["tied_up_value"]), Decimal("1000.000"))
        self.assertEqual(row["valued_at"], "sale_price")

    def test_worst_first_by_money_tied_up(self):
        self._item("Small", stock=1, sell="100.00")
        self._item("Big", stock=50, sell="100.00")
        names = [row["name"] for row in self._dead_stock()["items"]]
        self.assertEqual(names, ["Big", "Small"])

    def test_a_cashier_cannot_read_dead_stock(self):
        staff = PlatformUser.objects.create_user(
            email="stock-staff@example.com", password="secret", full_name="Staff"
        )
        ShopMembership.objects.create(
            user=staff,
            shop=self.shop,
            role=ShopMembership.Role.STAFF,
            status=ShopMembership.Status.ACTIVE,
        )
        client = APIClient()
        client.force_authenticate(user=staff)
        response = client.get(f"/api/v1/shops/{self.shop.id}/reports/dead-stock/")
        self.assertEqual(response.status_code, 403, response.content)

    # --- reorder list ----------------------------------------------------

    def test_items_above_their_level_are_not_listed(self):
        self._item("Plenty", stock=50, reorder=10)
        self.assertEqual(self._reorder()["items"], [])

    def test_an_item_at_its_level_is_listed(self):
        self._item("AtLevel", stock=10, reorder=10)
        self.assertEqual(len(self._reorder()["items"]), 1)

    def test_items_with_no_level_use_the_shop_default(self):
        self._item("NoLevel", stock=4)
        row = self._reorder()["items"][0]
        self.assertEqual(row["reorder_level"], 5)
        self.assertTrue(row["uses_default_level"])

    def test_suggested_quantity_reaches_twice_the_level(self):
        # Stock 4, level 10 -> target 20 -> buy 16, so the shop isn't back at
        # the threshold tomorrow.
        self._item("Restock", stock=4, reorder=10)
        self.assertEqual(Decimal(self._reorder()["items"][0]["suggested_qty"]), Decimal("16"))

    def test_suggested_quantity_is_never_below_one(self):
        # A level of 0 makes the target 0, so the arithmetic alone would suggest
        # buying nothing — useless on a buying list. Floor it at 1.
        self._item("Edge", stock=0, reorder=0)
        self.assertEqual(Decimal(self._reorder()["items"][0]["suggested_qty"]), Decimal("1"))

    def test_negative_stock_still_gets_a_sane_suggestion(self):
        item = self._item("Oversold", stock=2, reorder=5)
        self._sold(item, days_ago=1, qty="5")  # stock is now -3
        self.assertEqual(Decimal(self._reorder()["items"][0]["suggested_qty"]), Decimal("13"))

    def test_out_of_stock_items_come_first(self):
        self._item("Low", stock=3, reorder=10)
        self._item("Gone", stock=0, reorder=10)
        body = self._reorder()
        self.assertEqual(body["items"][0]["name"], "Gone")
        self.assertTrue(body["items"][0]["out_of_stock"])
        self.assertEqual(body["out_of_stock_count"], 1)

    def test_estimated_total_is_null_when_any_cost_is_missing(self):
        self._item("Costed", stock=1, reorder=10, cost="20.00")
        self._item("Uncosted", stock=1, reorder=10)
        self.assertIsNone(self._reorder()["estimated_total"])

    def test_estimated_total_is_given_when_every_cost_is_known(self):
        # Stock 1, level 10 -> buy 19 at Rs.20 = Rs.380.
        self._item("Costed", stock=1, reorder=10, cost="20.00")
        self.assertEqual(Decimal(self._reorder()["estimated_total"]), Decimal("380.00"))

    def test_a_cashier_can_read_the_buying_list_but_not_the_costs(self):
        staff = PlatformUser.objects.create_user(
            email="reorder-staff@example.com", password="secret", full_name="Staff"
        )
        ShopMembership.objects.create(
            user=staff,
            shop=self.shop,
            role=ShopMembership.Role.STAFF,
            status=ShopMembership.Status.ACTIVE,
        )
        self._item("Costed", stock=1, reorder=10, cost="20.00")
        client = APIClient()
        client.force_authenticate(user=staff)
        body = client.get(f"/api/v1/shops/{self.shop.id}/reports/reorder-list/").json()
        self.assertEqual(len(body["items"]), 1)
        self.assertIsNone(body["items"][0]["cost_price"])
        self.assertIsNone(body["items"][0]["estimated_cost"])
