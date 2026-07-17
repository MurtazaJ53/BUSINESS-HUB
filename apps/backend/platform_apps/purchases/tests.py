from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.inventory.models import InventoryItem, InventoryItemPrivate, InventoryStockLedger
from platform_apps.purchases.models import Purchase, PurchaseItem, Supplier, SupplierLedgerEntry
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class PurchasesApiTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="owner@example.com", password="secret", full_name="Owner"
        )
        # Pro plan unlocks supplier_directory + purchase_workflow + finance_summary.
        self.shop = Shop.objects.create(
            name="Demo Shop", slug="demo-shop", settings_json={"plan_tier": "pro"}
        )
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.item = InventoryItem.objects.create(
            shop=self.shop, name="Sugar (loose)", sku="LOOSE-SUG", sell_price=Decimal("45.00")
        )
        InventoryItemPrivate.objects.create(item=self.item, cost_price=Decimal("30.00"))
        InventoryStockLedger.objects.create(
            shop=self.shop,
            item=self.item,
            event_type=InventoryStockLedger.EventType.OPENING_BALANCE,
            quantity_delta=Decimal("10.000"),
            occurred_at=timezone.now(),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _stock_on_hand(self):
        from django.db.models import Sum
        from django.db.models.functions import Coalesce

        return self.item.ledger_entries.aggregate(
            t=Coalesce(Sum("quantity_delta"), Decimal("0"))
        )["t"]

    def test_create_supplier_with_opening_balance_posts_ledger(self):
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/suppliers/",
            {"name": "Wholesale Traders", "phone": "9811122233", "opening_balance": "500.00"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        supplier = Supplier.objects.get()
        self.assertEqual(supplier.balance, Decimal("500.00"))
        self.assertEqual(
            supplier.ledger_entries.filter(
                event_type=SupplierLedgerEntry.EventType.OPENING_BALANCE
            ).count(),
            1,
        )

    def test_purchase_increments_stock_and_updates_cost_and_payable(self):
        supplier = Supplier.objects.create(shop=self.shop, name="Wholesale Traders")
        # Buy 5.5 kg sugar at Rs.32/kg = Rs.176; pay Rs.100 -> Rs.76 payable.
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/purchases/",
            {
                "supplier_id": str(supplier.id),
                "invoice_number": "BILL-001",
                "amount_paid": "100.00",
                "payment_mode": "CASH",
                "items": [
                    {
                        "inventory_item_id": str(self.item.id),
                        "quantity": "5.5",
                        "unit_cost": "32.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)

        purchase = Purchase.objects.get()
        self.assertEqual(purchase.total_amount, Decimal("176.00"))
        self.assertEqual(purchase.amount_due, Decimal("76.00"))

        # Stock incremented by exactly 5.5 (opening 10 -> 15.5).
        self.assertEqual(self._stock_on_hand(), Decimal("15.500"))
        ledger = InventoryStockLedger.objects.get(
            item=self.item, event_type=InventoryStockLedger.EventType.PURCHASE
        )
        self.assertEqual(ledger.quantity_delta, Decimal("5.500"))

        # Cost price refreshed to the latest purchase price.
        self.item.private.refresh_from_db()
        self.assertEqual(self.item.private.cost_price, Decimal("32.00"))
        self.assertEqual(self.item.private.supplier_id, str(supplier.id))

        # Supplier payables: balance = amount_due; two ledger rows (purchase + payment).
        supplier.refresh_from_db()
        self.assertEqual(supplier.balance, Decimal("76.00"))
        self.assertEqual(supplier.total_purchased, Decimal("176.00"))
        self.assertEqual(supplier.ledger_entries.count(), 2)

    def test_supplier_ledger_timeline_running_balance(self):
        supplier = Supplier.objects.create(shop=self.shop, name="Wholesale Traders")
        self.client.post(
            f"/api/v1/shops/{self.shop.id}/purchases/",
            {
                "supplier_id": str(supplier.id),
                "amount_paid": "0.00",
                "items": [
                    {"inventory_item_id": str(self.item.id), "quantity": "2", "unit_cost": "30.00"}
                ],
            },
            format="json",
        )
        response = self.client.get(
            f"/api/v1/shops/{self.shop.id}/suppliers/{supplier.id}/ledger/"
        )
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual(Decimal(str(body["balance"])), Decimal("60.00"))
        self.assertEqual(len(body["entries"]), 1)
        self.assertEqual(Decimal(str(body["entries"][0]["running_balance"])), Decimal("60.00"))

    def test_purchase_requires_pro_plan(self):
        self.shop.settings_json = {"plan_tier": "starter"}
        self.shop.save(update_fields=["settings_json"])
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/purchases/",
            {"items": [{"inventory_item_id": str(self.item.id), "quantity": "1", "unit_cost": "1.00"}]},
            format="json",
        )
        self.assertEqual(response.status_code, 403, response.content)

    def test_cashier_role_is_blocked_from_suppliers_and_purchases(self):
        # A cashier is a STAFF member; RBAC must hide procurement + payables.
        cashier = PlatformUser.objects.create_user(
            email="cashier@example.com", password="secret", full_name="Cashier"
        )
        ShopMembership.objects.create(
            user=cashier,
            shop=self.shop,
            role=ShopMembership.Role.STAFF,
            status=ShopMembership.Status.ACTIVE,
        )
        supplier = Supplier.objects.create(shop=self.shop, name="Wholesale Traders")
        client = APIClient()
        client.force_authenticate(user=cashier)

        self.assertEqual(client.get(f"/api/v1/shops/{self.shop.id}/purchases/").status_code, 403)
        self.assertEqual(client.get(f"/api/v1/shops/{self.shop.id}/suppliers/").status_code, 403)
        self.assertEqual(
            client.get(f"/api/v1/shops/{self.shop.id}/suppliers/{supplier.id}/ledger/").status_code,
            403,
        )

    def test_purchase_summary(self):
        supplier = Supplier.objects.create(shop=self.shop, name="Wholesale Traders")
        self.client.post(
            f"/api/v1/shops/{self.shop.id}/purchases/",
            {
                "supplier_id": str(supplier.id),
                "amount_paid": "50.00",
                "items": [
                    {"inventory_item_id": str(self.item.id), "quantity": "3", "unit_cost": "30.00"}
                ],
            },
            format="json",
        )
        response = self.client.get(f"/api/v1/shops/{self.shop.id}/purchases/summary/")
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual(body["total_purchases"], 1)
        self.assertEqual(Decimal(str(body["total_spent"])), Decimal("90.00"))
        self.assertEqual(Decimal(str(body["outstanding_payable"])), Decimal("40.00"))
