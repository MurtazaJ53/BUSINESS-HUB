from __future__ import annotations

from unittest.mock import MagicMock, patch

from django.test import TestCase
from rest_framework.test import APIClient

from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.shops.roles import normalize_membership_role
from platform_apps.users.authentication import bootstrap_memberships_from_firestore
from platform_apps.users.models import PlatformUser


class SessionBootstrapTests(TestCase):
    def test_session_bootstrap_returns_memberships(self):
        user = PlatformUser.objects.create_user(email="murtaza@example.com", full_name="Murtaza")
        shop = Shop.objects.create(
            name="Business Hub Pro",
            slug="business-hub-pro",
            settings_json={"plan_tier": "starter"},
        )
        ShopMembership.objects.create(
            user=user,
            shop=shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )

        client = APIClient()
        client.force_authenticate(user=user)
        response = client.get("/api/v1/session/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["email"], "murtaza@example.com")
        self.assertEqual(len(response.json()["memberships"]), 1)
        membership = response.json()["memberships"][0]
        self.assertEqual(membership["role_label"], "Owner")
        self.assertEqual(membership["role_profile"], "owner_control")
        self.assertIn("business control", membership["role_summary"].lower())
        self.assertEqual(membership["shop"]["plan_tier"], "starter")
        self.assertFalse(membership["shop"]["enabled_features"]["expenses"])
        self.assertFalse(membership["shop"]["enabled_features"]["attendance"])

    def test_normalize_membership_role_maps_product_aliases(self):
        self.assertEqual(normalize_membership_role("cashier"), ShopMembership.Role.STAFF)
        self.assertEqual(normalize_membership_role("manager"), ShopMembership.Role.ADMIN)
        self.assertEqual(normalize_membership_role("viewer"), ShopMembership.Role.VIEWER)
        self.assertEqual(
            normalize_membership_role("staff", is_shop_owner=True),
            ShopMembership.Role.OWNER,
        )

    @patch("platform_apps.users.authentication.firestore.client")
    @patch("platform_apps.users.authentication.get_firebase_app", return_value=object())
    def test_bootstrap_repairs_owner_membership_role_from_firestore(
        self,
        _get_firebase_app,
        firestore_client_mock,
    ):
        user = PlatformUser.objects.create_user(
            email="owner@example.com",
            full_name="Owner",
            firebase_uid="owner-firebase-uid",
        )
        shop = Shop.objects.create(
            name="Demo Shop",
            slug="demo-shop",
            source_system="firebase",
            source_id="shop-001",
            source_shop_id="shop-001",
        )
        membership = ShopMembership.objects.create(
            user=user,
            shop=shop,
            role=ShopMembership.Role.STAFF,
            status=ShopMembership.Status.ACTIVE,
        )

        user_doc = MagicMock()
        user_doc.exists = True
        user_doc.to_dict.return_value = {
            "shopId": "shop-001",
            "role": "staff",
            "phone": "+91-9999999999",
        }
        shop_doc = MagicMock()
        shop_doc.exists = True
        shop_doc.to_dict.return_value = {
            "name": "Demo Shop",
            "ownerId": "owner-firebase-uid",
            "settings": {"plan_tier": "growth"},
        }

        users_collection = MagicMock()
        shops_collection = MagicMock()
        users_collection.document.return_value.get.return_value = user_doc
        shops_collection.document.return_value.get.return_value = shop_doc

        firestore_db = MagicMock()
        firestore_db.collection.side_effect = lambda name: {
            "users": users_collection,
            "shops": shops_collection,
        }[name]
        firestore_client_mock.return_value = firestore_db

        bootstrap_memberships_from_firestore(user)

        membership.refresh_from_db()
        shop.refresh_from_db()
        self.assertEqual(membership.role, ShopMembership.Role.OWNER)
        self.assertEqual(membership.status, ShopMembership.Status.ACTIVE)
        self.assertEqual(membership.phone, "+91-9999999999")
        self.assertEqual(shop.owner_user_id, user.id)
