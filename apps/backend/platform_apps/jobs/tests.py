from __future__ import annotations

from django.test import TestCase
from django.utils import timezone
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
from platform_apps.jobs.models import MigrationBridgeReceipt, MigrationDomainControl, MigrationJobRun
from platform_apps.jobs.services import execute_migration_job
from platform_apps.projections.models import ShopDashboardSnapshot
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

    def test_list_bridge_receipts(self):
        MigrationBridgeReceipt.objects.create(
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            origin_system="firebase",
            origin_event_id="evt_list_001",
            command_type="upsert",
            entity_type="inventory_item",
            entity_id="inv_list_001",
            base_domain_epoch=1,
            payload_json={"name": "Bridge Tee"},
            applied_at=timezone.now(),
        )

        response = self.client.get("/api/v1/migration/bridge-receipts/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["origin_event_id"], "evt_list_001")

    def test_list_shadow_summaries(self):
        MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            write_master=MigrationWriteMaster.FIREBASE,
            bridge_mode=MigrationBridgeMode.FIREBASE_TO_POSTGRES,
            cutover_status=MigrationCutoverStatus.PILOT,
            current_epoch=4,
        )
        MigrationJobRun.objects.create(
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            job_type=MigrationJobType.SHADOW_COMPARE,
            status=MigrationJobStatus.SUCCEEDED,
            actor_user=self.user,
            mismatch_count=2,
            trace_id="trace-shadow-001",
        )
        MigrationReconciliationEvent.objects.create(
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            severity="critical",
            status="open",
            issue_code="field_drift",
            entity_type="inventory_item",
            entity_id="inv_001",
            expected_master="firebase",
            observed_source="postgres",
            occurred_at=timezone.now(),
        )

        response = self.client.get("/api/v1/migration/shadow-summaries/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["domain"], MigrationDomain.INVENTORY)
        self.assertEqual(response.data[0]["current_epoch"], 4)
        self.assertEqual(response.data[0]["latest_compare_mismatches"], 2)
        self.assertEqual(response.data[0]["open_critical_events"], 1)

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

    def _create_reporting_control(self) -> MigrationDomainControl:
        return MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=MigrationDomain.REPORTING,
            write_master=MigrationWriteMaster.POSTGRES,
            bridge_mode=MigrationBridgeMode.DISABLED,
            cutover_status=MigrationCutoverStatus.PILOT,
            shadow_reads_enabled=False,
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

    def test_reporting_projection_refresh_job_builds_dashboard_snapshot(self):
        self._create_reporting_control()
        item = InventoryItem.objects.create(
            shop=self.shop,
            name="Projection Tee",
            sku="PROJ-TEE",
            category="Tees",
            sell_price="399.00",
        )
        customer = Customer.objects.create(
            shop=self.shop,
            name="Projection Customer",
            phone="9000000000",
            total_spent="550.00",
            balance="60.00",
        )
        # Reuse the existing stock-adjust path assumptions by seeding a backfill row into the ledger model indirectly
        from platform_apps.inventory.models import InventoryStockLedger
        from platform_apps.payments.models import SalePayment
        from platform_apps.sales.models import Sale

        InventoryStockLedger.objects.create(
            shop=self.shop,
            item=item,
            event_type=InventoryStockLedger.EventType.OPENING_BALANCE,
            quantity_delta=2,
            unit_price=item.sell_price,
            occurred_at="2026-04-30T09:00:00+05:30",
        )
        sale = Sale.objects.create(
            shop=self.shop,
            actor_user=self.user,
            customer=customer,
            receipt_number="S-PROJ-001",
            subtotal_amount="550.00",
            total_amount="550.00",
            amount_received="500.00",
            amount_due="50.00",
            payment_mode=Sale.PaymentMode.UPI,
            customer_name_snapshot="Projection Customer",
            customer_phone_snapshot="9000000000",
            sale_date="2026-04-30",
            occurred_at="2026-04-30T10:00:00+05:30",
            status=Sale.Status.COMPLETED,
        )
        SalePayment.objects.create(
            sale=sale,
            shop=self.shop,
            actor_user=self.user,
            payment_method=SalePayment.PaymentMethod.UPI,
            amount="500.00",
            occurred_at="2026-04-30T10:00:00+05:30",
        )

        job = MigrationJobRun.objects.create(
            shop=self.shop,
            domain=MigrationDomain.REPORTING,
            job_type=MigrationJobType.PROJECTION_REFRESH,
            actor_user=self.user,
            payload_json={"phase": 2},
        )

        execute_migration_job(str(job.id))

        job.refresh_from_db()
        snapshot = ShopDashboardSnapshot.objects.get(shop=self.shop)
        self.assertEqual(job.status, MigrationJobStatus.SUCCEEDED)
        self.assertGreaterEqual(job.rows_scanned, 4)
        self.assertEqual(snapshot.inventory_items_count, 1)
        self.assertEqual(snapshot.customer_count, 1)
        self.assertEqual(snapshot.sales_count, 1)
        self.assertEqual(snapshot.payment_count, 1)

    def test_inventory_bridge_replay_applies_once_and_skips_duplicates(self):
        self.control.bridge_mode = MigrationBridgeMode.FIREBASE_TO_POSTGRES
        self.control.save(update_fields=["bridge_mode", "updated_at"])

        job = MigrationJobRun.objects.create(
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            job_type=MigrationJobType.BRIDGE_REPLAY,
            actor_user=self.user,
            payload_json={
                "bridge_event": {
                    "origin_system": "firebase",
                    "origin_event_id": "evt_inventory_001",
                    "command_type": "upsert",
                    "entity_type": "inventory_item",
                    "entity_id": "inv_bridge_001",
                    "base_domain_epoch": self.control.current_epoch,
                    "record": {
                        "name": "Bridge Tee",
                        "sku": "BRG-TEE",
                        "sell_price": "345.00",
                    },
                }
            },
        )

        execute_migration_job(str(job.id))

        job.refresh_from_db()
        self.assertEqual(job.status, MigrationJobStatus.SUCCEEDED)
        self.assertEqual(job.rows_written, 1)
        self.assertTrue(
            InventoryItem.objects.filter(
                shop=self.shop,
                source_system="firebase",
                source_id="inv_bridge_001",
                name="Bridge Tee",
            ).exists()
        )
        self.assertEqual(MigrationBridgeReceipt.objects.filter(shop=self.shop, domain=MigrationDomain.INVENTORY).count(), 1)

        duplicate_job = MigrationJobRun.objects.create(
            shop=self.shop,
            domain=MigrationDomain.INVENTORY,
            job_type=MigrationJobType.BRIDGE_REPLAY,
            actor_user=self.user,
            payload_json=job.payload_json,
        )

        execute_migration_job(str(duplicate_job.id))

        duplicate_job.refresh_from_db()
        self.assertEqual(duplicate_job.status, MigrationJobStatus.SUCCEEDED)
        self.assertEqual(duplicate_job.rows_written, 0)
        self.assertEqual(duplicate_job.rows_skipped, 1)
        self.assertEqual(MigrationBridgeReceipt.objects.filter(shop=self.shop, domain=MigrationDomain.INVENTORY).count(), 1)

    def test_customer_bridge_replay_rejects_stale_epoch_with_reconciliation_event(self):
        customer_control = self._create_customer_control()
        customer_control.bridge_mode = MigrationBridgeMode.FIREBASE_TO_POSTGRES
        customer_control.current_epoch = 3
        customer_control.save(update_fields=["bridge_mode", "current_epoch", "updated_at"])

        job = MigrationJobRun.objects.create(
            shop=self.shop,
            domain=MigrationDomain.CUSTOMERS,
            job_type=MigrationJobType.BRIDGE_REPLAY,
            actor_user=self.user,
            payload_json={
                "bridge_event": {
                    "origin_system": "firebase",
                    "origin_event_id": "evt_customer_001",
                    "command_type": "upsert",
                    "entity_type": "customer",
                    "entity_id": "cust_bridge_001",
                    "base_domain_epoch": 2,
                    "record": {
                        "name": "Bridge Customer",
                        "phone": "9090909090",
                        "balance": "50.00",
                    },
                }
            },
        )

        execute_migration_job(str(job.id))

        job.refresh_from_db()
        self.assertEqual(job.status, MigrationJobStatus.SUCCEEDED)
        self.assertEqual(job.rows_written, 0)
        self.assertEqual(job.rows_skipped, 1)
        self.assertEqual(job.mismatch_count, 1)
        self.assertFalse(Customer.objects.filter(shop=self.shop, source_id="cust_bridge_001").exists())
        self.assertTrue(
            MigrationReconciliationEvent.objects.filter(
                shop=self.shop,
                domain=MigrationDomain.CUSTOMERS,
                issue_code="stale_bridge_epoch",
                entity_type="customer",
                entity_id="cust_bridge_001",
            ).exists()
        )
