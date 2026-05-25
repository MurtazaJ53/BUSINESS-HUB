from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.audit.models import WorkspaceAuditEvent
from platform_apps.customers.models import Customer
from platform_apps.inventory.models import InventoryItem, InventoryStockLedger
from platform_apps.payments.models import SalePayment
from platform_apps.projections.models import (
    ShopDashboardSnapshot,
    ShopLowStockSnapshot,
    ShopPulseSignal,
)
from platform_apps.projections.pulse import build_shop_pulse_snapshot, sync_shop_pulse_signals
from platform_apps.projections.services import refresh_shop_dashboard_projection
from platform_apps.sales.models import Sale
from platform_apps.shops.models import Shop, ShopMembership, ShopPlanRequest, WorkspaceAccessSession
from platform_apps.users.models import PlatformUser


class ProjectionRefreshTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="owner@example.com",
            password="secret",
            full_name="Owner",
        )
        self.staff_user = PlatformUser.objects.create_user(
            email="staff@example.com",
            password="secret",
            full_name="Staff Member",
        )
        self.admin_user = PlatformUser.objects.create_user(
            email="admin@example.com",
            password="secret",
            full_name="Admin Member",
        )
        self.shop = Shop.objects.create(name="Projection Shop", slug="projection-shop")
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.staff_membership = ShopMembership.objects.create(
            user=self.staff_user,
            shop=self.shop,
            role=ShopMembership.Role.STAFF,
            status=ShopMembership.Status.ACTIVE,
        )
        self.admin_membership = ShopMembership.objects.create(
            user=self.admin_user,
            shop=self.shop,
            role=ShopMembership.Role.ADMIN,
            status=ShopMembership.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _seed_domain_data(self):
        low_stock = InventoryItem.objects.create(
            shop=self.shop,
            name="Blue Tee",
            sku="BLU-TEE",
            category="Tees",
            sell_price="499.00",
        )
        healthy_stock = InventoryItem.objects.create(
            shop=self.shop,
            name="Denim",
            sku="DEN-001",
            category="Jeans",
            sell_price="899.00",
        )
        zero_stock = InventoryItem.objects.create(
            shop=self.shop,
            name="Cap",
            sku="CAP-001",
            category="Accessories",
            sell_price="199.00",
        )

        InventoryStockLedger.objects.create(
            shop=self.shop,
            item=low_stock,
            event_type=InventoryStockLedger.EventType.OPENING_BALANCE,
            quantity_delta=3,
            unit_price=low_stock.sell_price,
            occurred_at="2026-04-30T09:00:00+05:30",
        )
        InventoryStockLedger.objects.create(
            shop=self.shop,
            item=healthy_stock,
            event_type=InventoryStockLedger.EventType.OPENING_BALANCE,
            quantity_delta=7,
            unit_price=healthy_stock.sell_price,
            occurred_at="2026-04-30T09:00:00+05:30",
        )
        InventoryStockLedger.objects.create(
            shop=self.shop,
            item=zero_stock,
            event_type=InventoryStockLedger.EventType.OPENING_BALANCE,
            quantity_delta=0,
            unit_price=zero_stock.sell_price,
            occurred_at="2026-04-30T09:00:00+05:30",
        )

        customer = Customer.objects.create(
            shop=self.shop,
            name="Amina Patel",
            phone="9999999999",
            total_spent="650.00",
            balance="80.00",
        )

        sale = Sale.objects.create(
            shop=self.shop,
            actor_user=self.user,
            customer=customer,
            receipt_number="S-0001",
            subtotal_amount="650.00",
            total_amount="650.00",
            amount_received="500.00",
            amount_due="150.00",
            payment_mode=Sale.PaymentMode.SPLIT,
            customer_name_snapshot="Amina Patel",
            customer_phone_snapshot="9999999999",
            sale_date="2026-04-30",
            occurred_at="2026-04-30T11:00:00+05:30",
            status=Sale.Status.COMPLETED,
        )
        SalePayment.objects.create(
            sale=sale,
            shop=self.shop,
            actor_user=self.user,
            payment_method=SalePayment.PaymentMethod.CASH,
            amount="300.00",
            occurred_at="2026-04-30T11:00:00+05:30",
        )
        SalePayment.objects.create(
            sale=sale,
            shop=self.shop,
            actor_user=self.user,
            payment_method=SalePayment.PaymentMethod.UPI,
            amount="200.00",
            occurred_at="2026-04-30T11:01:00+05:30",
        )

    def test_refresh_shop_dashboard_projection_builds_snapshot_and_low_stock_preview(self):
        self._seed_domain_data()

        snapshot = refresh_shop_dashboard_projection(self.shop)

        self.assertEqual(snapshot.inventory_items_count, 3)
        self.assertEqual(snapshot.active_inventory_items_count, 3)
        self.assertEqual(snapshot.category_count, 3)
        self.assertEqual(snapshot.low_stock_items_count, 1)
        self.assertEqual(snapshot.out_of_stock_items_count, 1)
        self.assertEqual(snapshot.projected_sell_value, Decimal("7790.00"))
        self.assertEqual(snapshot.customer_count, 1)
        self.assertEqual(snapshot.active_credit_customers_count, 1)
        self.assertEqual(snapshot.total_outstanding_balance, Decimal("80.00"))
        self.assertEqual(snapshot.total_lifetime_spend, Decimal("650.00"))
        self.assertEqual(snapshot.sales_count, 1)
        self.assertEqual(snapshot.gross_revenue, Decimal("650.00"))
        self.assertEqual(snapshot.outstanding_revenue, Decimal("150.00"))
        self.assertEqual(snapshot.payment_count, 2)
        self.assertEqual(snapshot.total_collected, Decimal("500.00"))
        self.assertEqual(snapshot.credit_payment_count, 0)
        self.assertEqual(snapshot.digital_payment_count, 1)
        self.assertEqual(snapshot.low_stock_preview.count(), 1)
        self.assertEqual(snapshot.low_stock_preview.first().item_name, "Blue Tee")
        self.assertEqual(ShopLowStockSnapshot.objects.filter(shop=self.shop).count(), 1)

    def test_dashboard_snapshot_api_returns_projection_payload(self):
        self._seed_domain_data()

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/projections/dashboard/?refresh=1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["inventory_items_count"], 3)
        self.assertEqual(len(response.data["low_stock_preview"]), 1)
        self.assertEqual(response.data["low_stock_preview"][0]["item_name"], "Blue Tee")

    def test_dashboard_snapshot_api_redacts_advanced_finance_fields_for_starter_plan(self):
        self.shop.settings_json = {
            "plan_tier": "starter",
        }
        self.shop.save(update_fields=["settings_json", "updated_at"])
        self._seed_domain_data()

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/projections/dashboard/?refresh=1")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["projected_sell_value"])
        self.assertIsNone(response.data["total_lifetime_spend"])
        self.assertIsNone(response.data["total_outstanding_balance"])
        self.assertIsNone(response.data["gross_revenue"])
        self.assertIsNone(response.data["outstanding_revenue"])
        self.assertIsNone(response.data["total_collected"])
        self.assertEqual(response.data["sales_count"], 1)
        self.assertEqual(response.data["active_credit_customers_count"], 1)

    def test_dashboard_snapshot_api_keeps_finance_fields_for_pro_plan(self):
        self.shop.settings_json = {
            "plan_tier": "pro",
        }
        self.shop.save(update_fields=["settings_json", "updated_at"])
        self._seed_domain_data()

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/projections/dashboard/?refresh=1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["projected_sell_value"], "7790.00")
        self.assertEqual(response.data["total_lifetime_spend"], "650.00")
        self.assertEqual(response.data["total_outstanding_balance"], "80.00")
        self.assertEqual(response.data["gross_revenue"], "650.00")
        self.assertEqual(response.data["outstanding_revenue"], "150.00")
        self.assertEqual(response.data["total_collected"], "500.00")

    def test_build_shop_pulse_snapshot_generates_tasks_and_anomalies(self):
        self.shop.settings_json = {"plan_tier": "pro"}
        self.shop.save(update_fields=["settings_json", "updated_at"])
        self._seed_domain_data()

        sale = Sale.objects.filter(shop=self.shop, status=Sale.Status.COMPLETED).first()
        sale.discount_amount = Decimal("120.00")
        sale.sale_date = timezone.localdate()
        sale.occurred_at = timezone.now()
        sale.save(update_fields=["discount_amount", "sale_date", "occurred_at", "updated_at"])

        for index in range(2):
            Sale.objects.create(
                shop=self.shop,
                actor_user=self.user,
                receipt_number=f"VOID-{index}",
                subtotal_amount="200.00",
                total_amount="200.00",
                amount_received="0.00",
                amount_due="0.00",
                payment_mode=Sale.PaymentMode.CASH,
                sale_date="2026-04-30",
                occurred_at=timezone.now(),
                status=Sale.Status.VOID,
            )

        InventoryStockLedger.objects.create(
            shop=self.shop,
            item=InventoryItem.objects.filter(shop=self.shop, sku="DEN-001").first(),
            event_type=InventoryStockLedger.EventType.ADJUSTMENT,
            quantity_delta=-6,
            occurred_at=timezone.now(),
        )
        InventoryStockLedger.objects.create(
            shop=self.shop,
            item=InventoryItem.objects.filter(shop=self.shop, sku="DEN-001").first(),
            event_type=InventoryStockLedger.EventType.ADJUSTMENT,
            quantity_delta=-4,
            occurred_at=timezone.now(),
        )

        ShopPlanRequest.objects.create(
            shop=self.shop,
            requested_by_user=self.user,
            current_plan_tier="pro",
            requested_plan_tier="pro",
            request_note="Need review",
        )

        membership = ShopMembership.objects.get(shop=self.shop, user=self.user)
        WorkspaceAccessSession.objects.create(
            user=self.user,
            shop=self.shop,
            membership=membership,
            app_instance_id="owner-device",
            membership_role_snapshot=membership.role,
            device_label="Owner phone",
            status=WorkspaceAccessSession.Status.ACTIVE,
            last_seen_at=timezone.now() - timedelta(days=4),
        )
        WorkspaceAccessSession.objects.create(
            user=self.user,
            shop=self.shop,
            membership=membership,
            app_instance_id="lost-device",
            membership_role_snapshot=membership.role,
            device_label="Lost device",
            status=WorkspaceAccessSession.Status.REVOKED,
            revoked_at=timezone.now(),
            wipe_requested_at=timezone.now(),
        )

        snapshot = refresh_shop_dashboard_projection(self.shop)
        pulse = build_shop_pulse_snapshot(self.shop, dashboard_snapshot=snapshot)

        self.assertEqual(pulse["headline"]["tone"], "critical")
        task_codes = {task["code"] for task in pulse["tasks"]}
        anomaly_codes = {anomaly["code"] for anomaly in pulse["anomalies"]}

        self.assertIn("resolve_remote_wipes", task_codes)
        self.assertIn("restock_out_of_stock", task_codes)
        self.assertIn("collect_customer_dues", task_codes)
        self.assertIn("review_plan_requests", task_codes)
        self.assertIn("pending_remote_wipe", anomaly_codes)
        self.assertIn("high_void_rate", anomaly_codes)
        self.assertIn("inventory_shrinkage", anomaly_codes)
        self.assertGreaterEqual(pulse["stats"]["critical_anomaly_count"], 1)

    def test_pulse_snapshot_flags_risky_device_trust(self):
        self.shop.settings_json = {"plan_tier": "pro"}
        self.shop.save(update_fields=["settings_json", "updated_at"])
        self._seed_domain_data()
        WorkspaceAccessSession.objects.create(
            user=self.admin_user,
            shop=self.shop,
            membership=self.admin_membership,
            app_instance_id="admin-risky-device",
            membership_role_snapshot=ShopMembership.Role.ADMIN,
            device_label="Admin Android",
            platform_name="android",
            package_name="",
            app_version="",
            build_number="",
            release_channel="beta",
            release_tag="",
            status=WorkspaceAccessSession.Status.ACTIVE,
            last_seen_at=timezone.now() - timedelta(days=5),
        )

        snapshot = refresh_shop_dashboard_projection(self.shop)
        pulse = build_shop_pulse_snapshot(self.shop, dashboard_snapshot=snapshot)
        task_codes = {task["code"] for task in pulse["tasks"]}
        anomaly_codes = {anomaly["code"] for anomaly in pulse["anomalies"]}

        self.assertIn("review_device_trust", task_codes)
        self.assertIn("risky_device_posture", anomaly_codes)

    def test_pulse_snapshot_flags_access_control_spike_from_audit_activity(self):
        self.shop.settings_json = {"plan_tier": "pro"}
        self.shop.save(update_fields=["settings_json", "updated_at"])
        self._seed_domain_data()
        current_time = timezone.now()
        audit_events = [
            (
                "workspace.session.revoked",
                "workspace_access_session",
                "revoked-device-1",
            ),
            (
                "workspace.session.wipe_requested",
                "workspace_access_session",
                "wipe-device-1",
            ),
            (
                "workspace.session.restored",
                "workspace_access_session",
                "restored-device-1",
            ),
            (
                "workspace.team.member_updated",
                "shop_membership",
                "membership-1",
            ),
            (
                "workspace.team.ownership_transferred",
                "shop_membership",
                "membership-2",
            ),
        ]
        for index, (event_type, entity_type, entity_id) in enumerate(audit_events):
            WorkspaceAuditEvent.objects.create(
                shop=self.shop,
                actor_user=self.user,
                actor_role=ShopMembership.Role.OWNER,
                category=WorkspaceAuditEvent.Category.WORKSPACE,
                event_type=event_type,
                entity_type=entity_type,
                entity_id=entity_id,
                entity_label=f"Entity {index}",
                summary=f"Synthetic audit event {event_type}.",
                source_surface="test",
                occurred_at=current_time - timedelta(hours=index),
            )

        snapshot = refresh_shop_dashboard_projection(self.shop)
        pulse = build_shop_pulse_snapshot(self.shop, dashboard_snapshot=snapshot)
        task_codes = {task["code"] for task in pulse["tasks"]}
        anomaly_codes = {anomaly["code"] for anomaly in pulse["anomalies"]}

        self.assertIn("review_access_control_changes", task_codes)
        self.assertIn("access_control_spike", anomaly_codes)

    def test_pulse_snapshot_keeps_session_hygiene_task_for_revoked_history(self):
        self.shop.settings_json = {"plan_tier": "pro"}
        self.shop.save(update_fields=["settings_json", "updated_at"])
        self._seed_domain_data()
        owner_membership = ShopMembership.objects.get(shop=self.shop, user=self.user)
        WorkspaceAccessSession.objects.create(
            user=self.user,
            shop=self.shop,
            membership=owner_membership,
            app_instance_id="revoked-history-only",
            membership_role_snapshot=owner_membership.role,
            device_label="Revoked only device",
            status=WorkspaceAccessSession.Status.REVOKED,
            revoked_at=timezone.now(),
        )

        snapshot = refresh_shop_dashboard_projection(self.shop)
        pulse = build_shop_pulse_snapshot(self.shop, dashboard_snapshot=snapshot)
        task_codes = {task["code"] for task in pulse["tasks"]}

        self.assertIn("review_session_hygiene", task_codes)

    def test_pulse_api_returns_generated_payload(self):
        self.shop.settings_json = {"plan_tier": "pro"}
        self.shop.save(update_fields=["settings_json", "updated_at"])
        self._seed_domain_data()

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/projections/pulse/?refresh=1")

        self.assertEqual(response.status_code, 200)
        self.assertIn("headline", response.data)
        self.assertIn("tasks", response.data)
        self.assertIn("anomalies", response.data)
        self.assertIn("stats", response.data)

    def test_sync_shop_pulse_signals_persists_and_auto_resolves(self):
        self.shop.settings_json = {"plan_tier": "pro"}
        self.shop.save(update_fields=["settings_json", "updated_at"])
        self._seed_domain_data()
        snapshot = refresh_shop_dashboard_projection(self.shop)

        pulse = build_shop_pulse_snapshot(
            self.shop,
            dashboard_snapshot=snapshot,
            signal_limit=None,
        )
        signals = sync_shop_pulse_signals(
            self.shop,
            pulse_snapshot=pulse,
            now=snapshot.refreshed_at,
        )
        self.assertGreaterEqual(len(signals), 2)
        self.assertTrue(
            ShopPulseSignal.objects.filter(
                shop=self.shop,
                signal_kind=ShopPulseSignal.SignalKind.TASK,
                code="restock_out_of_stock",
                status=ShopPulseSignal.Status.OPEN,
            ).exists()
        )

        InventoryStockLedger.objects.create(
            shop=self.shop,
            item=InventoryItem.objects.get(shop=self.shop, sku="CAP-001"),
            event_type=InventoryStockLedger.EventType.ADJUSTMENT,
            quantity_delta=4,
            occurred_at=timezone.now(),
        )
        snapshot = refresh_shop_dashboard_projection(self.shop)
        pulse = build_shop_pulse_snapshot(
            self.shop,
            dashboard_snapshot=snapshot,
            signal_limit=None,
        )
        sync_shop_pulse_signals(
            self.shop,
            pulse_snapshot=pulse,
            now=snapshot.refreshed_at,
        )
        resolved_signal = ShopPulseSignal.objects.get(
            shop=self.shop,
            signal_kind=ShopPulseSignal.SignalKind.TASK,
            code="restock_out_of_stock",
        )
        self.assertEqual(resolved_signal.status, ShopPulseSignal.Status.RESOLVED)
        self.assertIn("Auto-resolved", resolved_signal.resolution_note)

    def test_pulse_signal_list_and_update_api(self):
        self.shop.settings_json = {"plan_tier": "pro"}
        self.shop.save(update_fields=["settings_json", "updated_at"])
        self._seed_domain_data()

        list_response = self.client.get(
            f"/api/v1/shops/{self.shop.id}/projections/pulse/signals/"
        )
        self.assertEqual(list_response.status_code, 200)
        self.assertGreaterEqual(len(list_response.data), 1)

        signal_id = list_response.data[0]["id"]
        acknowledge_response = self.client.patch(
            f"/api/v1/shops/{self.shop.id}/projections/pulse/signals/{signal_id}/",
            {"action": "acknowledge", "note": "Saw it."},
            format="json",
        )
        self.assertEqual(acknowledge_response.status_code, 200)
        self.assertEqual(acknowledge_response.data["status"], "acknowledged")

        resolve_response = self.client.patch(
            f"/api/v1/shops/{self.shop.id}/projections/pulse/signals/{signal_id}/",
            {"action": "resolve", "note": "Handled."},
            format="json",
        )
        self.assertEqual(resolve_response.status_code, 200)
        self.assertEqual(resolve_response.data["status"], "resolved")

    def test_owner_can_assign_and_escalate_pulse_signal(self):
        self.shop.settings_json = {"plan_tier": "pro"}
        self.shop.save(update_fields=["settings_json", "updated_at"])
        self._seed_domain_data()

        snapshot = refresh_shop_dashboard_projection(self.shop)
        pulse = build_shop_pulse_snapshot(
            self.shop,
            dashboard_snapshot=snapshot,
            signal_limit=None,
        )
        sync_shop_pulse_signals(self.shop, pulse_snapshot=pulse, now=snapshot.refreshed_at)
        signal = ShopPulseSignal.objects.filter(shop=self.shop).first()
        self.assertIsNotNone(signal)

        assign_response = self.client.patch(
            f"/api/v1/shops/{self.shop.id}/projections/pulse/signals/{signal.id}/",
            {
                "action": "assign",
                "assignee_membership_id": str(self.staff_membership.id),
                "note": "Store team should verify this before evening shift.",
            },
            format="json",
        )
        self.assertEqual(assign_response.status_code, 200)
        self.assertEqual(
            str(assign_response.data["assigned_membership_id"]),
            str(self.staff_membership.id),
        )
        self.assertEqual(assign_response.data["assigned_member_name"], "Staff Member")
        self.assertEqual(assign_response.data["status"], "acknowledged")

        escalate_response = self.client.patch(
            f"/api/v1/shops/{self.shop.id}/projections/pulse/signals/{signal.id}/",
            {
                "action": "escalate",
                "note": "Needs owner follow-up if not fixed before tonight.",
            },
            format="json",
        )
        self.assertEqual(escalate_response.status_code, 200)
        self.assertTrue(escalate_response.data["is_escalated"])
        self.assertEqual(
            escalate_response.data["escalation_note"],
            "Needs owner follow-up if not fixed before tonight.",
        )

        note_response = self.client.patch(
            f"/api/v1/shops/{self.shop.id}/projections/pulse/signals/{signal.id}/",
            {
                "action": "note",
                "note": "Staff confirmed they are restocking after lunch.",
            },
            format="json",
        )
        self.assertEqual(note_response.status_code, 200)
        self.assertEqual(
            note_response.data["follow_up_note"],
            "Staff confirmed they are restocking after lunch.",
        )

    def test_admin_cannot_assign_signal_to_owner_or_other_admin(self):
        self.shop.settings_json = {"plan_tier": "pro"}
        self.shop.save(update_fields=["settings_json", "updated_at"])
        self._seed_domain_data()
        snapshot = refresh_shop_dashboard_projection(self.shop)
        pulse = build_shop_pulse_snapshot(
            self.shop,
            dashboard_snapshot=snapshot,
            signal_limit=None,
        )
        sync_shop_pulse_signals(self.shop, pulse_snapshot=pulse, now=snapshot.refreshed_at)
        signal = ShopPulseSignal.objects.filter(shop=self.shop).first()

        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin_user)

        owner_assign_response = admin_client.patch(
            f"/api/v1/shops/{self.shop.id}/projections/pulse/signals/{signal.id}/",
            {
                "action": "assign",
                "assignee_membership_id": str(
                    ShopMembership.objects.get(shop=self.shop, user=self.user).id
                ),
            },
            format="json",
        )
        self.assertEqual(owner_assign_response.status_code, 400)

        other_admin_user = PlatformUser.objects.create_user(
            email="second-admin@example.com",
            password="secret",
            full_name="Second Admin",
        )
        other_admin_membership = ShopMembership.objects.create(
            user=other_admin_user,
            shop=self.shop,
            role=ShopMembership.Role.ADMIN,
            status=ShopMembership.Status.ACTIVE,
        )
        other_admin_response = admin_client.patch(
            f"/api/v1/shops/{self.shop.id}/projections/pulse/signals/{signal.id}/",
            {
                "action": "assign",
                "assignee_membership_id": str(other_admin_membership.id),
            },
            format="json",
        )
        self.assertEqual(other_admin_response.status_code, 400)
