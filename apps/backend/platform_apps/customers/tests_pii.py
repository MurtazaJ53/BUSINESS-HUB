"""Integration tests for Customer PII handling: blind-index search, phone
normalization, database encryption verification, and tenant isolation."""
from __future__ import annotations

from decimal import Decimal
from django.db import connection
from django.test import TestCase
from rest_framework.test import APIClient

from platform_apps.common.blind_index import generate_blind_index
from platform_apps.customers.models import Customer
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


def _make_shop(slug: str) -> Shop:
    return Shop.objects.create(name=slug.title(), slug=slug)


def _make_owner(email: str, shop: Shop) -> PlatformUser:
    user = PlatformUser.objects.create_user(email=email, password="secret", full_name="Owner")
    ShopMembership.objects.create(
        user=user, shop=shop, role=ShopMembership.Role.OWNER, status=ShopMembership.Status.ACTIVE
    )
    return user


class CustomerPhoneBlindIndexTests(TestCase):
    """Phone must be searchable via the blind index without full-table decrypt."""

    def setUp(self):
        self.shop = _make_shop("crm-shop")
        self.user = _make_owner("owner@example.com", self.shop)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _create_customer(self, name: str = "Test Customer", phone: str = "9876543210") -> Customer:
        return Customer.objects.create(
            shop=self.shop,
            name=name,
            phone=phone,
        )

    # ------------------------------------------------------------------
    # Blind index round-trip
    # ------------------------------------------------------------------

    def test_phone_hash_is_populated_on_create(self):
        c = self._create_customer(phone="9876543210")
        expected = generate_blind_index("9876543210")
        self.assertEqual(c.phone_hash, expected)

    def test_search_by_phone_hash_finds_the_customer(self):
        self._create_customer(phone="9876543210")
        idx = generate_blind_index("9876543210")
        qs = Customer.objects.filter(shop=self.shop, phone_hash=idx)
        self.assertEqual(qs.count(), 1)

    # ------------------------------------------------------------------
    # Phone normalization — all formats must resolve to the same hash
    # ------------------------------------------------------------------

    def test_plus91_and_bare_10_digit_share_hash(self):
        h1 = generate_blind_index("+919876543210")
        h2 = generate_blind_index("9876543210")
        self.assertEqual(h1, h2)

    def test_trunk_prefix_and_bare_10_digit_share_hash(self):
        h1 = generate_blind_index("09876543210")
        h2 = generate_blind_index("9876543210")
        self.assertEqual(h1, h2)

    def test_formatted_with_spaces_and_bare_share_hash(self):
        h1 = generate_blind_index("+91 98765-43210")
        h2 = generate_blind_index("9876543210")
        self.assertEqual(h1, h2)

    # ------------------------------------------------------------------
    # API Search using Blind Index
    # ------------------------------------------------------------------

    def test_search_customer_via_api_query_param(self):
        self._create_customer(name="Rajesh", phone="9876543210")
        resp = self.client.get(f"/api/v1/shops/{self.shop.id}/customers/?q=9876543210")
        self.assertEqual(resp.status_code, 200)
        items = resp.json()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["name"], "Rajesh")

    def test_search_customer_via_partial_name(self):
        self._create_customer(name="Rajesh Sharma", phone="9876543210")
        resp = self.client.get(f"/api/v1/shops/{self.shop.id}/customers/?q=Sharma")
        self.assertEqual(resp.status_code, 200)
        items = resp.json()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["name"], "Rajesh Sharma")

    # ------------------------------------------------------------------
    # Database level encrypted storage
    # ------------------------------------------------------------------

    def test_phone_stored_encrypted_in_raw_database(self):
        c = self._create_customer(name="Secret Phone", phone="9876543210")
        with connection.cursor() as cursor:
            table = Customer._meta.db_table
            cursor.execute(f"SELECT phone FROM {table}")
            rows = cursor.fetchall()
            self.assertTrue(len(rows) > 0)
            # Raw database value is encrypted bytes / ciphertext, not plaintext "9876543210"
            raw_values = [str(r[0]) for r in rows]
            self.assertNotIn("9876543210", raw_values)

    # ------------------------------------------------------------------
    # Archived customer is hidden
    # ------------------------------------------------------------------

    def test_archived_customer_not_in_list(self):
        c = Customer.objects.create(
            shop=self.shop,
            name="Archived",
            phone="1111111111",
            tombstone=True,
            status=Customer.Status.ARCHIVED,
        )
        resp = self.client.get(f"/api/v1/shops/{self.shop.id}/customers/")
        self.assertEqual(resp.status_code, 200)
        ids = [r["id"] for r in resp.json()]
        self.assertNotIn(str(c.id), ids)

    # ------------------------------------------------------------------
    # Cross-tenant: customer from Shop A must not be visible in Shop B
    # ------------------------------------------------------------------

    def test_customer_from_another_shop_is_not_visible(self):
        other_shop = _make_shop("other-shop")
        Customer.objects.create(shop=other_shop, name="OtherCust", phone="8888888888")

        resp = self.client.get(f"/api/v1/shops/{self.shop.id}/customers/")
        self.assertEqual(resp.status_code, 200)
        names = [r["name"] for r in resp.json()]
        self.assertNotIn("OtherCust", names)
