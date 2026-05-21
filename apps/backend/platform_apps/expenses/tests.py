from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from platform_apps.expenses.models import Expense
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class ExpenseApiTests(TestCase):
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

    def test_create_expense(self):
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/expenses/",
            {
                "category": "Packaging",
                "amount": "240.00",
                "description": "Courier bags and tape",
                "payment_method": "UPI",
                "payment_reference": "upi-7782",
                "expense_date": "2026-04-30",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        expense = Expense.objects.get()
        self.assertEqual(expense.category, "Packaging")
        self.assertEqual(expense.amount, Decimal("240.00"))
        self.assertEqual(expense.payment_method, Expense.PaymentMethod.UPI)

    def test_list_expenses_for_shop(self):
        Expense.objects.create(
            shop=self.shop,
            actor_user=self.user,
            category="Packaging",
            amount=Decimal("240.00"),
            description="Courier bags and tape",
            expense_date="2026-04-30",
        )

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/expenses/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_expense_detail_hides_archived_records(self):
        expense = Expense.objects.create(
            shop=self.shop,
            actor_user=self.user,
            category="Archived",
            amount=Decimal("10.00"),
            description="Should stay hidden",
            expense_date="2026-04-30",
            tombstone=True,
        )

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/expenses/{expense.id}/")

        self.assertEqual(response.status_code, 404)

    def test_starter_plan_blocks_expense_access(self):
        self.shop.settings_json = {"plan_tier": "starter"}
        self.shop.save(update_fields=["settings_json"])

        list_response = self.client.get(f"/api/v1/shops/{self.shop.id}/expenses/")
        self.assertEqual(list_response.status_code, 403)
        self.assertIn("Expenses is not available", str(list_response.json()))

        create_response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/expenses/",
            {
                "category": "Packaging",
                "amount": "240.00",
                "description": "Courier bags and tape",
                "payment_method": "UPI",
                "payment_reference": "upi-7782",
                "expense_date": "2026-04-30",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 403)
