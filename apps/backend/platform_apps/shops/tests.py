from __future__ import annotations

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.common.migration import (
    MigrationBridgeMode,
    MigrationControlEventType,
    MigrationCutoverStatus,
    MigrationDomain,
    MigrationJobStatus,
    MigrationJobType,
    MigrationWriteMaster,
)
from platform_apps.jobs.models import MigrationControlEvent, MigrationDomainControl, MigrationJobRun
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
        self.assertIsNone(payload["pilot_signoff_status"])
        self.assertIsNone(payload["pilot_signoff_summary"])

    def test_domain_state_returns_controlled_postgres_primary_state(self):
        control = MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            write_master=MigrationWriteMaster.POSTGRES,
            bridge_mode=MigrationBridgeMode.FIREBASE_TO_POSTGRES,
            cutover_status=MigrationCutoverStatus.POSTGRES_PRIMARY,
            current_epoch=7,
            shadow_reads_enabled=True,
            is_enabled=True,
        )
        MigrationJobRun.objects.create(
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            job_type=MigrationJobType.SHADOW_COMPARE,
            status=MigrationJobStatus.SUCCEEDED,
            actor_user=self.user,
            mismatch_count=0,
            trace_id="trace-shop-state-001",
            finished_at=timezone.now(),
        )
        MigrationControlEvent.objects.create(
            control=control,
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            event_type=MigrationControlEventType.VERIFY_PILOT,
            actor_user=self.user,
            result="production_safe",
            summary="Inventory pilot is clean and production-safe.",
            metadata_json={"healthy": True, "requires_rollback": False},
            occurred_at=timezone.now(),
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
        self.assertEqual(payload["pilot_signoff_status"], "production_safe")
        self.assertEqual(payload["pilot_latest_verify_result"], "production_safe")
        self.assertEqual(
            payload["pilot_recommended_action"],
            "Keep monitoring drift, bridge receipts, and operator activity.",
        )

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
