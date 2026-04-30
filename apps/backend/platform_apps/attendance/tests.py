from __future__ import annotations

from django.test import TestCase
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
