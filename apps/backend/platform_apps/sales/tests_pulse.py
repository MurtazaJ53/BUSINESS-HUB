from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.expenses.models import Expense
from platform_apps.inventory.models import InventoryItem
from platform_apps.purchases.models import Purchase
from platform_apps.sales.models import Sale
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class PulseReportTests(TestCase):
    """These figures drive buying and pricing decisions, so a confidently wrong
    number is worse than no number."""

    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="pulse@example.com", password="secret", full_name="Owner"
        )
        self.shop = Shop.objects.create(name="Pulse Shop", slug="pulse-shop")
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.cheap = InventoryItem.objects.create(
            shop=self.shop, name="Cap", sku="C1", sell_price=Decimal("100.00")
        )
        self.other = InventoryItem.objects.create(
            shop=self.shop, name="Vest", sku="V1", sell_price=Decimal("200.00")
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _sell(self, item, qty=1, price="100.00", cost=None):
        line = {
            "inventory_item_id": str(item.id),
            "quantity": qty,
            "unit_price": price,
        }
        if cost is not None:
            line["unit_cost"] = cost
        total = Decimal(price) * Decimal(qty)
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/sales/",
            {
                "items": [line],
                "payments": [
                    {"payment_method": "CASH", "amount": f"{total:.2f}"}
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        return response

    def _best_sellers(self, days=30):
        return self.client.get(
            f"/api/v1/shops/{self.shop.id}/reports/best-sellers/?days={days}"
        )

    def _cash_flow(self, days=30):
        return self.client.get(
            f"/api/v1/shops/{self.shop.id}/reports/cash-flow/?days={days}"
        )

    # --- best sellers ----------------------------------------------------

    def test_ranks_by_quantity_sold(self):
        self._sell(self.cheap, qty=5)
        self._sell(self.other, qty=2, price="200.00")
        items = self._best_sellers().json()["items"]
        self.assertEqual(items[0]["name"], "Cap")
        self.assertEqual(Decimal(items[0]["quantity_sold"]), Decimal("5.000"))

    def test_revenue_is_net_of_discount(self):
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/sales/",
            {
                "items": [
                    {
                        "inventory_item_id": str(self.cheap.id),
                        "quantity": 1,
                        "unit_price": "100.00",
                        "discount": "30.00",
                    }
                ],
                "payments": [{"payment_method": "CASH", "amount": "70.00"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        items = self._best_sellers().json()["items"]
        self.assertEqual(Decimal(items[0]["revenue"]), Decimal("70.00"))

    def test_profit_is_null_when_a_cost_is_missing(self):
        # One line with a cost, one without: reporting profit here would be a
        # confident half-truth.
        self._sell(self.cheap, qty=1, cost="60.00")
        self._sell(self.cheap, qty=1)
        items = self._best_sellers().json()["items"]
        self.assertIsNone(items[0]["profit"])

    def test_profit_is_reported_when_every_line_has_a_cost(self):
        self._sell(self.cheap, qty=2, cost="60.00")
        items = self._best_sellers().json()["items"]
        self.assertEqual(Decimal(items[0]["profit"]), Decimal("80.00"))

    def test_voided_sales_leave_the_list(self):
        self._sell(self.cheap, qty=5)
        sale = Sale.objects.get()
        self.client.patch(
            f"/api/v1/shops/{self.shop.id}/sales/{sale.id}/void/", {}, format="json"
        )
        self.assertEqual(self._best_sellers().json()["items"], [])

    def test_sales_outside_the_window_are_excluded(self):
        self._sell(self.cheap, qty=5)
        Sale.objects.update(sale_date=timezone.localdate() - timedelta(days=200))
        self.assertEqual(self._best_sellers(days=30).json()["items"], [])
        self.assertEqual(len(self._best_sellers(days=365).json()["items"]), 1)

    def test_an_absurd_window_is_clamped_rather_than_scanning_everything(self):
        self.assertEqual(self._best_sellers(days=99999).json()["days"], 365)

    # --- cash flow -------------------------------------------------------

    def test_net_is_collected_minus_purchases_and_expenses(self):
        self._sell(self.cheap, qty=5)  # Rs.500 collected
        Purchase.objects.create(
            shop=self.shop,
            supplier_name_snapshot="Wholesaler",
            total_amount=Decimal("300.00"),
            amount_paid=Decimal("200.00"),
            purchase_date=timezone.localdate(),
            occurred_at=timezone.now(),
        )
        Expense.objects.create(
            shop=self.shop,
            category="Rent",
            amount=Decimal("50.00"),
            expense_date=timezone.localdate(),
        )

        body = self._cash_flow().json()
        self.assertEqual(Decimal(body["sales_collected"]), Decimal("500.00"))
        # Only the Rs.200 actually paid counts — the unpaid Rs.100 hasn't left
        # the till.
        self.assertEqual(Decimal(body["purchases"]), Decimal("200.00"))
        self.assertEqual(Decimal(body["expenses"]), Decimal("50.00"))
        self.assertEqual(Decimal(body["net"]), Decimal("250.00"))

    def test_net_can_be_negative(self):
        Expense.objects.create(
            shop=self.shop,
            category="Rent",
            amount=Decimal("900.00"),
            expense_date=timezone.localdate(),
        )
        self.assertEqual(Decimal(self._cash_flow().json()["net"]), Decimal("-900.00"))

    def test_a_cashier_cannot_read_the_shop_cash_position(self):
        staff = PlatformUser.objects.create_user(
            email="pulse-staff@example.com", password="secret", full_name="Staff"
        )
        ShopMembership.objects.create(
            user=staff,
            shop=self.shop,
            role=ShopMembership.Role.STAFF,
            status=ShopMembership.Status.ACTIVE,
        )
        client = APIClient()
        client.force_authenticate(user=staff)
        response = client.get(f"/api/v1/shops/{self.shop.id}/reports/cash-flow/")
        self.assertEqual(response.status_code, 403, response.content)
