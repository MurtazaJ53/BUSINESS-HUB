"""Security integration tests: IDOR prevention, role escalation blocking, rate limits.

All tests assert the *absence* of dangerous behaviour. No test here
weakens auth or tenant isolation to pass — violations are expected failures.
"""
from __future__ import annotations

from django.test import TestCase
from django.core.cache import cache
from rest_framework.test import APIClient

from platform_apps.customers.models import Customer
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


def _user(email: str) -> PlatformUser:
    return PlatformUser.objects.create_user(email=email, password="Secret123!", full_name="Test")


def _shop(slug: str) -> Shop:
    return Shop.objects.create(name=slug.title(), slug=slug)


def _join(user: PlatformUser, shop: Shop, role: str) -> ShopMembership:
    return ShopMembership.objects.create(
        user=user, shop=shop, role=role, status=ShopMembership.Status.ACTIVE
    )


class IDORTests(TestCase):
    """Insecure Direct Object Reference prevention."""

    def setUp(self):
        self.user_a = _user("a@sec.com")
        self.user_b = _user("b@sec.com")
        self.shop_a = _shop("shop-idor-a")
        self.shop_b = _shop("shop-idor-b")
        self.mem_a = _join(self.user_a, self.shop_a, ShopMembership.Role.OWNER)
        _join(self.user_b, self.shop_b, ShopMembership.Role.OWNER)

        # Create a resource in shop B
        self.customer_b = Customer.objects.create(shop=self.shop_b, name="PrivateCust")

        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.user_a)

    def test_user_a_cannot_fetch_customer_from_shop_b_via_shop_a_scope(self):
        """Direct lookup of shop B's customer UUID via shop A's URL must 404."""
        resp = self.client_a.get(
            f"/api/v1/shops/{self.shop_a.id}/customers/{self.customer_b.id}/"
        )
        self.assertEqual(resp.status_code, 404)

    def test_user_a_cannot_fetch_customer_via_shop_b_url(self):
        """IDOR via shop B's URL directly must 403 (unauthorized shop)."""
        resp = self.client_a.get(
            f"/api/v1/shops/{self.shop_b.id}/customers/{self.customer_b.id}/"
        )
        self.assertEqual(resp.status_code, 403)

    def test_user_a_cannot_update_shop_b_resource(self):
        """PATCH on shop B's customer via shop B's URL must 403."""
        resp = self.client_a.patch(
            f"/api/v1/shops/{self.shop_b.id}/customers/{self.customer_b.id}/",
            {"name": "Hijacked"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)
        self.customer_b.refresh_from_db()
        self.assertNotEqual(self.customer_b.name, "Hijacked")

    def test_user_a_cannot_list_shop_b_team(self):
        resp = self.client_a.get(f"/api/v1/shops/{self.shop_b.id}/team/")
        self.assertEqual(resp.status_code, 403)

    def test_user_a_cannot_delete_shop_b_membership(self):
        resp = self.client_a.delete(
            f"/api/v1/shops/{self.shop_b.id}/team/{self.mem_a.id}/"
        )
        self.assertIn(resp.status_code, [403, 404, 405])


class RoleEscalationTests(TestCase):
    """Members must not be able to promote themselves to a higher role."""

    def setUp(self):
        self.owner = _user("owner@sec.com")
        self.cashier_user = _user("cashier@sec.com")
        self.shop = _shop("escal-shop")
        _join(self.owner, self.shop, ShopMembership.Role.OWNER)
        self.cashier_mem = _join(self.cashier_user, self.shop, ShopMembership.Role.CASHIER)

        self.cashier_client = APIClient()
        self.cashier_client.force_authenticate(user=self.cashier_user)

    def test_cashier_cannot_self_promote_to_owner(self):
        """PATCH own membership role to OWNER must be rejected with 403."""
        resp = self.cashier_client.patch(
            f"/api/v1/shops/{self.shop.id}/team/{self.cashier_mem.id}/",
            {"role": "owner"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)
        self.cashier_mem.refresh_from_db()
        self.assertNotEqual(self.cashier_mem.role, ShopMembership.Role.OWNER)

    def test_cashier_cannot_self_promote_to_admin(self):
        resp = self.cashier_client.patch(
            f"/api/v1/shops/{self.shop.id}/team/{self.cashier_mem.id}/",
            {"role": "admin"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)
        self.cashier_mem.refresh_from_db()
        self.assertNotEqual(self.cashier_mem.role, ShopMembership.Role.ADMIN)

    def test_cashier_cannot_invite_a_manager(self):
        """Inviting requires MANAGER rank; cashier is below that."""
        resp = self.cashier_client.post(
            f"/api/v1/shops/{self.shop.id}/invites/",
            {"email": "new@example.com", "role": "manager"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)


class ArgonPasswordHashTests(TestCase):
    """Passwords must be stored with Argon2, not MD5/SHA1/plaintext."""

    def test_new_user_password_stored_as_argon2(self):
        user = PlatformUser.objects.create_user(
            email="hash@sec.com", password="Str0ngP@ss!", full_name="Hasher"
        )
        self.assertTrue(
            user.password.startswith("argon2") or user.password.startswith("$argon2"),
            f"Expected Argon2 hash, got: {user.password[:20]}...",
        )

    def test_password_not_stored_in_plaintext(self):
        user = PlatformUser.objects.create_user(
            email="plain@sec.com", password="MyPlainPassword", full_name="Plain"
        )
        self.assertNotEqual(user.password, "MyPlainPassword")
        self.assertNotIn("MyPlainPassword", user.password)


class RateLimitTests(TestCase):
    """Brute-force protection on auth endpoints must kick in."""

    def setUp(self):
        cache.clear()
        self.user = PlatformUser.objects.create_user(
            email="bruteforce@sec.com", password="correct-password", full_name="BF"
        )

    def tearDown(self):
        cache.clear()

    def test_login_rate_limit_triggers_after_threshold(self):
        """POST /api/v1/session/token/ more than 5 times in a minute must return 429."""
        client = APIClient()
        responses = []
        for i in range(10):
            resp = client.post(
                "/api/v1/session/token/",
                {"email": "bruteforce@sec.com", "password": "wrong"},
                format="json",
            )
            responses.append(resp.status_code)

        self.assertIn(429, responses,
            "Expected at least one 429 after repeated login attempts")

    def test_signup_rate_limit_triggers_after_threshold(self):
        """POST /api/v1/register/ more than 5 times in a minute must return 429."""
        client = APIClient()
        responses = []
        for i in range(10):
            resp = client.post(
                "/api/v1/register/",
                {
                    "email": f"newuser{i}@sec.com",
                    "password": "ValidPass123!",
                    "full_name": f"User {i}",
                },
                format="json",
            )
            responses.append(resp.status_code)

        self.assertIn(429, responses,
            "Expected at least one 429 after repeated signup attempts")
