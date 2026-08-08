from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.common.migration import MigrationBridgeMode
from platform_apps.common.migration import MigrationCutoverStatus
from platform_apps.common.migration import MigrationDomain
from platform_apps.common.migration import MigrationWriteMaster
from platform_apps.customers.models import Customer
from platform_apps.customers.models import CustomerLedgerEntry
from platform_apps.jobs.models import MigrationDomainControl
from platform_apps.payments.models import SalePayment
from platform_apps.payments.models import SalePaymentCommandReceipt
from platform_apps.sales.models import Sale
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class PaymentsApiTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(email="owner@example.com", password="secret", full_name="Owner")
        self.shop = Shop.objects.create(name="Demo Shop", slug="demo-shop")
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.sale = Sale.objects.create(
            shop=self.shop,
            actor_user=self.user,
            receipt_number="S-DEMO0001",
            subtotal_amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            amount_received=Decimal("500.00"),
            amount_due=Decimal("0.00"),
            payment_mode=Sale.PaymentMode.CASH,
            customer_name_snapshot="Walk-in",
            sale_date=timezone.localdate(),
            occurred_at=timezone.now(),
        )
        SalePayment.objects.create(
            sale=self.sale,
            shop=self.shop,
            actor_user=self.user,
            payment_method=SalePayment.PaymentMethod.CASH,
            amount=Decimal("500.00"),
            occurred_at=timezone.now(),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.customer = Customer.objects.create(
            shop=self.shop,
            name="Ayaan Retail",
            phone="9876543210",
            balance=Decimal("300.00"),
        )
        self.sale.customer = self.customer
        self.sale.amount_received = Decimal("200.00")
        self.sale.amount_due = Decimal("300.00")
        self.sale.payment_mode = Sale.PaymentMode.CREDIT
        self.sale.customer_name_snapshot = self.customer.name
        self.sale.customer_phone_snapshot = self.customer.phone
        self.sale.save(
            update_fields=[
                "customer",
                "amount_received",
                "amount_due",
                "payment_mode",
                "customer_name_snapshot",
                "customer_phone_snapshot",
                "updated_at",
            ]
        )

    def test_list_payments_for_shop(self):
        response = self.client.get(f"/api/v1/shops/{self.shop.id}/payments/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_payment_summary_hides_finance_fields_for_growth_plan(self):
        self.shop.settings_json = {"plan_tier": "growth"}
        self.shop.save(update_fields=["settings_json", "updated_at"])

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/payments/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["payment_count"], 1)
        self.assertIsNone(response.data["total_collected"])
        self.assertIsNone(response.data["credit_count"])
        self.assertIsNone(response.data["digital_payment_count"])

    def test_payment_summary_keeps_finance_fields_for_pro_plan(self):
        self.shop.settings_json = {"plan_tier": "pro"}
        self.shop.save(update_fields=["settings_json", "updated_at"])

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/payments/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["payment_count"], 1)
        self.assertEqual(response.data["total_collected"], "500.00")
        self.assertEqual(response.data["credit_count"], 0)
        self.assertEqual(response.data["digital_payment_count"], 0)

    def _create_postgres_primary_control(self, domain: str, *, epoch: int = 4):
        return MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=domain,
            write_master=MigrationWriteMaster.POSTGRES,
            bridge_mode=MigrationBridgeMode.FIREBASE_TO_POSTGRES,
            cutover_status=MigrationCutoverStatus.POSTGRES_PRIMARY,
            current_epoch=epoch,
            shadow_reads_enabled=True,
        )

    def test_payment_command_is_idempotent_and_updates_due(self):
        for domain in [
            MigrationDomain.PAYMENTS,
            MigrationDomain.SALES,
            MigrationDomain.CUSTOMER_LEDGER,
        ]:
            self._create_postgres_primary_control(domain)

        payload = {
            "command_id": "cmd-pay-001",
            "base_domain_epoch": 4,
            "source_surface": "flutter_pos",
            "sale_id": str(self.sale.id),
            "payment_method": "UPI",
            "amount": "150.00",
            "reference_code": "UTR-001",
        }

        first = self.client.post(
            f"/api/v1/shops/{self.shop.id}/payments/commands/",
            payload,
            format="json",
        )
        second = self.client.post(
            f"/api/v1/shops/{self.shop.id}/payments/commands/",
            payload,
            format="json",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.sale.refresh_from_db()
        self.customer.refresh_from_db()
        self.assertEqual(SalePaymentCommandReceipt.objects.count(), 1)
        self.assertEqual(SalePayment.objects.count(), 2)
        self.assertEqual(self.sale.amount_received, Decimal("350.00"))
        self.assertEqual(self.sale.amount_due, Decimal("150.00"))
        self.assertEqual(self.customer.balance, Decimal("150.00"))
        self.assertEqual(
            CustomerLedgerEntry.objects.filter(
                customer=self.customer,
                event_type=CustomerLedgerEntry.EventType.PAYMENT,
            ).count(),
            1,
        )

    def test_payment_command_rejects_stale_epoch(self):
        for domain in [
            MigrationDomain.PAYMENTS,
            MigrationDomain.SALES,
            MigrationDomain.CUSTOMER_LEDGER,
        ]:
            self._create_postgres_primary_control(domain, epoch=6)

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/payments/commands/",
            {
                "command_id": "cmd-pay-stale",
                "base_domain_epoch": 2,
                "sale_id": str(self.sale.id),
                "payment_method": "CASH",
                "amount": "50.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 409)

    def test_payment_command_rejects_customer_balance_drift(self):
        for domain in [
            MigrationDomain.PAYMENTS,
            MigrationDomain.SALES,
            MigrationDomain.CUSTOMER_LEDGER,
        ]:
            self._create_postgres_primary_control(domain, epoch=4)

        self.customer.balance = Decimal("100.00")
        self.customer.save(update_fields=["balance", "updated_at"])

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/payments/commands/",
            {
                "command_id": "cmd-pay-drift",
                "base_domain_epoch": 4,
                "sale_id": str(self.sale.id),
                "payment_method": "CASH",
                "amount": "150.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 409)
