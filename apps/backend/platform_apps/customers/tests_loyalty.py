from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from platform_apps.customers.loyalty import (
    clamp_redemption,
    loyalty_config,
    points_for_sale,
    redemption_value,
)
from platform_apps.customers.models import Customer, LoyaltyLedgerEntry
from platform_apps.inventory.models import InventoryItem
from platform_apps.sales.models import Sale
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class LoyaltyRulesTests(TestCase):
    """Points are money off a bill, so the arithmetic has to be defensible
    across the counter."""

    def setUp(self):
        self.shop = Shop.objects.create(
            name="Loyal Shop",
            slug="loyal-shop",
            settings_json={
                "loyalty": {"enabled": True, "points_per_hundred": 2, "point_value": 1}
            },
        )

    def test_disabled_by_default(self):
        plain = Shop.objects.create(name="Plain", slug="plain")
        self.assertFalse(loyalty_config(plain)["enabled"])
        self.assertEqual(points_for_sale(plain, Decimal("1000")), 0)

    def test_points_round_down_so_the_shop_never_overpays(self):
        # Rs.199 is one full hundred, not two.
        self.assertEqual(points_for_sale(self.shop, Decimal("199.99")), 2)
        self.assertEqual(points_for_sale(self.shop, Decimal("200.00")), 4)
        self.assertEqual(points_for_sale(self.shop, Decimal("99.99")), 0)

    def test_no_points_on_zero_or_negative_bills(self):
        self.assertEqual(points_for_sale(self.shop, Decimal("0")), 0)
        self.assertEqual(points_for_sale(self.shop, Decimal("-500")), 0)

    def test_a_broken_config_cannot_hand_out_unlimited_points(self):
        shop = Shop.objects.create(
            name="Bad",
            slug="bad",
            settings_json={"loyalty": {"enabled": True, "points_per_hundred": 99999}},
        )
        self.assertEqual(loyalty_config(shop)["points_per_hundred"], 1000)

    def test_garbage_config_falls_back_to_defaults(self):
        shop = Shop.objects.create(
            name="Junk",
            slug="junk",
            settings_json={
                "loyalty": {
                    "enabled": True,
                    "points_per_hundred": "abc",
                    "point_value": "xyz",
                }
            },
        )
        config = loyalty_config(shop)
        self.assertEqual(config["points_per_hundred"], 1)
        self.assertEqual(config["point_value"], Decimal("1.00"))

    def test_redemption_is_capped_by_what_the_customer_holds(self):
        self.assertEqual(
            clamp_redemption(
                self.shop, requested=500, available=30, bill_total=Decimal("1000")
            ),
            30,
        )

    def test_redemption_is_capped_by_the_bill(self):
        # 500 points would be Rs.500 off a Rs.120 bill - never hand back cash.
        self.assertEqual(
            clamp_redemption(
                self.shop, requested=500, available=500, bill_total=Decimal("120")
            ),
            120,
        )

    def test_nothing_redeemable_against_a_zero_bill(self):
        self.assertEqual(
            clamp_redemption(
                self.shop, requested=50, available=50, bill_total=Decimal("0")
            ),
            0,
        )

    def test_redemption_value_uses_the_configured_point_value(self):
        shop = Shop.objects.create(
            name="Half",
            slug="half",
            settings_json={"loyalty": {"enabled": True, "point_value": "0.50"}},
        )
        self.assertEqual(redemption_value(shop, 10), Decimal("5.00"))


class LoyaltySaleTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="loyal@example.com", password="secret", full_name="Owner"
        )
        self.shop = Shop.objects.create(
            name="Loyal Shop",
            slug="loyal-shop",
            settings_json={
                "loyalty": {"enabled": True, "points_per_hundred": 1, "point_value": 1}
            },
        )
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.customer = Customer.objects.create(
            shop=self.shop, name="Ayaan", phone="9876543210"
        )
        self.item = InventoryItem.objects.create(
            shop=self.shop, name="Shirt", sku="S1", sell_price=Decimal("500.00")
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _sell(self, amount="500.00", redeem=None, pay=None):
        body = {
            "customer_id": str(self.customer.id),
            "items": [
                {
                    "inventory_item_id": str(self.item.id),
                    "quantity": 1,
                    "unit_price": amount,
                }
            ],
            "payments": [
                {
                    "payment_method": "CASH",
                    "amount": pay if pay is not None else amount,
                }
            ],
        }
        if redeem is not None:
            body["redeem_points"] = redeem
        return self.client.post(
            f"/api/v1/shops/{self.shop.id}/sales/", body, format="json"
        )

    def test_a_sale_earns_points_and_writes_a_ledger_entry(self):
        self.assertEqual(self._sell().status_code, 201)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.loyalty_points, 5)
        entry = LoyaltyLedgerEntry.objects.get()
        self.assertEqual(entry.event_type, LoyaltyLedgerEntry.EventType.EARNED)
        self.assertEqual(entry.points_delta, 5)
        self.assertEqual(entry.balance_after, 5)

    def test_redeeming_reduces_the_bill_and_the_balance(self):
        self.customer.loyalty_points = 100
        self.customer.save(update_fields=["loyalty_points"])

        response = self._sell(redeem=100, pay="400.00")
        self.assertEqual(response.status_code, 201, response.content)

        sale = Sale.objects.get()
        self.assertEqual(sale.total_amount, Decimal("400.00"))
        self.assertEqual(sale.discount_amount, Decimal("100.00"))
        self.assertEqual(sale.amount_due, Decimal("0.00"))

        self.customer.refresh_from_db()
        # 100 spent, then 4 earned on the Rs.400 actually paid.
        self.assertEqual(self.customer.loyalty_points, 4)

    def test_points_are_not_earned_on_the_part_paid_with_points(self):
        self.customer.loyalty_points = 100
        self.customer.save(update_fields=["loyalty_points"])
        self._sell(redeem=100, pay="400.00")
        earned = LoyaltyLedgerEntry.objects.get(
            event_type=LoyaltyLedgerEntry.EventType.EARNED
        )
        self.assertEqual(earned.points_delta, 4)

    def test_cannot_redeem_more_points_than_held(self):
        self.customer.loyalty_points = 10
        self.customer.save(update_fields=["loyalty_points"])
        response = self._sell(redeem=100, pay="490.00")
        # 10 points -> Rs.10 off -> Rs.490 payable, not Rs.400.
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Sale.objects.get().total_amount, Decimal("490.00"))
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.loyalty_points, 4)

    def test_redeeming_without_a_customer_is_rejected(self):
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/sales/",
            {
                "redeem_points": 50,
                "items": [
                    {
                        "inventory_item_id": str(self.item.id),
                        "quantity": 1,
                        "unit_price": "500.00",
                    }
                ],
                "payments": [{"payment_method": "CASH", "amount": "450.00"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.content)

    def test_redeeming_with_no_points_is_rejected_not_silently_ignored(self):
        response = self._sell(redeem=50, pay="450.00")
        self.assertEqual(response.status_code, 400, response.content)

    def test_no_points_move_when_loyalty_is_switched_off(self):
        self.shop.settings_json = {"loyalty": {"enabled": False}}
        self.shop.save(update_fields=["settings_json"])
        self.assertEqual(self._sell().status_code, 201)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.loyalty_points, 0)
        self.assertFalse(LoyaltyLedgerEntry.objects.exists())
