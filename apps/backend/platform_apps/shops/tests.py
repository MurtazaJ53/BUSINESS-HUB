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
from platform_apps.shops.models import Shop, ShopMembership, ShopPlanRequest
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


class ShopPlanRequestApiTests(TestCase):
    def setUp(self):
        self.owner = PlatformUser.objects.create_user(
            email="owner@example.com",
            password="secret",
            full_name="Owner",
        )
        self.staff = PlatformUser.objects.create_user(
            email="staff@example.com",
            password="secret",
            full_name="Staff",
        )
        self.shop = Shop.objects.create(
            name="Demo Shop",
            slug="demo-shop",
            settings_json={"plan_tier": "starter"},
        )
        ShopMembership.objects.create(
            user=self.owner,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        ShopMembership.objects.create(
            user=self.staff,
            shop=self.shop,
            role=ShopMembership.Role.STAFF,
            status=ShopMembership.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def test_owner_can_create_plan_request(self):
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/plan-requests/",
            {
                "requested_plan_tier": "growth",
                "request_note": "We need expenses and attendance next.",
                "context_json": {"source_surface": "admin_web_plan"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(ShopPlanRequest.objects.count(), 1)
        plan_request = ShopPlanRequest.objects.get()
        self.assertEqual(plan_request.current_plan_tier, "starter")
        self.assertEqual(plan_request.requested_plan_tier, "growth")
        self.assertEqual(plan_request.status, ShopPlanRequest.Status.OPEN)

    def test_duplicate_open_request_returns_existing(self):
        ShopPlanRequest.objects.create(
            shop=self.shop,
            requested_by_user=self.owner,
            current_plan_tier="starter",
            requested_plan_tier="growth",
            status=ShopPlanRequest.Status.OPEN,
        )

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/plan-requests/",
            {
                "requested_plan_tier": "growth",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(ShopPlanRequest.objects.count(), 1)

    def test_staff_cannot_create_plan_request(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/plan-requests/",
            {
                "requested_plan_tier": "growth",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_cannot_request_same_or_lower_plan(self):
        same_response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/plan-requests/",
            {
                "requested_plan_tier": "starter",
            },
            format="json",
        )
        self.assertEqual(same_response.status_code, 400)

        self.shop.settings_json = {"plan_tier": "growth"}
        self.shop.save(update_fields=["settings_json", "updated_at"])
        lower_response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/plan-requests/",
            {
                "requested_plan_tier": "starter",
            },
            format="json",
        )
        self.assertEqual(lower_response.status_code, 400)

    def test_cannot_request_upgrade_when_already_on_pro(self):
        self.shop.settings_json = {"plan_tier": "pro"}
        self.shop.save(update_fields=["settings_json", "updated_at"])

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/plan-requests/",
            {
                "requested_plan_tier": "pro",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)


class WorkspaceTeamApiTests(TestCase):
    def setUp(self):
        self.owner = PlatformUser.objects.create_user(
            email="owner@example.com",
            password="secret",
            full_name="Owner",
        )
        self.admin = PlatformUser.objects.create_user(
            email="admin@example.com",
            password="secret",
            full_name="Admin",
        )
        self.staff = PlatformUser.objects.create_user(
            email="staff@example.com",
            password="secret",
            full_name="Staff",
        )
        self.viewer = PlatformUser.objects.create_user(
            email="viewer@example.com",
            password="secret",
            full_name="Viewer",
        )
        self.shop = Shop.objects.create(
            name="Demo Shop",
            slug="demo-shop",
            owner_user=self.owner,
        )
        self.owner_membership = ShopMembership.objects.create(
            user=self.owner,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
            email=self.owner.email,
        )
        self.admin_membership = ShopMembership.objects.create(
            user=self.admin,
            shop=self.shop,
            role=ShopMembership.Role.ADMIN,
            status=ShopMembership.Status.ACTIVE,
            email=self.admin.email,
        )
        self.staff_membership = ShopMembership.objects.create(
            user=self.staff,
            shop=self.shop,
            role=ShopMembership.Role.STAFF,
            status=ShopMembership.Status.ACTIVE,
            email=self.staff.email,
        )
        self.viewer_membership = ShopMembership.objects.create(
            user=self.viewer,
            shop=self.shop,
            role=ShopMembership.Role.VIEWER,
            status=ShopMembership.Status.ACTIVE,
            email=self.viewer.email,
        )
        self.client = APIClient()

    def test_owner_can_list_workspace_team(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(f"/api/v1/shops/{self.shop.id}/team/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 4)
        owner_row = next(row for row in payload if row["member_email"] == self.owner.email)
        staff_row = next(row for row in payload if row["member_email"] == self.staff.email)
        self.assertFalse(owner_row["can_manage"])
        self.assertEqual(staff_row["role_label"], "Staff operator")
        self.assertTrue(staff_row["can_manage"])

    def test_staff_cannot_access_team_management(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.get(f"/api/v1/shops/{self.shop.id}/team/")
        self.assertEqual(response.status_code, 403)

    def test_owner_can_create_store_admin_member(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/team/",
            {
                "email": "new-admin@example.com",
                "full_name": "New Admin",
                "phone": "+91-1111111111",
                "role": "admin",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        membership = ShopMembership.objects.get(email="new-admin@example.com", shop=self.shop)
        self.assertEqual(membership.role, ShopMembership.Role.ADMIN)
        self.assertEqual(membership.status, ShopMembership.Status.INVITED)

    def test_admin_cannot_create_admin_member_but_can_manage_staff(self):
        self.client.force_authenticate(user=self.admin)

        create_response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/team/",
            {
                "email": "future-admin@example.com",
                "full_name": "Future Admin",
                "role": "admin",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 403)

        patch_response = self.client.patch(
            f"/api/v1/shops/{self.shop.id}/team/{self.staff_membership.id}/",
            {
                "role": "viewer",
                "status": ShopMembership.Status.DISABLED,
            },
            format="json",
        )
        self.assertEqual(patch_response.status_code, 200)
        self.staff_membership.refresh_from_db()
        self.assertEqual(self.staff_membership.role, ShopMembership.Role.VIEWER)
        self.assertEqual(self.staff_membership.status, ShopMembership.Status.DISABLED)

    def test_admin_cannot_manage_owner_or_admin_memberships(self):
        self.client.force_authenticate(user=self.admin)

        owner_response = self.client.patch(
            f"/api/v1/shops/{self.shop.id}/team/{self.owner_membership.id}/",
            {"status": ShopMembership.Status.DISABLED},
            format="json",
        )
        self.assertEqual(owner_response.status_code, 403)

        admin_response = self.client.patch(
            f"/api/v1/shops/{self.shop.id}/team/{self.admin_membership.id}/",
            {"role": "staff"},
            format="json",
        )
        self.assertEqual(admin_response.status_code, 403)

    def test_owner_cannot_change_own_membership_here(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(
            f"/api/v1/shops/{self.shop.id}/team/{self.owner_membership.id}/",
            {"role": "admin"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
