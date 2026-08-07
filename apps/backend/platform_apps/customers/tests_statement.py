from __future__ import annotations

import hashlib
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.customers.models import (
    Customer,
    CustomerLedgerEntry,
    CustomerStatementLink,
)
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class CustomerStatementTests(TestCase):
    """The public khata statement.

    This is the only unauthenticated view of customer data in the product, so
    most of these tests are about what it refuses to do rather than what it
    shows.
    """

    def setUp(self):
        self.owner = PlatformUser.objects.create_user(
            email="owner@example.com", password="secret", full_name="Owner"
        )
        self.shop = Shop.objects.create(name="Kirana Corner", slug="kirana-corner")
        self.shop.settings_json = {"upi_vpa": "kirana@okaxis"}
        self.shop.save()
        ShopMembership.objects.create(
            user=self.owner,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.customer = Customer.objects.create(
            shop=self.shop,
            name="Ramesh",
            phone="9876543210",
            balance=Decimal("4200.00"),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def _mint(self, **body):
        return self.client.post(
            reverse("customer-statement-link", args=[self.shop.id, self.customer.id]),
            body,
            format="json",
        )

    def _view(self, token):
        anon = APIClient()
        return anon.get(reverse("public-khata-statement", args=[token]))

    # -- issuing ---------------------------------------------------------

    def test_minting_returns_a_token_and_a_path(self):
        response = self._mint()

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["token"])
        self.assertEqual(response.data["path"], f"/khata/{response.data['token']}")

    def test_the_plaintext_token_is_never_stored(self):
        """A database dump must not hand out working links."""
        token = self._mint().data["token"]

        link = CustomerStatementLink.objects.get()
        self.assertNotEqual(link.token_hash, token)
        self.assertEqual(link.token_hash, hashlib.sha256(token.encode()).hexdigest())
        # And the raw token appears in no field of the row.
        for field in link._meta.fields:
            self.assertNotEqual(str(getattr(link, field.name)), token)

    def test_tokens_are_not_predictable(self):
        tokens = {self._mint().data["token"] for _ in range(5)}
        self.assertEqual(len(tokens), 5)
        self.assertGreaterEqual(min(len(t) for t in tokens), 32)

    def test_re_issuing_retires_the_previous_link(self):
        """Pressing the button again usually means the last link went astray."""
        first = self._mint().data["token"]
        second = self._mint().data["token"]

        self.assertEqual(self._view(first).status_code, 404)
        self.assertEqual(self._view(second).status_code, 200)

    def test_validity_window_is_capped(self):
        response = self._mint(valid_days=9999)

        expires = response.data["expires_at"]
        self.assertLess(
            timezone.datetime.fromisoformat(expires),
            timezone.now() + timedelta(days=181),
        )

    # -- what the customer sees ------------------------------------------

    def test_statement_shows_the_balance_and_recent_entries(self):
        CustomerLedgerEntry.objects.create(
            shop=self.shop,
            customer=self.customer,
            event_type=CustomerLedgerEntry.EventType.SALE,
            amount_delta=Decimal("1200.00"),
            note="Rice and oil",
            occurred_at=timezone.now(),
        )
        token = self._mint().data["token"]

        response = self._view(token)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["customer_name"], "Ramesh")
        self.assertEqual(response.data["balance"], "4200.00")
        self.assertEqual(response.data["shop"]["name"], "Kirana Corner")
        self.assertEqual(len(response.data["entries"]), 1)
        self.assertEqual(response.data["entries"][0]["note"], "Rice and oil")

    def test_statement_never_includes_the_customer_phone_number(self):
        """They know their own number; whoever intercepted the link should not."""
        token = self._mint().data["token"]

        body = str(self._view(token).data)

        self.assertNotIn("9876543210", body)

    def test_statement_does_not_leak_another_customer(self):
        other = Customer.objects.create(
            shop=self.shop, name="Suresh", phone="9000000000", balance=Decimal("999.00")
        )
        CustomerLedgerEntry.objects.create(
            shop=self.shop,
            customer=other,
            event_type=CustomerLedgerEntry.EventType.SALE,
            amount_delta=Decimal("999.00"),
            note="Not Ramesh's purchase",
            occurred_at=timezone.now(),
        )
        token = self._mint().data["token"]

        body = str(self._view(token).data)

        self.assertNotIn("Suresh", body)
        self.assertNotIn("Not Ramesh's purchase", body)

    def test_upi_link_carries_the_balance(self):
        token = self._mint().data["token"]

        upi = self._view(token).data["upi_link"]

        self.assertIn("pa=kirana%40okaxis", upi)
        self.assertIn("am=4200.00", upi)

    def test_no_upi_link_when_the_shop_has_not_set_one(self):
        self.shop.settings_json = {}
        self.shop.save()
        token = self._mint().data["token"]

        self.assertIsNone(self._view(token).data["upi_link"])

    def test_no_upi_link_when_nothing_is_owed(self):
        """A pay button for zero is a confusing thing to send someone."""
        self.customer.balance = Decimal("0.00")
        self.customer.save()
        token = self._mint().data["token"]

        self.assertIsNone(self._view(token).data["upi_link"])

    # -- refusing ---------------------------------------------------------

    def test_an_unknown_token_is_not_found(self):
        self.assertEqual(self._view("nonsense-token").status_code, 404)

    def test_an_expired_link_stops_working(self):
        token = self._mint().data["token"]
        CustomerStatementLink.objects.update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        self.assertEqual(self._view(token).status_code, 404)

    def test_a_revoked_link_stops_working(self):
        token = self._mint().data["token"]

        self.client.delete(
            reverse("customer-statement-link", args=[self.shop.id, self.customer.id])
        )

        self.assertEqual(self._view(token).status_code, 404)

    def test_expired_and_unknown_are_indistinguishable(self):
        """Different messages would let someone probe which tokens existed."""
        token = self._mint().data["token"]
        CustomerStatementLink.objects.update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        expired = self._view(token)
        unknown = self._view("nonsense-token")

        self.assertEqual(expired.status_code, unknown.status_code)
        self.assertEqual(str(expired.data), str(unknown.data))

    def test_a_stranger_cannot_mint_a_link_for_someone_elses_customer(self):
        stranger = PlatformUser.objects.create_user(
            email="stranger@example.com", password="secret", full_name="Stranger"
        )
        self.client.force_authenticate(user=stranger)

        response = self._mint()

        self.assertEqual(response.status_code, 403)
        self.assertEqual(CustomerStatementLink.objects.count(), 0)

    def test_minting_requires_being_signed_in(self):
        self.client.force_authenticate(user=None)

        self.assertEqual(self._mint().status_code, 401)

    # -- bookkeeping ------------------------------------------------------

    def test_views_are_counted(self):
        token = self._mint().data["token"]

        self._view(token)
        self._view(token)

        link = CustomerStatementLink.objects.get()
        self.assertEqual(link.view_count, 2)
        self.assertIsNotNone(link.last_viewed_at)
