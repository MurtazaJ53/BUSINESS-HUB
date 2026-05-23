from __future__ import annotations

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.attendance.models import AttendanceSession
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class AttendanceApiTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(email="owner@example.com", password="secret", full_name="Owner")
        self.staff = PlatformUser.objects.create_user(email="staff@example.com", password="secret", full_name="Staff One")
        self.shop = Shop.objects.create(name="Demo Shop", slug="demo-shop")
        self.owner_membership = ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.staff_membership = ShopMembership.objects.create(
            user=self.staff,
            shop=self.shop,
            role=ShopMembership.Role.STAFF,
            status=ShopMembership.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_attendance_session(self):
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/attendance/",
            {
                "membership_id": str(self.staff_membership.id),
                "session_date": "2026-04-30",
                "clock_in_at": "2026-04-30T10:00:00+05:30",
                "status": "PRESENT",
                "note": "Opened shop on time",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        session = AttendanceSession.objects.get()
        self.assertEqual(session.membership_id, self.staff_membership.id)
        self.assertEqual(session.status, AttendanceSession.Status.PRESENT)

    def test_list_attendance_sessions(self):
        AttendanceSession.objects.create(
            shop=self.shop,
            membership=self.staff_membership,
            session_date="2026-04-30",
            status=AttendanceSession.Status.PRESENT,
        )

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/attendance/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_attendance_summary_returns_aggregates(self):
        today = str(timezone.localdate())
        AttendanceSession.objects.create(
            shop=self.shop,
            membership=self.staff_membership,
            session_date=today,
            status=AttendanceSession.Status.PRESENT,
        )
        AttendanceSession.objects.create(
            shop=self.shop,
            membership=self.owner_membership,
            session_date=today,
            status=AttendanceSession.Status.LEAVE,
        )

        response = self.client.get(
            f"/api/v1/shops/{self.shop.id}/attendance/summary/?date_from={today}&today={today}"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_sessions"], 2)
        self.assertEqual(response.data["present_count"], 1)
        self.assertEqual(response.data["leave_count"], 1)
        self.assertEqual(response.data["active_workers_today"], 1)

    def test_can_recreate_attendance_after_soft_delete(self):
        session = AttendanceSession.objects.create(
            shop=self.shop,
            membership=self.staff_membership,
            session_date="2026-04-30",
            status=AttendanceSession.Status.PRESENT,
            tombstone=True,
        )
        self.assertTrue(session.tombstone)

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/attendance/",
            {
                "membership_id": str(self.staff_membership.id),
                "session_date": "2026-04-30",
                "status": "PRESENT",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

    def test_attendance_detail_hides_archived_records(self):
        session = AttendanceSession.objects.create(
            shop=self.shop,
            membership=self.staff_membership,
            session_date="2026-04-30",
            status=AttendanceSession.Status.PRESENT,
            tombstone=True,
        )

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/attendance/{session.id}/")

        self.assertEqual(response.status_code, 404)

    def test_starter_plan_blocks_attendance_access(self):
        self.shop.settings_json = {"plan_tier": "starter"}
        self.shop.save(update_fields=["settings_json"])

        list_response = self.client.get(f"/api/v1/shops/{self.shop.id}/attendance/")
        self.assertEqual(list_response.status_code, 403)
        self.assertIn("Attendance is not available", str(list_response.json()))

        create_response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/attendance/",
            {
                "membership_id": str(self.staff_membership.id),
                "session_date": "2026-04-30",
                "status": "PRESENT",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 403)
