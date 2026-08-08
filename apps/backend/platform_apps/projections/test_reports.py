from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.expenses.models import Expense
from platform_apps.inventory.models import InventoryItem
from platform_apps.sales.models import Sale, SaleItem
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class ProfitAndLossReportTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="owner@example.com", password="secret", full_name="Owner"
        )
        self.shop = Shop.objects.create(
            name="Demo Shop", slug="demo-shop", settings_json={"plan_tier": "pro"}
        )
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _make_sale(self, *, qty, unit_price, unit_cost):
        today = timezone.localdate()
        sale = Sale.objects.create(
            shop=self.shop,
            actor_user=self.user,
            subtotal_amount=Decimal(qty) * Decimal(unit_price),
            total_amount=Decimal(qty) * Decimal(unit_price),
            amount_received=Decimal(qty) * Decimal(unit_price),
            status=Sale.Status.COMPLETED,
            sale_date=today,
            occurred_at=timezone.now(),
        )
        item = InventoryItem.objects.create(shop=self.shop, name="Widget", sell_price=Decimal(unit_price))
        SaleItem.objects.create(
            sale=sale,
            inventory_item=item,
            name_snapshot="Widget",
            quantity=Decimal(qty),
            unit_price=Decimal(unit_price),
            unit_cost=Decimal(unit_cost),
            line_total=Decimal(qty) * Decimal(unit_price),
        )
        return sale

    def test_profit_and_loss_nets_expenses_from_gross_margin(self):
        # Revenue 200, COGS 120 -> gross 80; expenses 30 -> net 50.
        self._make_sale(qty="2", unit_price="100.00", unit_cost="60.00")
        Expense.objects.create(
            shop=self.shop,
            category="Rent",
            amount=Decimal("30.00"),
            expense_date=timezone.localdate(),
        )

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/reports/profit-loss/")
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual(Decimal(str(body["revenue"])), Decimal("200.00"))
        self.assertEqual(Decimal(str(body["cost_of_goods_sold"])), Decimal("120.00"))
        self.assertEqual(Decimal(str(body["gross_profit"])), Decimal("80.00"))
        self.assertEqual(Decimal(str(body["total_expenses"])), Decimal("30.00"))
        self.assertEqual(Decimal(str(body["net_profit"])), Decimal("50.00"))

    def test_cashier_role_cannot_view_profit_and_loss(self):
        cashier = PlatformUser.objects.create_user(
            email="cashier@example.com", password="secret", full_name="Cashier"
        )
        ShopMembership.objects.create(
            user=cashier,
            shop=self.shop,
            role=ShopMembership.Role.STAFF,
            status=ShopMembership.Status.ACTIVE,
        )
        client = APIClient()
        client.force_authenticate(user=cashier)
        response = client.get(f"/api/v1/shops/{self.shop.id}/reports/profit-loss/")
        self.assertEqual(response.status_code, 403, response.content)

    def test_profit_and_loss_requires_finance_summary_feature(self):
        self.shop.settings_json = {"plan_tier": "growth"}  # finance_summary is pro-only
        self.shop.save(update_fields=["settings_json"])
        response = self.client.get(f"/api/v1/shops/{self.shop.id}/reports/profit-loss/")
        self.assertEqual(response.status_code, 403, response.content)
