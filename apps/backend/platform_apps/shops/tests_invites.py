"""Tests for the employee invitation system (Phase 2)."""
from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from platform_apps.shops.models import ShopInvite, ShopMembership
from platform_apps.shops.provisioning import provision_shop

User = get_user_model()


class InviteTestBase(APITestCase):
    def setUp(self):
        self.owner = User(email="owner@shop.test", full_name="Owner", is_active=True)
        self.owner.set_password("ownerpass1")
        self.owner.save()
        self.shop, self.owner_membership = provision_shop(
            owner=self.owner, business_name="Owner Shop"
        )

    def auth(self, user):
        from platform_apps.users.jwt_auth import issue_tokens

        token = issue_tokens(user)["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def create_invite(self, role="cashier", email="new@staff.test"):
        self.auth(self.owner)
        return self.client.post(
            reverse("shop-invites", args=[self.shop.id]),
            {"email": email, "role": role},
            format="json",
        )


class InviteCreateTests(InviteTestBase):
    def test_owner_can_invite_and_email_is_recorded(self):
        resp = self.create_invite(role="cashier")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        body = resp.json()
        self.assertEqual(body["role"], "cashier")
        self.assertEqual(body["status"], "pending")
        self.assertTrue(body["invite_code"])
        self.assertEqual(ShopInvite.objects.filter(shop=self.shop).count(), 1)

    def test_owner_cannot_invite_as_owner(self):
        resp = self.create_invite(role="owner")
        self.assertIn(resp.status_code, (status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN))

    def test_manager_cannot_assign_admin(self):
        # Add a manager, then have them try to invite an admin (equal rank).
        manager = User(email="mgr@shop.test", full_name="Mgr", is_active=True)
        manager.set_password("mgrpass12")
        manager.save()
        ShopMembership.objects.create(
            shop=self.shop, user=manager, role=ShopMembership.Role.MANAGER,
            status=ShopMembership.Status.ACTIVE, email=manager.email,
        )
        self.auth(manager)
        resp = self.client.post(
            reverse("shop-invites", args=[self.shop.id]),
            {"email": "x@y.test", "role": "admin"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_manager_cannot_invite(self):
        cashier = User(email="cash@shop.test", full_name="Cash", is_active=True)
        cashier.set_password("cashpass1")
        cashier.save()
        ShopMembership.objects.create(
            shop=self.shop, user=cashier, role=ShopMembership.Role.CASHIER,
            status=ShopMembership.Status.ACTIVE, email=cashier.email,
        )
        self.auth(cashier)
        resp = self.client.post(
            reverse("shop-invites", args=[self.shop.id]),
            {"email": "x@y.test", "role": "viewer"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_cannot_invite_existing_active_member(self):
        # owner is already active
        resp = self.create_invite(email=self.owner.email)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class InvitePreviewAcceptTests(InviteTestBase):
    def _token(self, role="cashier", email="joiner@staff.test"):
        return self.create_invite(role=role, email=email).json()["invite_code"]

    def test_preview_is_public(self):
        token = self._token()
        self.client.credentials()  # unauthenticated
        resp = self.client.get(reverse("invite-preview", args=[token]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["shop_name"], "Owner Shop")
        self.assertEqual(resp.json()["role"], "cashier")

    def test_new_user_accepts_and_gets_scoped_session(self):
        token = self._token(email="brandnew@staff.test")
        self.client.credentials()
        resp = self.client.post(
            reverse("invite-accept"),
            {"token": token, "name": "Brand New", "password": "joinerpass1"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        body = resp.json()
        self.assertEqual(body["role"], "cashier")
        self.assertEqual(body["shop_id"], str(self.shop.id))
        # Membership active.
        membership = ShopMembership.objects.get(
            shop=self.shop, user__email="brandnew@staff.test"
        )
        self.assertEqual(membership.status, ShopMembership.Status.ACTIVE)
        # Invite consumed.
        self.assertEqual(
            ShopInvite.objects.get(token=token).status, ShopInvite.Status.ACCEPTED
        )
        # Isolation: the new member sees ONLY this shop.
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {body['access']}")
        shops = self.client.get(reverse("shop-memberships")).json()
        self.assertEqual(len(shops), 1)
        self.assertEqual(shops[0]["shop_id"], str(self.shop.id))

    def test_existing_user_accepts_with_correct_password(self):
        existing = User(email="exists@staff.test", full_name="Ex", is_active=True)
        existing.set_password("existingpass1")
        existing.save()
        token = self._token(email="exists@staff.test")
        self.client.credentials()
        resp = self.client.post(
            reverse("invite-accept"),
            {"token": token, "password": "existingpass1"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_existing_user_wrong_password_rejected(self):
        existing = User(email="exists2@staff.test", full_name="Ex", is_active=True)
        existing.set_password("existingpass1")
        existing.save()
        token = self._token(email="exists2@staff.test")
        self.client.credentials()
        resp = self.client.post(
            reverse("invite-accept"),
            {"token": token, "password": "wrongpass99"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_expired_invite_rejected(self):
        token = self._token()
        ShopInvite.objects.filter(token=token).update(
            expires_at=timezone.now() - timedelta(days=1)
        )
        self.client.credentials()
        resp = self.client.post(
            reverse("invite-accept"),
            {"token": token, "name": "X", "password": "somepass12"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_revoked_invite_rejected(self):
        token = self._token()
        invite = ShopInvite.objects.get(token=token)
        self.auth(self.owner)
        self.client.post(
            reverse("shop-invite-revoke", args=[self.shop.id, invite.id])
        )
        self.client.credentials()
        resp = self.client.post(
            reverse("invite-accept"),
            {"token": token, "name": "X", "password": "somepass12"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_invite_cannot_be_used_twice(self):
        token = self._token(email="once@staff.test")
        self.client.credentials()
        first = self.client.post(
            reverse("invite-accept"),
            {"token": token, "name": "Once", "password": "oncepass12"}, format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        second = self.client.post(
            reverse("invite-accept"),
            {"token": token, "name": "Once", "password": "oncepass12"}, format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_403_FORBIDDEN)

    def test_bad_token_is_not_found(self):
        self.client.credentials()
        resp = self.client.get(reverse("invite-preview", args=["nope-nope"]))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
