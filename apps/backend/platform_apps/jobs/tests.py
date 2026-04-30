from __future__ import annotations

from django.test import TestCase
from rest_framework.test import APIClient

from platform_apps.audit.models import MigrationReconciliationEvent
from platform_apps.common.migration import (
    MigrationBridgeMode,
    MigrationCutoverStatus,
    MigrationDomain,
    MigrationJobStatus,
    MigrationJobType,
    MigrationWriteMaster,
)
from platform_apps.customers.models import Customer
from platform_apps.inventory.models import InventoryItem
from platform_apps.jobs.models import MigrationDomainControl, MigrationJobRun
from platform_apps.jobs.services import execute_migration_job
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


class MigrationExecutionTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="platform@example.com",
            password="secret",
            full_name="Platform Admin",
            is_platform_admin=True,
        )
        self.shop = Shop.objects.create(
            name="Demo Shop",
            slug="demo-shop",
            source_system="firebase",
            source_id="shop_001",
            source_shop_id="shop_001",
            source_path="shops/shop_001",
        )
        self.control = MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            write_master=MigrationWriteMaster.FIREBASE,
            bridge_mode=MigrationBridgeMode.COMPARE_ONLY,
            cutover_status=MigrationCutoverStatus.PILOT,
            shadow_reads_enabled=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _create_customer_control(self) -> MigrationDomainControl:
        return MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=MigrationDomain.CUSTOMERS,
            write_master=MigrationWriteMaster.FIREBASE,
            bridge_mode=MigrationBridgeMode.COMPARE_ONLY,
            cutover_status=MigrationCutoverStatus.PILOT,
            shadow_reads_enabled=True,
        )

    def test_inventory_backfill_creates_and_updates_source_tracked_items(self):
        job = MigrationJobRun.objects.create(
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            job_type=MigrationJobType.BACKFILL,
            actor_user=self.user,
            payload_json={
                "source_snapshot": [
                    {
                        "id": "inv_001",
                        "name": "Blue Shirt",
                        "sku": "SKU-001",
                        "price": "499.50",
                        "category": "Clothing",
                    },
                    {
                        "id": "inv_002",
                        "name": "Black Jeans",
                        "sell_price": "899.00",
                        "status": "active",
                    },
                ]
            },
        )

        execute_migration_job(str(job.id))

        job.refresh_from_db()
        self.assertEqual(job.status, MigrationJobStatus.SUCCEEDED)
        self.assertEqual(job.rows_scanned, 2)
        self.assertEqual(job.rows_written, 2)
        self.assertEqual(job.rows_skipped, 0)

        item = InventoryItem.objects.get(shop=self.shop, source_system="firebase", source_id="inv_001")
        self.assertEqual(item.name, "Blue Shirt")
        self.assertEqual(str(item.sell_price), "499.50")
        self.assertEqual(item.source_shop_id, "shop_001")
        self.assertEqual(item.source_path, "shops/shop_001/inventory/inv_001")
        self.assertIsNotNone(item.migrated_at)

        update_job = MigrationJobRun.objects.create(
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            job_type=MigrationJobType.BACKFILL,
            actor_user=self.user,
            payload_json={
                "source_snapshot": [
                    {
                        "id": "inv_001",
                        "name": "Blue Shirt Premium",
                        "sell_price": "549.00",
                        "sku": "SKU-001",
                    }
                ]
            },
        )

        execute_migration_job(str(update_job.id))

        update_job.refresh_from_db()
        item.refresh_from_db()
        self.assertEqual(update_job.status, MigrationJobStatus.SUCCEEDED)
        self.assertEqual(update_job.rows_written, 1)
        self.assertEqual(item.name, "Blue Shirt Premium")
        self.assertEqual(str(item.sell_price), "549.00")

    def test_inventory_shadow_compare_records_and_auto_resolves_reconciliation_events(self):
        InventoryItem.objects.create(
            shop=self.shop,
            source_system="firebase",
            source_id="inv_001",
            source_shop_id="shop_001",
            source_path="shops/shop_001/inventory/inv_001",
            name="Blue Shirt",
            sku="SKU-001",
            sell_price="100.00",
        )
        InventoryItem.objects.create(
            shop=self.shop,
            source_system="firebase",
            source_id="inv_extra",
            source_shop_id="shop_001",
            source_path="shops/shop_001/inventory/inv_extra",
            name="Ghost Item",
            sku="GHOST",
            sell_price="50.00",
        )

        job = MigrationJobRun.objects.create(
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            job_type=MigrationJobType.SHADOW_COMPARE,
            actor_user=self.user,
            payload_json={
                "source_snapshot": [
                    {
                        "id": "inv_001",
                        "name": "Blue Shirt",
                        "sku": "SKU-001",
                        "sell_price": "125.00",
                    },
                    {
                        "id": "inv_002",
                        "name": "Black Jeans",
                        "sell_price": "899.00",
                    },
                ]
            },
        )

        execute_migration_job(str(job.id))

        job.refresh_from_db()
        self.assertEqual(job.status, MigrationJobStatus.SUCCEEDED)
        self.assertEqual(job.rows_scanned, 2)
        self.assertEqual(job.mismatch_count, 3)
        self.assertEqual(MigrationReconciliationEvent.objects.filter(shop=self.shop).count(), 3)

        drift_event = MigrationReconciliationEvent.objects.get(shop=self.shop, issue_code="field_drift")
        self.assertEqual(drift_event.status, "open")

        second_job = MigrationJobRun.objects.create(
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            job_type=MigrationJobType.SHADOW_COMPARE,
            actor_user=self.user,
            payload_json={
                "source_snapshot": [
                    {
                        "id": "inv_001",
                        "name": "Blue Shirt",
                        "sku": "SKU-001",
                        "sell_price": "100.00",
                    },
                    {
                        "id": "inv_extra",
                        "name": "Ghost Item",
                        "sku": "GHOST",
                        "sell_price": "50.00",
                    },
                ]
            },
        )

        execute_migration_job(str(second_job.id))

        second_job.refresh_from_db()
        drift_event.refresh_from_db()
        self.assertEqual(second_job.status, MigrationJobStatus.SUCCEEDED)
        self.assertEqual(second_job.mismatch_count, 0)
        self.assertEqual(drift_event.status, "resolved")
        self.assertIsNotNone(drift_event.resolved_at)

    def test_run_inline_query_executes_job_immediately(self):
        response = self.client.post(
            "/api/v1/migration/jobs/?run_inline=1",
            {
                "shop": str(self.shop.id),
                "domain": MigrationDomain.INVENTORY,
                "job_type": MigrationJobType.BACKFILL,
                "payload_json": {
                    "source_snapshot": [
                        {
                            "id": "inv_003",
                            "name": "Inline Trigger Tee",
                            "sell_price": "299.00",
                        }
                    ]
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], MigrationJobStatus.SUCCEEDED)
        self.assertEqual(response.data["rows_written"], 1)
        self.assertTrue(
            InventoryItem.objects.filter(
                shop=self.shop,
                source_system="firebase",
                source_id="inv_003",
            ).exists()
        )

    def test_customer_backfill_creates_and_updates_source_tracked_customers(self):
        self._create_customer_control()
        job = MigrationJobRun.objects.create(
            shop=self.shop,
            domain=MigrationDomain.CUSTOMERS,
            job_type=MigrationJobType.BACKFILL,
            actor_user=self.user,
            payload_json={
                "source_snapshot": [
                    {
                        "id": "cust_001",
                        "name": "Amina Patel",
                        "phone": "9999999999",
                        "email": "amina@example.com",
                        "totalSpent": "1225.50",
                        "dueBalance": "150.00",
                    },
                    {
                        "id": "cust_002",
                        "name": "Bharat Shah",
                        "mobile": "8888888888",
                        "balance": "0.00",
                    },
                ]
            },
        )

        execute_migration_job(str(job.id))

        job.refresh_from_db()
        self.assertEqual(job.status, MigrationJobStatus.SUCCEEDED)
        self.assertEqual(job.rows_scanned, 2)
        self.assertEqual(job.rows_written, 2)

        customer = Customer.objects.get(shop=self.shop, source_system="firebase", source_id="cust_001")
        self.assertEqual(customer.name, "Amina Patel")
        self.assertEqual(customer.phone, "9999999999")
        self.assertEqual(str(customer.total_spent), "1225.50")
        self.assertEqual(str(customer.balance), "150.00")
        self.assertEqual(customer.source_path, "shops/shop_001/customers/cust_001")
        self.assertIsNotNone(customer.migrated_at)

        update_job = MigrationJobRun.objects.create(
            shop=self.shop,
            domain=MigrationDomain.CUSTOMERS,
            job_type=MigrationJobType.BACKFILL,
            actor_user=self.user,
            payload_json={
                "source_snapshot": [
                    {
                        "id": "cust_001",
                        "name": "Amina Patel VIP",
                        "phone": "9999999999",
                        "balance": "90.00",
                    }
                ]
            },
        )

        execute_migration_job(str(update_job.id))

        update_job.refresh_from_db()
        customer.refresh_from_db()
        self.assertEqual(update_job.status, MigrationJobStatus.SUCCEEDED)
        self.assertEqual(update_job.rows_written, 1)
        self.assertEqual(customer.name, "Amina Patel VIP")
        self.assertEqual(str(customer.balance), "90.00")

    def test_customer_shadow_compare_records_and_auto_resolves_reconciliation_events(self):
        self._create_customer_control()
        Customer.objects.create(
            shop=self.shop,
            source_system="firebase",
            source_id="cust_001",
            source_shop_id="shop_001",
            source_path="shops/shop_001/customers/cust_001",
            name="Amina Patel",
            phone="9999999999",
            balance="120.00",
            total_spent="500.00",
        )
        Customer.objects.create(
            shop=self.shop,
            source_system="firebase",
            source_id="cust_extra",
            source_shop_id="shop_001",
            source_path="shops/shop_001/customers/cust_extra",
            name="Ghost Customer",
            phone="7777777777",
            balance="0.00",
            total_spent="0.00",
        )

        job = MigrationJobRun.objects.create(
            shop=self.shop,
            domain=MigrationDomain.CUSTOMERS,
            job_type=MigrationJobType.SHADOW_COMPARE,
            actor_user=self.user,
            payload_json={
                "source_snapshot": [
                    {
                        "id": "cust_001",
                        "name": "Amina Patel",
                        "phone": "9999999999",
                        "balance": "150.00",
                        "totalSpent": "500.00",
                    },
                    {
                        "id": "cust_002",
                        "name": "Bharat Shah",
                        "mobile": "8888888888",
                    },
                ]
            },
        )

        execute_migration_job(str(job.id))

        job.refresh_from_db()
        self.assertEqual(job.status, MigrationJobStatus.SUCCEEDED)
        self.assertEqual(job.rows_scanned, 2)
        self.assertEqual(job.mismatch_count, 3)
        self.assertEqual(
            MigrationReconciliationEvent.objects.filter(shop=self.shop, domain=MigrationDomain.CUSTOMERS).count(),
            3,
        )

        drift_event = MigrationReconciliationEvent.objects.get(
            shop=self.shop,
            domain=MigrationDomain.CUSTOMERS,
            issue_code="field_drift",
            entity_type="customer",
        )
        self.assertEqual(drift_event.status, "open")

        second_job = MigrationJobRun.objects.create(
            shop=self.shop,
            domain=MigrationDomain.CUSTOMERS,
            job_type=MigrationJobType.SHADOW_COMPARE,
            actor_user=self.user,
            payload_json={
                "source_snapshot": [
                    {
                        "id": "cust_001",
                        "name": "Amina Patel",
                        "phone": "9999999999",
                        "balance": "120.00",
                        "totalSpent": "500.00",
                    },
                    {
                        "id": "cust_extra",
                        "name": "Ghost Customer",
                        "mobile": "7777777777",
                        "balance": "0.00",
                        "totalSpent": "0.00",
                    },
                ]
            },
        )

        execute_migration_job(str(second_job.id))

        second_job.refresh_from_db()
        drift_event.refresh_from_db()
        self.assertEqual(second_job.status, MigrationJobStatus.SUCCEEDED)
        self.assertEqual(second_job.mismatch_count, 0)
        self.assertEqual(drift_event.status, "resolved")
        self.assertIsNotNone(drift_event.resolved_at)
