from django.test import TestCase
from rest_framework.test import APIClient
from platform_apps.shops.models import Shop

class BadTokenTests(TestCase):
    def test_a_garbage_bearer_token_is_a_clean_auth_failure(self):
        shop = Shop.objects.create(name="X", slug="x-shop")
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
        response = client.get(f"/api/v1/shops/{shop.id}/sales/summary/")
        self.assertIn(response.status_code, (401, 403), response.content)
        body = response.content.decode().lower()
        # The misleading part: a plain bad token used to be reported as a
        # Firebase configuration problem.
        self.assertNotIn("firebase", body)
