from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.inventory.models import (
    InventoryItem,
    InventoryItemPrivate,
    InventoryStockLedger,
)
from platform_apps.purchases.models import Purchase, PurchaseOrder, Supplier
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


def _stock(item: InventoryItem) -> Decimal:
    total = Decimal("0")
    for entry in InventoryStockLedger.objects.filter(item=item):
        total += entry.quantity_delta
    return total


class PurchaseOrderTests(TestCase):
    """Ordering, and booking in what actually arrives.

    The invariant throughout: an order on its own moves NOTHING. Stock, cost
    price and the supplier's payables change only when goods are received, and
    then only by what was received.
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
        self.supplier = Supplier.objects.create(shop=self.shop, name="Mills Ltd")
        self.item = InventoryItem.objects.create(
            shop=self.shop, name="Cotton Shirt", sku="CS-1", sell_price=Decimal("500.00")
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    # -- helpers ---------------------------------------------------------

    def _place(self, **extra):
        body = {
            "supplier_id": str(self.supplier.id),
            "lines": [
                {"item_id": str(self.item.id), "quantity": "10", "unit_cost": "300.00"}
            ],
            **extra,
        }
        return self.client.post(
            reverse("purchase-order-list", args=[self.shop.id]), body, format="json"
        )

    def _receive(self, order_id, lines, **extra):
        return self.client.post(
            reverse("purchase-order-receive", args=[self.shop.id, order_id]),
            {"lines": lines, **extra},
            format="json",
        )

    def _line_id(self, response, index=0):
        return response.data["lines"][index]["id"]

    # -- ordering moves nothing ------------------------------------------

    def test_placing_an_order_does_not_touch_stock_or_money(self):
        response = self._place()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], PurchaseOrder.Status.ORDERED)
        self.assertEqual(_stock(self.item), Decimal("0"))
        self.assertEqual(Purchase.objects.count(), 0)
        self.supplier.refresh_from_db()
        self.assertEqual(self.supplier.balance, Decimal("0.00"))

    def test_outstanding_value_reflects_what_is_still_coming(self):
        response = self._place()

        self.assertEqual(response.data["outstanding_value"], "3000.00")

    def test_a_draft_is_not_counted_as_on_order(self):
        response = self._place(place=False)

        self.assertEqual(response.data["status"], PurchaseOrder.Status.DRAFT)
        self.assertIsNone(response.data["ordered_at"])

    def test_an_order_needs_at_least_one_line(self):
        response = self.client.post(
            reverse("purchase-order-list", args=[self.shop.id]),
            {"supplier_id": str(self.supplier.id), "lines": []},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_a_line_with_neither_item_nor_name_is_rejected(self):
        response = self.client.post(
            reverse("purchase-order-list", args=[self.shop.id]),
            {"supplier_id": str(self.supplier.id), "lines": [{"quantity": "5"}]},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(PurchaseOrder.objects.count(), 0)

    # -- receiving --------------------------------------------------------

    def test_receiving_in_full_posts_stock_and_closes_the_order(self):
        order = self._place()

        response = self._receive(
            order.data["id"], [{"line_id": self._line_id(order), "quantity": "10"}]
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], PurchaseOrder.Status.RECEIVED)
        self.assertEqual(_stock(self.item), Decimal("10"))
        self.assertEqual(Purchase.objects.count(), 1)

    def test_a_short_delivery_leaves_the_rest_outstanding(self):
        """Suppliers short-ship constantly; partial is the normal case."""
        order = self._place()

        response = self._receive(
            order.data["id"], [{"line_id": self._line_id(order), "quantity": "6"}]
        )

        self.assertEqual(response.data["status"], PurchaseOrder.Status.PARTIALLY_RECEIVED)
        self.assertEqual(response.data["lines"][0]["quantity_outstanding"], "4.000")
        self.assertEqual(_stock(self.item), Decimal("6"))

    def test_the_rest_arriving_later_closes_the_order(self):
        order = self._place()
        line = self._line_id(order)
        self._receive(order.data["id"], [{"line_id": line, "quantity": "6"}])

        response = self._receive(order.data["id"], [{"line_id": line, "quantity": "4"}])

        self.assertEqual(response.data["status"], PurchaseOrder.Status.RECEIVED)
        self.assertEqual(_stock(self.item), Decimal("10"))
        # One purchase per delivery: two invoices, because two vans came.
        self.assertEqual(Purchase.objects.count(), 2)

    def test_receiving_updates_cost_price_through_the_normal_purchase_path(self):
        order = self._place()

        self._receive(
            order.data["id"], [{"line_id": self._line_id(order), "quantity": "10"}]
        )

        private = InventoryItemPrivate.objects.get(item=self.item)
        self.assertEqual(private.cost_price, Decimal("300.00"))

    def test_a_different_billed_rate_is_honoured(self):
        """The quote is not the invoice; cost price must follow what arrived."""
        order = self._place()

        self._receive(
            order.data["id"],
            [{"line_id": self._line_id(order), "quantity": "10", "unit_cost": "330.00"}],
        )

        private = InventoryItemPrivate.objects.get(item=self.item)
        self.assertEqual(private.cost_price, Decimal("330.00"))

    def test_unpaid_receipts_move_the_supplier_payable(self):
        order = self._place()

        self._receive(
            order.data["id"], [{"line_id": self._line_id(order), "quantity": "10"}]
        )

        self.supplier.refresh_from_db()
        self.assertEqual(self.supplier.balance, Decimal("3000.00"))

    # -- refusing to inflate stock or the bill ----------------------------

    def test_cannot_receive_more_than_was_ordered(self):
        order = self._place()

        response = self._receive(
            order.data["id"], [{"line_id": self._line_id(order), "quantity": "11"}]
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(_stock(self.item), Decimal("0"))
        self.assertEqual(Purchase.objects.count(), 0)

    def test_cannot_receive_more_than_is_still_outstanding(self):
        order = self._place()
        line = self._line_id(order)
        self._receive(order.data["id"], [{"line_id": line, "quantity": "8"}])

        response = self._receive(order.data["id"], [{"line_id": line, "quantity": "5"}])

        self.assertEqual(response.status_code, 400)
        self.assertEqual(_stock(self.item), Decimal("8"))

    def test_the_same_line_twice_in_one_receipt_is_rejected(self):
        order = self._place()
        line = self._line_id(order)

        response = self._receive(
            order.data["id"],
            [
                {"line_id": line, "quantity": "6"},
                {"line_id": line, "quantity": "6"},
            ],
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(_stock(self.item), Decimal("0"))

    def test_receiving_nothing_is_rejected(self):
        order = self._place()

        response = self._receive(
            order.data["id"], [{"line_id": self._line_id(order), "quantity": "0"}]
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Purchase.objects.count(), 0)

    def test_an_over_receipt_on_one_line_rolls_back_the_whole_delivery(self):
        second = InventoryItem.objects.create(
            shop=self.shop, name="Silk Shirt", sku="SS-1", sell_price=Decimal("900.00")
        )
        order = self.client.post(
            reverse("purchase-order-list", args=[self.shop.id]),
            {
                "supplier_id": str(self.supplier.id),
                "lines": [
                    {"item_id": str(self.item.id), "quantity": "10", "unit_cost": "300.00"},
                    {"item_id": str(second.id), "quantity": "2", "unit_cost": "700.00"},
                ],
            },
            format="json",
        )

        response = self._receive(
            order.data["id"],
            [
                {"line_id": self._line_id(order, 0), "quantity": "10"},
                {"line_id": self._line_id(order, 1), "quantity": "5"},
            ],
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(_stock(self.item), Decimal("0"))
        self.assertEqual(_stock(second), Decimal("0"))
        self.assertEqual(Purchase.objects.count(), 0)

    # -- cancelling -------------------------------------------------------

    def test_cancelling_an_order_leaves_stock_alone(self):
        order = self._place()

        response = self.client.delete(
            reverse("purchase-order-detail", args=[self.shop.id, order.data["id"]])
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], PurchaseOrder.Status.CANCELLED)
        self.assertEqual(_stock(self.item), Decimal("0"))

    def test_cannot_cancel_a_fully_received_order(self):
        order = self._place()
        self._receive(
            order.data["id"], [{"line_id": self._line_id(order), "quantity": "10"}]
        )

        response = self.client.delete(
            reverse("purchase-order-detail", args=[self.shop.id, order.data["id"]])
        )

        self.assertEqual(response.status_code, 400)

    def test_cannot_receive_against_a_cancelled_order(self):
        order = self._place()
        self.client.delete(
            reverse("purchase-order-detail", args=[self.shop.id, order.data["id"]])
        )

        response = self._receive(
            order.data["id"], [{"line_id": self._line_id(order), "quantity": "10"}]
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(_stock(self.item), Decimal("0"))

    # -- chasing late deliveries -------------------------------------------

    def test_an_order_past_its_expected_date_is_flagged_overdue(self):
        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()

        response = self._place(expected_date=yesterday)

        self.assertTrue(response.data["is_overdue"])

    def test_a_draft_is_never_overdue(self):
        """Nobody promised a date for an order that was never sent."""
        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()

        response = self._place(expected_date=yesterday, place=False)

        self.assertFalse(response.data["is_overdue"])

    def test_a_received_order_is_not_overdue(self):
        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()
        order = self._place(expected_date=yesterday)

        received = self._receive(
            order.data["id"], [{"line_id": self._line_id(order), "quantity": "10"}]
        )

        self.assertFalse(received.data["is_overdue"])

    def test_list_counts_open_and_overdue(self):
        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()
        self._place(expected_date=yesterday)
        self._place()

        response = self.client.get(reverse("purchase-order-list", args=[self.shop.id]))

        self.assertEqual(response.data["open_count"], 2)
        self.assertEqual(response.data["overdue_count"], 1)

    # -- permissions -------------------------------------------------------

    def test_a_cashier_cannot_place_an_order(self):
        cashier = PlatformUser.objects.create_user(
            email="cashier@example.com", password="secret", full_name="Cashier"
        )
        ShopMembership.objects.create(
            user=cashier,
            shop=self.shop,
            role=ShopMembership.Role.CASHIER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.client.force_authenticate(user=cashier)

        self.assertEqual(self._place().status_code, 403)

    def test_another_shop_cannot_see_these_orders(self):
        self._place()
        stranger = PlatformUser.objects.create_user(
            email="stranger@example.com", password="secret", full_name="Stranger"
        )
        self.client.force_authenticate(user=stranger)

        response = self.client.get(reverse("purchase-order-list", args=[self.shop.id]))

        self.assertEqual(response.status_code, 403)

    def test_signed_out_requests_are_rejected(self):
        self.client.force_authenticate(user=None)

        self.assertEqual(self._place().status_code, 401)
