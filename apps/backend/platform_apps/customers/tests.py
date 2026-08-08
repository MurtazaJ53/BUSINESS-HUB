from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from platform_apps.common.migration import MigrationBridgeMode, MigrationCutoverStatus, MigrationDomain, MigrationWriteMaster
from platform_apps.customers.models import Customer, CustomerLedgerEntry
from platform_apps.jobs.models import MigrationDomainControl
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class CustomerApiTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(email="owner@example.com", password="secret", full_name="Owner")
        self.shop = Shop.objects.create(name="Demo Shop", slug="demo-shop")
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_customer_with_opening_balance(self):
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/customers/",
            {
                "name": "Ayaan Retail",
                "phone": "9876543210",
                "opening_balance": "420.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        customer = Customer.objects.get()
        self.assertEqual(customer.balance, Decimal("420.00"))
        self.assertEqual(customer.ledger_entries.count(), 1)
        self.assertEqual(customer.ledger_entries.first().event_type, CustomerLedgerEntry.EventType.OPENING_BALANCE)

    def test_create_customer_is_blocked_when_legacy_path_still_owns_domain(self):
        MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=MigrationDomain.CUSTOMERS,
            write_master=MigrationWriteMaster.FIREBASE,
            bridge_mode=MigrationBridgeMode.COMPARE_ONLY,
            cutover_status=MigrationCutoverStatus.PILOT,
            current_epoch=5,
            shadow_reads_enabled=True,
        )

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/customers/",
            {
                "name": "Blocked Retail",
                "phone": "9876543210",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(Customer.objects.count(), 0)

    def test_create_customer_succeeds_when_postgres_is_primary(self):
        MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=MigrationDomain.CUSTOMERS,
            write_master=MigrationWriteMaster.POSTGRES,
            bridge_mode=MigrationBridgeMode.FIREBASE_TO_POSTGRES,
            cutover_status=MigrationCutoverStatus.POSTGRES_PRIMARY,
            current_epoch=6,
            shadow_reads_enabled=True,
        )

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/customers/",
            {
                "name": "Pilot Retail",
                "phone": "9876543210",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Customer.objects.count(), 1)

    def test_record_customer_payment_updates_balance(self):
        customer = Customer.objects.create(
            shop=self.shop,
            name="Ayaan Retail",
            phone="9876543210",
            balance=Decimal("500.00"),
            total_spent=Decimal("1200.00"),
        )
        MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=MigrationDomain.CUSTOMER_LEDGER,
            write_master=MigrationWriteMaster.POSTGRES,
            bridge_mode=MigrationBridgeMode.FIREBASE_TO_POSTGRES,
            cutover_status=MigrationCutoverStatus.POSTGRES_PRIMARY,
            current_epoch=7,
            shadow_reads_enabled=True,
        )

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/customers/{customer.id}/ledger/",
            {
                "event_type": "payment",
                "amount_delta": "-200.00",
                "total_spent_delta": "0.00",
                "note": "Received UPI settlement",
                "occurred_at": "2026-04-30T12:00:00+05:30",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        customer.refresh_from_db()
        self.assertEqual(customer.balance, Decimal("300.00"))
        self.assertEqual(customer.total_spent, Decimal("1200.00"))

    def test_customer_payment_is_blocked_when_legacy_path_still_owns_ledger_domain(self):
        customer = Customer.objects.create(
            shop=self.shop,
            name="Ayaan Retail",
            balance=Decimal("500.00"),
        )
        MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=MigrationDomain.CUSTOMER_LEDGER,
            write_master=MigrationWriteMaster.FIREBASE,
            bridge_mode=MigrationBridgeMode.COMPARE_ONLY,
            cutover_status=MigrationCutoverStatus.PILOT,
            current_epoch=9,
            shadow_reads_enabled=True,
        )

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/customers/{customer.id}/ledger/",
            {
                "event_type": "payment",
                "amount_delta": "-200.00",
                "total_spent_delta": "0.00",
                "note": "Blocked while ledger is legacy-owned",
                "occurred_at": "2026-04-30T12:00:00+05:30",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(customer.ledger_entries.count(), 0)

    def test_customer_detail_hides_archived_records(self):
        customer = Customer.objects.create(
            shop=self.shop,
            name="Archived Account",
            tombstone=True,
            status=Customer.Status.ARCHIVED,
        )

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/customers/{customer.id}/")

        self.assertEqual(response.status_code, 404)

    def test_customer_update_is_blocked_when_legacy_path_still_owns_domain(self):
        customer = Customer.objects.create(shop=self.shop, name="Legacy Retail", phone="9876543210")
        MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=MigrationDomain.CUSTOMERS,
            write_master=MigrationWriteMaster.FIREBASE,
            bridge_mode=MigrationBridgeMode.COMPARE_ONLY,
            cutover_status=MigrationCutoverStatus.PILOT,
            current_epoch=11,
            shadow_reads_enabled=True,
        )

        response = self.client.patch(
            f"/api/v1/shops/{self.shop.id}/customers/{customer.id}/",
            {"name": "Updated Retail"},
            format="json",
        )

        self.assertEqual(response.status_code, 409)
        customer.refresh_from_db()
        self.assertEqual(customer.name, "Legacy Retail")

    def test_customer_ledger_rejects_sale_event_type(self):
        customer = Customer.objects.create(
            shop=self.shop,
            name="Ayaan Retail",
        )

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/customers/{customer.id}/ledger/",
            {
                "event_type": "sale",
                "amount_delta": "200.00",
                "total_spent_delta": "200.00",
                "note": "Should only come from the sales domain",
                "occurred_at": "2026-04-30T12:00:00+05:30",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("event_type", response.json())

    def test_customer_summary_hides_lifetime_spend_for_growth_plan(self):
        self.shop.settings_json = {"plan_tier": "growth"}
        self.shop.save(update_fields=["settings_json", "updated_at"])
        Customer.objects.create(
            shop=self.shop,
            name="Ayaan Retail",
            balance=Decimal("320.00"),
            total_spent=Decimal("1400.00"),
        )

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/customers/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_customers"], 1)
        self.assertEqual(response.data["active_credit_customers"], 1)
        self.assertEqual(response.data["total_outstanding_balance"], "320.00")
        self.assertIsNone(response.data["total_lifetime_spend"])

    def test_customer_summary_keeps_lifetime_spend_for_pro_plan(self):
        self.shop.settings_json = {"plan_tier": "pro"}
        self.shop.save(update_fields=["settings_json", "updated_at"])
        Customer.objects.create(
            shop=self.shop,
            name="Ayaan Retail",
            balance=Decimal("320.00"),
            total_spent=Decimal("1400.00"),
        )

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/customers/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_lifetime_spend"], "1400.00")
