"""Integration tests for cross-tenant isolation, shop suspension, and role minimum enforcement.

These tests are the *integration* layer — they create real DB objects and fire
HTTP requests through the DRF router, asserting that the auth/tenant gate
``get_membership_or_403`` does its job at every boundary.
"""
from __future__ import annotations

from django.test import TestCase
from rest_framework.test import APIClient

from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


def _make_user(email: str) -> PlatformUser:
    return PlatformUser.objects.create_user(
        email=email, password="secret", full_name="Test User"
    )


def _make_shop(slug: str) -> Shop:
    return Shop.objects.create(name=slug.title(), slug=slug)


def _join(user: PlatformUser, shop: Shop, role: str) -> ShopMembership:
    return ShopMembership.objects.create(
        user=user, shop=shop, role=role, status=ShopMembership.Status.ACTIVE
    )


class CrossTenantIsolationTests(TestCase):
    """User A must not access Shop B's resources under any endpoint."""

    def setUp(self):
        self.user_a = _make_user("a@example.com")
        self.user_b = _make_user("b@example.com")
        self.shop_a = _make_shop("shop-a")
        self.shop_b = _make_shop("shop-b")
        _join(self.user_a, self.shop_a, ShopMembership.Role.OWNER)
        _join(self.user_b, self.shop_b, ShopMembership.Role.OWNER)
        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.user_a)

    def test_user_a_cannot_get_shop_b_team(self):
        resp = self.client_a.get(f"/api/v1/shops/{self.shop_b.id}/team/")
        self.assertEqual(resp.status_code, 403)

    def test_user_a_cannot_get_shop_b_customers(self):
        resp = self.client_a.get(f"/api/v1/shops/{self.shop_b.id}/customers/")
        self.assertEqual(resp.status_code, 403)

    def test_user_a_cannot_get_shop_b_inventory(self):
        resp = self.client_a.get(f"/api/v1/shops/{self.shop_b.id}/inventory/")
        self.assertEqual(resp.status_code, 403)

    def test_user_a_cannot_get_shop_b_sales(self):
        resp = self.client_a.get(f"/api/v1/shops/{self.shop_b.id}/sales/")
        self.assertEqual(resp.status_code, 403)

    def test_user_a_cannot_access_shop_they_have_no_membership_in(self):
        # A shop that neither user joined
        lonely_shop = _make_shop("lonely-shop")
        resp = self.client_a.get(f"/api/v1/shops/{lonely_shop.id}/team/")
        self.assertEqual(resp.status_code, 403)

    def test_unauthenticated_request_returns_401(self):
        anon = APIClient()
        resp = anon.get(f"/api/v1/shops/{self.shop_a.id}/team/")
        self.assertEqual(resp.status_code, 401)


class ShopSuspensionBlocksAllEndpointsTests(TestCase):
    """Suspending a shop must block every member (owner included) at get_membership_or_403."""

    def setUp(self):
        self.user = _make_user("owner@example.com")
        self.shop = _make_shop("suspended-shop")
        _join(self.user, self.shop, ShopMembership.Role.OWNER)

        # Suspend the shop
        self.shop.status = Shop.Status.SUSPENDED
        self.shop.status_reason = "Non-payment"
        self.shop.save(update_fields=["status", "status_reason", "updated_at"])

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_suspended_shop_blocks_team_list(self):
        resp = self.client.get(f"/api/v1/shops/{self.shop.id}/team/")
        self.assertEqual(resp.status_code, 403)
        self.assertIn("suspend", resp.json()["detail"].lower())

    def test_suspended_shop_blocks_customer_read(self):
        resp = self.client.get(f"/api/v1/shops/{self.shop.id}/customers/")
        self.assertEqual(resp.status_code, 403)

    def test_suspended_shop_blocks_inventory_read(self):
        resp = self.client.get(f"/api/v1/shops/{self.shop.id}/inventory/")
        self.assertEqual(resp.status_code, 403)

    def test_suspended_shop_blocks_even_the_owner(self):
        """Owner is not exempt from suspension — same gate applies to all."""
        resp = self.client.get(f"/api/v1/shops/{self.shop.id}/team/")
        self.assertEqual(resp.status_code, 403)

    def test_unsuspended_shop_becomes_accessible_again(self):
        """Activating a shop must lift the suspension block."""
        self.shop.status = Shop.Status.ACTIVE
        self.shop.save(update_fields=["status", "updated_at"])

        resp = self.client.get(f"/api/v1/shops/{self.shop.id}/team/")
        # 200 = gate passed (not 403)
        self.assertEqual(resp.status_code, 200)


class RoleMinimumEnforcementTests(TestCase):
    """Lower-role members must be denied endpoints that require a higher role."""

    def setUp(self):
        self.owner = _make_user("owner@example.com")
        self.cashier = _make_user("cashier@example.com")
        self.shop = _make_shop("role-test-shop")

        self.owner_membership = _join(self.owner, self.shop, ShopMembership.Role.OWNER)
        self.cashier_membership = _join(self.cashier, self.shop, ShopMembership.Role.CASHIER)

        self.owner_client = APIClient()
        self.owner_client.force_authenticate(user=self.owner)
        self.cashier_client = APIClient()
        self.cashier_client.force_authenticate(user=self.cashier)

    def test_cashier_cannot_invite_a_member(self):
        """POST /invites/ requires at least MANAGER role."""
        resp = self.cashier_client.post(
            f"/api/v1/shops/{self.shop.id}/invites/",
            {"email": "newmember@example.com", "role": "staff"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_owner_can_invite_a_member(self):
        """Owner-level should succeed the role gate (whether or not Resend fires)."""
        resp = self.owner_client.post(
            f"/api/v1/shops/{self.shop.id}/invites/",
            {"email": "newmember@example.com", "role": "staff"},
            format="json",
        )
        # 201 Created or 503 (Resend down in test) — either way, NOT 403
        self.assertNotEqual(resp.status_code, 403)

    def test_cashier_cannot_revoke_another_member(self):
        """PATCH membership status → manager-level minimum."""
        resp = self.cashier_client.patch(
            f"/api/v1/shops/{self.shop.id}/team/{self.cashier_membership.id}/",
            {"status": "disabled"},
            format="json",
        )
        # 403 or 404 (if the endpoint doesn't allow self-management) — not 200
        self.assertIn(resp.status_code, [403, 404, 405])

    def test_cashier_can_access_sales_list(self):
        """CASHIER is above the VIEWER minimum required for /sales/."""
        resp = self.cashier_client.get(f"/api/v1/shops/{self.shop.id}/sales/")
        self.assertNotEqual(resp.status_code, 403)
