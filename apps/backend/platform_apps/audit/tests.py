from __future__ import annotations

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.audit.models import MigrationReconciliationEvent
from platform_apps.common.migration import MigrationDomain, ReconciliationSeverity, ReconciliationStatus
from platform_apps.shops.models import Shop
from platform_apps.users.models import PlatformUser


class MigrationReconciliationApiTests(TestCase):
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

    def test_create_reconciliation_event(self):
        response = self.client.post(
            "/api/v1/migration/reconciliation/",
            {
                "shop": str(self.shop.id),
                "domain": MigrationDomain.INVENTORY,
                "severity": ReconciliationSeverity.WARNING,
                "status": ReconciliationStatus.OPEN,
                "issue_code": "stock_mismatch",
                "entity_type": "inventory_item",
                "entity_id": "sku-001",
                "occurred_at": timezone.now().isoformat(),
                "mismatch_payload_json": {"firebase_stock": 3, "postgres_stock": 5},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(MigrationReconciliationEvent.objects.count(), 1)

    def test_resolving_event_stamps_resolver(self):
        event = MigrationReconciliationEvent.objects.create(
            shop=self.shop,
            domain=MigrationDomain.CUSTOMERS,
            severity=ReconciliationSeverity.CRITICAL,
            status=ReconciliationStatus.OPEN,
            issue_code="balance_drift",
            entity_type="customer",
            entity_id="cust-1",
            occurred_at=timezone.now(),
        )

        response = self.client.patch(
            f"/api/v1/migration/reconciliation/{event.id}/",
            {
                "status": ReconciliationStatus.RESOLVED,
                "resolution_note": "Verified and corrected from PostgreSQL truth.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        event.refresh_from_db()
        self.assertEqual(event.status, ReconciliationStatus.RESOLVED)
        self.assertEqual(event.resolver_user_id, self.user.id)
        self.assertIsNotNone(event.resolved_at)
