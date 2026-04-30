from __future__ import annotations

from django.test import TestCase
from rest_framework.test import APIClient

from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class SessionBootstrapTests(TestCase):
    def test_session_bootstrap_returns_memberships(self):
        user = PlatformUser.objects.create_user(email="murtaza@example.com", full_name="Murtaza")
        shop = Shop.objects.create(name="Business Hub Pro", slug="business-hub-pro")
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
