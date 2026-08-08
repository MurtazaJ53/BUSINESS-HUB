from __future__ import annotations

from django.test import TestCase
from rest_framework.test import APIClient

from platform_apps.common.blind_index import generate_blind_index
from platform_apps.customers.models import Customer
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class BlindIndexUtilTests(TestCase):
    def test_deterministic_and_digit_normalized(self):
        a = generate_blind_index("+91 98765 43210")
        b = generate_blind_index("9876543210")
        # Different formatting, same digits -> same hash.
        self.assertEqual(a, b)
        self.assertEqual(len(a), 64)  # sha256 hexdigest

    def test_blank_and_non_numeric_hash_to_empty(self):
        self.assertEqual(generate_blind_index(""), "")
        self.assertEqual(generate_blind_index(None), "")
        self.assertEqual(generate_blind_index("-"), "")
        self.assertEqual(generate_blind_index("abc"), "")


class CustomerPhoneSearchTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="owner@example.com", password="secret", full_name="Owner"
        )
        self.shop = Shop.objects.create(name="Demo", slug="demo")
        ShopMembership.objects.create(
            user=self.user, shop=self.shop, role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_save_populates_phone_hash(self):
        c = Customer.objects.create(shop=self.shop, name="Rahul", phone="9876543210")
        c.refresh_from_db()
        self.assertEqual(c.phone_hash, generate_blind_index("9876543210"))

    def test_search_by_phone_uses_blind_index(self):
        Customer.objects.create(shop=self.shop, name="Rahul", phone="9876543210")
        Customer.objects.create(shop=self.shop, name="Priya", phone="9823001122")

        # Search by the exact number (formatted differently) finds the customer.
        response = self.client.get(
            f"/api/v1/shops/{self.shop.id}/customers/", {"q": "+91 98765 43210"}
        )
        self.assertEqual(response.status_code, 200, response.content)
        names = [row["name"] for row in response.json()]
        self.assertIn("Rahul", names)
        self.assertNotIn("Priya", names)

    def test_search_by_name_still_works(self):
        Customer.objects.create(shop=self.shop, name="Rahul Sharma", phone="9876543210")
        response = self.client.get(
            f"/api/v1/shops/{self.shop.id}/customers/", {"q": "rahul"}
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(len(response.json()), 1)
