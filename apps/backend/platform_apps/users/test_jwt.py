from __future__ import annotations

from django.test import TestCase
from rest_framework.test import APIClient

from platform_apps.users.jwt_auth import issue_tokens
from platform_apps.users.models import PlatformUser


class JwtAuthTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="owner@example.com", password="secret123", full_name="Owner"
        )
        self.client = APIClient()

    def test_obtain_token_with_valid_credentials(self):
        response = self.client.post(
            "/api/v1/session/token/",
            {"email": "owner@example.com", "password": "secret123"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertIn("access", body)
        self.assertIn("refresh", body)
        self.assertEqual(body["token_type"], "Bearer")

    def test_obtain_token_rejects_wrong_password(self):
        response = self.client.post(
            "/api/v1/session/token/",
            {"email": "owner@example.com", "password": "nope"},
            format="json",
        )
        self.assertEqual(response.status_code, 401, response.content)

    def test_bearer_token_authenticates_protected_endpoint(self):
        access = issue_tokens(self.user)["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.get("/api/v1/shops/")
        self.assertEqual(response.status_code, 200, response.content)

    def test_refresh_returns_new_pair(self):
        refresh = issue_tokens(self.user)["refresh"]
        response = self.client.post(
            "/api/v1/session/token/refresh/",
            {"refresh": refresh},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn("access", response.json())

    def test_refresh_rejects_access_token(self):
        access = issue_tokens(self.user)["access"]
        response = self.client.post(
            "/api/v1/session/token/refresh/",
            {"refresh": access},  # wrong type
            format="json",
        )
        self.assertEqual(response.status_code, 401, response.content)

    def test_garbage_bearer_is_rejected(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not.a.jwt")
        response = self.client.get("/api/v1/shops/")
        self.assertEqual(response.status_code, 401, response.content)
