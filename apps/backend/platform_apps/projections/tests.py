from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from platform_apps.customers.models import Customer
from platform_apps.inventory.models import InventoryItem, InventoryStockLedger
from platform_apps.payments.models import SalePayment
from platform_apps.projections.models import ShopDashboardSnapshot, ShopLowStockSnapshot
from platform_apps.projections.services import refresh_shop_dashboard_projection
from platform_apps.sales.models import Sale
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class ProjectionRefreshTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="owner@example.com",
            password="secret",
            full_name="Owner",
        )
        self.shop = Shop.objects.create(name="Projection Shop", slug="projection-shop")
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _seed_domain_data(self):
        low_stock = InventoryItem.objects.create(
            shop=self.shop,
            name="Blue Tee",
            sku="BLU-TEE",
            category="Tees",
            sell_price="499.00",
        )
        healthy_stock = InventoryItem.objects.create(
            shop=self.shop,
            name="Denim",
            sku="DEN-001",
            category="Jeans",
            sell_price="899.00",
        )
        zero_stock = InventoryItem.objects.create(
            shop=self.shop,
            name="Cap",
            sku="CAP-001",
            category="Accessories",
            sell_price="199.00",
        )

        InventoryStockLedger.objects.create(
            shop=self.shop,
            item=low_stock,
            event_type=InventoryStockLedger.EventType.OPENING_BALANCE,
            quantity_delta=3,
            unit_price=low_stock.sell_price,
            occurred_at="2026-04-30T09:00:00+05:30",
        )
        InventoryStockLedger.objects.create(
            shop=self.shop,
            item=healthy_stock,
            event_type=InventoryStockLedger.EventType.OPENING_BALANCE,
            quantity_delta=7,
            unit_price=healthy_stock.sell_price,
            occurred_at="2026-04-30T09:00:00+05:30",
        )
        InventoryStockLedger.objects.create(
            shop=self.shop,
            item=zero_stock,
            event_type=InventoryStockLedger.EventType.OPENING_BALANCE,
            quantity_delta=0,
            unit_price=zero_stock.sell_price,
            occurred_at="2026-04-30T09:00:00+05:30",
        )

        customer = Customer.objects.create(
            shop=self.shop,
            name="Amina Patel",
            phone="9999999999",
            total_spent="650.00",
            balance="80.00",
        )

        sale = Sale.objects.create(
            shop=self.shop,
            actor_user=self.user,
            customer=customer,
            receipt_number="S-0001",
            subtotal_amount="650.00",
            total_amount="650.00",
            amount_received="500.00",
            amount_due="150.00",
            payment_mode=Sale.PaymentMode.SPLIT,
            customer_name_snapshot="Amina Patel",
            customer_phone_snapshot="9999999999",
            sale_date="2026-04-30",
            occurred_at="2026-04-30T11:00:00+05:30",
            status=Sale.Status.COMPLETED,
        )
        SalePayment.objects.create(
            sale=sale,
            shop=self.shop,
            actor_user=self.user,
            payment_method=SalePayment.PaymentMethod.CASH,
            amount="300.00",
            occurred_at="2026-04-30T11:00:00+05:30",
        )
        SalePayment.objects.create(
            sale=sale,
            shop=self.shop,
            actor_user=self.user,
            payment_method=SalePayment.PaymentMethod.UPI,
            amount="200.00",
            occurred_at="2026-04-30T11:01:00+05:30",
        )

    def test_refresh_shop_dashboard_projection_builds_snapshot_and_low_stock_preview(self):
        self._seed_domain_data()

        snapshot = refresh_shop_dashboard_projection(self.shop)

        self.assertEqual(snapshot.inventory_items_count, 3)
        self.assertEqual(snapshot.active_inventory_items_count, 3)
        self.assertEqual(snapshot.category_count, 3)
        self.assertEqual(snapshot.low_stock_items_count, 1)
        self.assertEqual(snapshot.out_of_stock_items_count, 1)
        self.assertEqual(snapshot.projected_sell_value, Decimal("7790.00"))
        self.assertEqual(snapshot.customer_count, 1)
        self.assertEqual(snapshot.active_credit_customers_count, 1)
        self.assertEqual(snapshot.total_outstanding_balance, Decimal("80.00"))
        self.assertEqual(snapshot.total_lifetime_spend, Decimal("650.00"))
        self.assertEqual(snapshot.sales_count, 1)
        self.assertEqual(snapshot.gross_revenue, Decimal("650.00"))
        self.assertEqual(snapshot.outstanding_revenue, Decimal("150.00"))
        self.assertEqual(snapshot.payment_count, 2)
        self.assertEqual(snapshot.total_collected, Decimal("500.00"))
        self.assertEqual(snapshot.credit_payment_count, 0)
        self.assertEqual(snapshot.digital_payment_count, 1)
        self.assertEqual(snapshot.low_stock_preview.count(), 1)
        self.assertEqual(snapshot.low_stock_preview.first().item_name, "Blue Tee")
        self.assertEqual(ShopLowStockSnapshot.objects.filter(shop=self.shop).count(), 1)

    def test_dashboard_snapshot_api_returns_projection_payload(self):
        self._seed_domain_data()

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/projections/dashboard/?refresh=1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["inventory_items_count"], 3)
        self.assertEqual(len(response.data["low_stock_preview"]), 1)
        self.assertEqual(response.data["low_stock_preview"][0]["item_name"], "Blue Tee")
