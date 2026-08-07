from __future__ import annotations

import json
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.customers.models import Customer
from platform_apps.inventory.models import (
    InventoryItem,
    InventoryItemPrivate,
    InventoryStockLedger,
)
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class ShopDataExportTests(TestCase):
    """Taking your data out.

    The web equivalent of the counter app's local backup. It hands over
    everything at once, so most of what matters here is who is allowed to ask
    and whether the numbers survive the trip intact.
    """

    def setUp(self):
        self.owner = PlatformUser.objects.create_user(
            email="owner@example.com", password="secret", full_name="Owner"
        )
        self.shop = Shop.objects.create(name="Cloth House", slug="cloth-house")
        ShopMembership.objects.create(
            user=self.owner,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)
        self.url = reverse("shop-data-export", args=[self.shop.id])

    def _seed(self):
        item = InventoryItem.objects.create(
            shop=self.shop,
            name="Cotton Shirt",
            sku="CS-1",
            sell_price=Decimal("499.50"),
        )
        InventoryItemPrivate.objects.create(item=item, cost_price=Decimal("300.25"))
        InventoryStockLedger.objects.create(
            shop=self.shop,
            item=item,
            event_type=InventoryStockLedger.EventType.OPENING_BALANCE,
            quantity_delta=Decimal("12.500"),
            occurred_at=timezone.now(),
        )
        Customer.objects.create(
            shop=self.shop,
            name="Ramesh",
            phone="9876543210",
            balance=Decimal("4200.00"),
        )
        return item

    def _body(self, response) -> dict:
        return json.loads(b"".join(response.streaming_content).decode()
                          if response.streaming else response.content.decode())

    # -- what comes out ---------------------------------------------------

    def test_export_downloads_as_a_named_json_file(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertIn("attachment;", response["Content-Disposition"])
        self.assertIn("cloth-house", response["Content-Disposition"])

    def test_export_carries_every_section(self):
        self._seed()

        body = self._body(self.client.get(self.url))

        for section in (
            "shop", "inventory", "stock_ledger", "customers",
            "customer_ledger", "sales", "suppliers", "purchases", "expenses",
        ):
            self.assertIn(section, body)

    def test_money_is_exported_as_a_string_not_a_float(self):
        """A float export is where a rounding artefact gets preserved forever."""
        self._seed()

        body = self._body(self.client.get(self.url))

        item = body["inventory"][0]
        self.assertEqual(item["sell_price"], "499.50")
        self.assertEqual(item["cost_price"], "300.25")
        self.assertNotIsInstance(item["sell_price"], float)

    def test_the_stock_ledger_is_exported_not_a_stock_total(self):
        """Stock is derived from these rows; a total would lose how it arose."""
        self._seed()

        body = self._body(self.client.get(self.url))

        self.assertEqual(len(body["stock_ledger"]), 1)
        self.assertEqual(body["stock_ledger"][0]["quantity_delta"], "12.500")

    def test_customer_phone_is_decrypted_for_the_owner(self):
        self._seed()

        body = self._body(self.client.get(self.url))

        self.assertEqual(body["customers"][0]["phone"], "9876543210")

    def test_an_item_with_no_cost_recorded_exports_null(self):
        InventoryItem.objects.create(
            shop=self.shop, name="No cost", sell_price=Decimal("10.00")
        )

        body = self._body(self.client.get(self.url))

        self.assertIsNone(body["inventory"][0]["cost_price"])

    # -- who may ask ------------------------------------------------------

    def test_a_manager_cannot_export_the_whole_shop(self):
        """One call that hands over every cost price and customer. Owner only."""
        manager = PlatformUser.objects.create_user(
            email="manager@example.com", password="secret", full_name="Manager"
        )
        ShopMembership.objects.create(
            user=manager,
            shop=self.shop,
            role=ShopMembership.Role.MANAGER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.client.force_authenticate(user=manager)

        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_a_stranger_cannot_export_this_shop(self):
        stranger = PlatformUser.objects.create_user(
            email="stranger@example.com", password="secret", full_name="Stranger"
        )
        self.client.force_authenticate(user=stranger)

        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_signed_out_requests_are_rejected(self):
        self.client.force_authenticate(user=None)

        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_another_shops_data_is_not_included(self):
        other_shop = Shop.objects.create(name="Other", slug="other")
        InventoryItem.objects.create(
            shop=other_shop, name="Not mine", sell_price=Decimal("1.00")
        )
        self._seed()

        body = self._body(self.client.get(self.url))

        names = [row["name"] for row in body["inventory"]]
        self.assertNotIn("Not mine", names)
