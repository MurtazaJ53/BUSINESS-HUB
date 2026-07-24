"""Tests for self-serve shop registration (Phase 1)."""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from platform_apps.shops.models import Shop, ShopMembership

User = get_user_model()


def _payload(**overrides):
    base = {
        "owner_name": "Asha Patel",
        "email": "asha@example.com",
        "password": "s3curepass",
        "mobile": "9876543210",
        "business_name": "Asha General Store",
        "business_type": "retail",
        "state_code": "24",
        "gstin": "",
    }
    base.update(overrides)
    return base


class RegistrationTests(APITestCase):
    def setUp(self):
        self.url = reverse("register")

    def test_successful_registration_provisions_shop_and_returns_tokens(self):
        resp = self.client.post(self.url, _payload(), format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        body = resp.json()
        # Tokens returned so the owner is signed in immediately.
        self.assertTrue(body["access"])
        self.assertTrue(body["refresh"])
        self.assertEqual(body["role"], "owner")
        self.assertTrue(body["shop_id"])

        # User created with a usable password.
        user = User.objects.get(email="asha@example.com")
        self.assertTrue(user.check_password("s3curepass"))

        # Shop provisioned and owned by the user, with an owner membership.
        shop = Shop.objects.get(id=body["shop_id"])
        self.assertEqual(shop.owner_user_id, user.id)
        self.assertEqual(shop.name, "Asha General Store")
        self.assertTrue(shop.slug)
        membership = ShopMembership.objects.get(shop=shop, user=user)
        self.assertEqual(membership.role, ShopMembership.Role.OWNER)
        self.assertEqual(membership.status, ShopMembership.Status.ACTIVE)
        self.assertEqual(membership.phone, "9876543210")
        # Defaults seeded.
        self.assertIn("enabled_features", shop.settings_json)

    def test_returned_token_authorizes_the_new_shop(self):
        resp = self.client.post(self.url, _payload(), format="json")
        access = resp.json()["access"]
        # Use the token to read the owner's shops.
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        shops = self.client.get(reverse("shop-memberships"))
        self.assertEqual(shops.status_code, status.HTTP_200_OK)
        self.assertEqual(len(shops.json()), 1)
        self.assertEqual(shops.json()[0]["role"], "owner")

    def test_duplicate_email_is_rejected(self):
        self.client.post(self.url, _payload(), format="json")
        resp = self.client.post(
            self.url, _payload(business_name="Second Shop"), format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", resp.json())
        # No second shop created.
        self.assertEqual(Shop.objects.count(), 1)

    def test_short_password_is_rejected(self):
        resp = self.client.post(self.url, _payload(password="short"), format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", resp.json())
        self.assertEqual(User.objects.count(), 0)

    def test_missing_business_name_is_rejected(self):
        resp = self.client.post(self.url, _payload(business_name=""), format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_malformed_gstin_is_rejected(self):
        resp = self.client.post(self.url, _payload(gstin="NOTAGSTIN"), format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("gstin", resp.json())

    def test_blank_gstin_is_allowed(self):
        resp = self.client.post(self.url, _payload(gstin=""), format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_two_shops_get_distinct_slugs(self):
        self.client.post(self.url, _payload(), format="json")
        self.client.post(
            self.url,
            _payload(email="b@example.com", business_name="Asha General Store"),
            format="json",
        )
        slugs = list(Shop.objects.values_list("slug", flat=True))
        self.assertEqual(len(slugs), len(set(slugs)), "slugs must be unique")

    def test_email_is_normalized_to_lowercase(self):
        resp = self.client.post(
            self.url, _payload(email="MixedCase@Example.COM"), format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email="mixedcase@example.com").exists())

    def test_registration_requires_no_authentication(self):
        # Explicitly unauthenticated request must be accepted.
        self.client.credentials()  # clear any auth
        resp = self.client.post(self.url, _payload(), format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
