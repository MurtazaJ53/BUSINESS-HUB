from __future__ import annotations

from django.test import TestCase
from rest_framework.test import APIClient

from platform_apps.common.migration import (
    MigrationBridgeMode,
    MigrationCutoverStatus,
    MigrationDomain,
    MigrationJobStatus,
    MigrationJobType,
    MigrationWriteMaster,
)
from platform_apps.jobs.models import MigrationDomainControl, MigrationJobRun
from platform_apps.shops.models import Shop
from platform_apps.users.models import PlatformUser


class MigrationControlApiTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="platform@example.com",
            password="secret",
            full_name="Platform Admin",
            is_platform_admin=True,
        )
        self.shop = Shop.objects.create(name="Demo Shop", slug="demo-shop")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_domain_control(self):
        response = self.client.post(
            "/api/v1/migration/domains/",
            {
                "shop": str(self.shop.id),
                "domain": MigrationDomain.INVENTORY,
                "write_master": MigrationWriteMaster.FIREBASE,
                "bridge_mode": MigrationBridgeMode.COMPARE_ONLY,
                "cutover_status": MigrationCutoverStatus.LEGACY,
                "current_epoch": 1,
                "shadow_reads_enabled": True,
                "metadata_json": {"owner": "phase-2"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        control = MigrationDomainControl.objects.get()
        self.assertEqual(control.domain, MigrationDomain.INVENTORY)
        self.assertTrue(control.shadow_reads_enabled)

    def test_create_job_run(self):
        control = MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=MigrationDomain.CUSTOMERS,
            write_master=MigrationWriteMaster.FIREBASE,
            bridge_mode=MigrationBridgeMode.COMPARE_ONLY,
            cutover_status=MigrationCutoverStatus.LEGACY,
        )
        self.assertIsNotNone(control)

        response = self.client.post(
            "/api/v1/migration/jobs/",
            {
                "shop": str(self.shop.id),
                "domain": MigrationDomain.CUSTOMERS,
                "job_type": MigrationJobType.BACKFILL,
                "status": MigrationJobStatus.QUEUED,
                "rows_scanned": 0,
                "rows_written": 0,
                "rows_skipped": 0,
                "mismatch_count": 0,
                "payload_json": {"phase": 2},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(MigrationJobRun.objects.count(), 1)

    def test_non_platform_admin_is_blocked(self):
        non_admin = PlatformUser.objects.create_user(email="staff@example.com", password="secret", full_name="Staff")
        self.client.force_authenticate(user=non_admin)

        response = self.client.get("/api/v1/migration/domains/")

        self.assertEqual(response.status_code, 403)
