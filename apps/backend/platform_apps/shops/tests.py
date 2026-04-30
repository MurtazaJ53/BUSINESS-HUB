from __future__ import annotations

from django.test import TestCase
from rest_framework.test import APIClient

from platform_apps.common.migration import (
    MigrationBridgeMode,
    MigrationCutoverStatus,
    MigrationDomain,
    MigrationWriteMaster,
)
from platform_apps.jobs.models import MigrationDomainControl
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class ShopDomainStateApiTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="owner@example.com",
            password="secret",
            full_name="Owner",
        )
        self.other_user = PlatformUser.objects.create_user(
            email="viewer@example.com",
            password="secret",
            full_name="Viewer",
        )
        self.shop = Shop.objects.create(name="Demo Shop", slug="demo-shop")
        self.other_shop = Shop.objects.create(name="Other Shop", slug="other-shop")
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        ShopMembership.objects.create(
            user=self.other_user,
            shop=self.other_shop,
            role=ShopMembership.Role.VIEWER,
            status=ShopMembership.Status.ACTIVE,
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_domain_state_returns_legacy_defaults_when_no_control_exists(self):
        response = self.client.get(
            f"/api/v1/shops/{self.shop.id}/domain-state/{MigrationDomain.INVENTORY}/",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["shop_id"], str(self.shop.id))
        self.assertEqual(payload["domain"], MigrationDomain.INVENTORY)
        self.assertFalse(payload["control_present"])
        self.assertEqual(payload["write_master"], MigrationWriteMaster.FIREBASE)
        self.assertEqual(payload["bridge_mode"], MigrationBridgeMode.DISABLED)
        self.assertEqual(payload["cutover_status"], MigrationCutoverStatus.LEGACY)
        self.assertEqual(payload["current_epoch"], 1)
        self.assertFalse(payload["shadow_reads_enabled"])
        self.assertFalse(payload["can_write_on_postgres_surface"])

    def test_domain_state_returns_controlled_postgres_primary_state(self):
        MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            write_master=MigrationWriteMaster.POSTGRES,
            bridge_mode=MigrationBridgeMode.FIREBASE_TO_POSTGRES,
            cutover_status=MigrationCutoverStatus.POSTGRES_PRIMARY,
            current_epoch=7,
            shadow_reads_enabled=True,
            is_enabled=True,
        )

        response = self.client.get(
            f"/api/v1/shops/{self.shop.id}/domain-state/{MigrationDomain.INVENTORY}/",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["control_present"])
        self.assertEqual(payload["write_master"], MigrationWriteMaster.POSTGRES)
        self.assertEqual(payload["bridge_mode"], MigrationBridgeMode.FIREBASE_TO_POSTGRES)
        self.assertEqual(payload["cutover_status"], MigrationCutoverStatus.POSTGRES_PRIMARY)
        self.assertEqual(payload["current_epoch"], 7)
        self.assertTrue(payload["shadow_reads_enabled"])
        self.assertTrue(payload["can_write_on_postgres_surface"])

    def test_domain_state_requires_shop_membership(self):
        response = self.client.get(
            f"/api/v1/shops/{self.other_shop.id}/domain-state/{MigrationDomain.INVENTORY}/",
        )

        self.assertEqual(response.status_code, 403)

    def test_domain_state_rejects_unknown_domain(self):
        response = self.client.get(
            f"/api/v1/shops/{self.shop.id}/domain-state/not-a-real-domain/",
        )

        self.assertEqual(response.status_code, 404)
