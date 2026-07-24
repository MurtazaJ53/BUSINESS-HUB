"""Tests for per-member role + custom permission management (Phase 2 fix #3)."""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from platform_apps.shops.models import ShopMembership
from platform_apps.shops.provisioning import provision_shop
from platform_apps.users.jwt_auth import issue_tokens

User = get_user_model()


class PermissionManagementTests(APITestCase):
    def setUp(self):
        self.owner = User(email="owner@p.test", full_name="Owner", is_active=True)
        self.owner.set_password("ownerpass1")
        self.owner.save()
        self.shop, _ = provision_shop(owner=self.owner, business_name="Perm Shop")
        self.staff = User(email="staff@p.test", full_name="Staff", is_active=True)
        self.staff.set_password("staffpass1")
        self.staff.save()
        self.staff_membership = ShopMembership.objects.create(
            shop=self.shop, user=self.staff, role=ShopMembership.Role.CASHIER,
            status=ShopMembership.Status.ACTIVE, email=self.staff.email,
        )
        self.url = reverse(
            "workspace-team-detail", args=[self.shop.id, self.staff_membership.id]
        )

    def auth(self, user):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {issue_tokens(user)['access']}"
        )

    def test_owner_can_set_custom_permissions_and_version_bumps(self):
        self.auth(self.owner)
        perms = {"inventory": {"view": True, "edit": False}, "sales": {"view": True}}
        resp = self.client.patch(
            self.url, {"permissions_json": perms}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.staff_membership.refresh_from_db()
        self.assertEqual(self.staff_membership.permissions_json, perms)
        self.assertEqual(self.staff_membership.permissions_version, 2)  # was 1

    def test_owner_can_change_role(self):
        self.auth(self.owner)
        resp = self.client.patch(self.url, {"role": "supervisor"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.staff_membership.refresh_from_db()
        self.assertEqual(self.staff_membership.role, "supervisor")

    def test_permissions_surface_in_memberships(self):
        self.auth(self.owner)
        self.client.patch(
            self.url, {"permissions_json": {"reports": {"view": True}}}, format="json"
        )
        # The staff member reads their own membership and sees the perms.
        self.auth(self.staff)
        shops = self.client.get(reverse("shop-memberships")).json()
        self.assertEqual(shops[0]["permissions_json"], {"reports": {"view": True}})

    def test_cashier_cannot_edit_permissions(self):
        # A non-admin actor cannot reach the team-detail surface at all.
        self.auth(self.staff)
        resp = self.client.patch(
            self.url, {"permissions_json": {"sales": {"view": True}}}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
