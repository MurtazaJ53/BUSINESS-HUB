from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.common.migration import MigrationBridgeMode, MigrationCutoverStatus, MigrationDomain, MigrationWriteMaster
from platform_apps.inventory.models import InventoryItem, InventoryItemPrivate, InventoryStockLedger
from platform_apps.jobs.models import MigrationDomainControl
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

    def _set_inventory_postgres_primary(self):
        MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            write_master=MigrationWriteMaster.POSTGRES,
            bridge_mode=MigrationBridgeMode.FIREBASE_TO_POSTGRES,
            cutover_status=MigrationCutoverStatus.POSTGRES_PRIMARY,
            current_epoch=4,
            shadow_reads_enabled=True,
        )

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

    def test_inventory_create_is_blocked_when_legacy_path_still_owns_domain(self):
        MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            write_master=MigrationWriteMaster.FIREBASE,
            bridge_mode=MigrationBridgeMode.COMPARE_ONLY,
            cutover_status=MigrationCutoverStatus.PILOT,
            current_epoch=3,
            shadow_reads_enabled=True,
        )

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/inventory/",
            {
                "name": "Blocked Socks",
                "sku": "SOCK-BLOCKED",
                "category": "Socks",
                "sell_price": "199.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(InventoryItem.objects.count(), 0)

    def test_inventory_create_succeeds_when_postgres_is_primary(self):
        self._set_inventory_postgres_primary()

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/inventory/",
            {
                "name": "Pilot Socks",
                "sku": "SOCK-PILOT",
                "category": "Socks",
                "sell_price": "199.00",
                "opening_stock": 4,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(InventoryItem.objects.count(), 1)

    def test_inventory_supplier_write_is_blocked_on_starter_plan(self):
        self._set_inventory_postgres_primary()
        self.shop.settings_json = {"plan_tier": "starter"}
        self.shop.save(update_fields=["settings_json", "updated_at"])

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/inventory/",
            {
                "name": "Starter Socks",
                "sku": "SOCK-STARTER",
                "category": "Socks",
                "sell_price": "199.00",
                "private_cost_price": "99.00",
                "private_supplier_id": "SUP-0001",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("private_supplier_id", response.json())

    def test_inventory_purchase_metadata_write_is_blocked_without_purchase_workflow(self):
        self._set_inventory_postgres_primary()
        self.shop.settings_json = {"plan_tier": "growth"}
        self.shop.save(update_fields=["settings_json", "updated_at"])

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/inventory/",
            {
                "name": "Growth Socks",
                "sku": "SOCK-GROWTH",
                "category": "Socks",
                "sell_price": "199.00",
                "private_cost_price": "99.00",
                "private_last_purchase_date": "2026-05-21",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("private_last_purchase_date", response.json())

    def test_inventory_supplier_and_purchase_fields_follow_plan(self):
        item = InventoryItem.objects.create(
            shop=self.shop,
            name="Catalog Shirt",
            sell_price=Decimal("599.00"),
        )
        InventoryItemPrivate.objects.create(
            item=item,
            cost_price=Decimal("245.00"),
            supplier_id="SUP-0001",
            last_purchase_date=timezone.localdate(),
        )

        self.shop.settings_json = {"plan_tier": "growth"}
        self.shop.save(update_fields=["settings_json", "updated_at"])
        growth_response = self.client.get(f"/api/v1/shops/{self.shop.id}/inventory/")
        self.assertEqual(growth_response.status_code, 200)
        self.assertEqual(growth_response.json()[0]["supplier_id"], "SUP-0001")
        self.assertIsNone(growth_response.json()[0]["last_purchase_date"])

        self.shop.settings_json = {"plan_tier": "pro"}
        self.shop.save(update_fields=["settings_json", "updated_at"])
        pro_response = self.client.get(f"/api/v1/shops/{self.shop.id}/inventory/")
        self.assertEqual(pro_response.status_code, 200)
        self.assertEqual(pro_response.json()[0]["supplier_id"], "SUP-0001")
        self.assertEqual(pro_response.json()[0]["last_purchase_date"], str(timezone.localdate()))

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

    def test_inventory_adjustment_is_blocked_when_legacy_path_still_owns_domain(self):
        item = InventoryItem.objects.create(shop=self.shop, name="Classic Socks", sell_price=Decimal("199.00"))
        MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            write_master=MigrationWriteMaster.FIREBASE,
            bridge_mode=MigrationBridgeMode.COMPARE_ONLY,
            cutover_status=MigrationCutoverStatus.PILOT,
            current_epoch=7,
            shadow_reads_enabled=True,
        )

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/inventory/{item.id}/adjust-stock/",
            {"quantity_delta": -2, "note": "Damage"},
            format="json",
        )

        self.assertEqual(response.status_code, 409)
