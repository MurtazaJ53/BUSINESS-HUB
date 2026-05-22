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
from platform_apps.inventory.models import InventoryItem, InventoryStockLedger
from platform_apps.jobs.models import MigrationDomainControl
from platform_apps.payments.models import SalePayment
from platform_apps.sales.models import Sale, SaleItem
from platform_apps.sales.models import SaleCommandReceipt
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class SalesApiTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(email="owner@example.com", password="secret", full_name="Owner")
        self.shop = Shop.objects.create(name="Demo Shop", slug="demo-shop")
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.customer = Customer.objects.create(
            shop=self.shop,
            name="Ayaan Retail",
            phone="9876543210",
        )
        self.item = InventoryItem.objects.create(
            shop=self.shop,
            name="Cotton Shirt",
            sku="SKU-001",
            category="Shirts",
            sell_price=Decimal("500.00"),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_sale_creates_items_payments_and_ledgers(self):
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/sales/",
            {
                "customer_id": str(self.customer.id),
                "discount_amount": "50.00",
                "items": [
                    {
                        "inventory_item_id": str(self.item.id),
                        "quantity": 2,
                        "unit_price": "500.00",
                    }
                ],
                "payments": [
                    {
                        "payment_method": "CASH",
                        "amount": "700.00",
                    },
                    {
                        "payment_method": "CREDIT",
                        "amount": "250.00",
                    },
                ],
                "footer_note": "Visit again",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        sale = Sale.objects.get()
        self.assertEqual(sale.payment_mode, Sale.PaymentMode.SPLIT)
        self.assertEqual(sale.subtotal_amount, Decimal("1000.00"))
        self.assertEqual(sale.total_amount, Decimal("950.00"))
        self.assertEqual(sale.amount_received, Decimal("950.00"))
        self.assertEqual(sale.amount_due, Decimal("0.00"))
        self.assertEqual(SaleItem.objects.filter(sale=sale).count(), 1)
        self.assertEqual(SalePayment.objects.filter(sale=sale).count(), 2)
        self.assertEqual(
            InventoryStockLedger.objects.filter(item=self.item, event_type=InventoryStockLedger.EventType.SALE).count(),
            1,
        )
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.total_spent, Decimal("950.00"))
        self.assertEqual(
            CustomerLedgerEntry.objects.filter(customer=self.customer, event_type=CustomerLedgerEntry.EventType.SALE).count(),
            1,
        )

    def test_list_sales_for_shop(self):
        sale = Sale.objects.create(
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
        SaleItem.objects.create(
            sale=sale,
            inventory_item=self.item,
            name_snapshot="Cotton Shirt",
            sku_snapshot="SKU-001",
            quantity=1,
            unit_price=Decimal("500.00"),
            line_total=Decimal("500.00"),
        )
        SalePayment.objects.create(
            sale=sale,
            shop=self.shop,
            actor_user=self.user,
            payment_method=SalePayment.PaymentMethod.CASH,
            amount=Decimal("500.00"),
            occurred_at=timezone.now(),
        )

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/sales/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_sales_summary_hides_advanced_fields_for_growth_plan(self):
        self.shop.settings_json = {"plan_tier": "growth"}
        self.shop.save(update_fields=["settings_json", "updated_at"])
        Sale.objects.create(
            shop=self.shop,
            actor_user=self.user,
            receipt_number="S-GROWTH0001",
            subtotal_amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            amount_received=Decimal("350.00"),
            amount_due=Decimal("150.00"),
            payment_mode=Sale.PaymentMode.SPLIT,
            customer_name_snapshot="Walk-in",
            sale_date=timezone.localdate(),
            occurred_at=timezone.now(),
        )

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/sales/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_sales"], 1)
        self.assertEqual(response.data["gross_revenue"], "500.00")
        self.assertIsNone(response.data["outstanding_revenue"])
        self.assertIsNone(response.data["average_ticket"])

    def test_sales_summary_keeps_advanced_fields_for_pro_plan(self):
        self.shop.settings_json = {"plan_tier": "pro"}
        self.shop.save(update_fields=["settings_json", "updated_at"])
        Sale.objects.create(
            shop=self.shop,
            actor_user=self.user,
            receipt_number="S-PRO0001",
            subtotal_amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            amount_received=Decimal("350.00"),
            amount_due=Decimal("150.00"),
            payment_mode=Sale.PaymentMode.SPLIT,
            customer_name_snapshot="Walk-in",
            sale_date=timezone.localdate(),
            occurred_at=timezone.now(),
        )

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/sales/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["gross_revenue"], "500.00")
        self.assertEqual(response.data["outstanding_revenue"], "150.00")
        self.assertEqual(response.data["average_ticket"], "500.00")

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

    def test_sale_command_is_idempotent(self):
        for domain in [
            MigrationDomain.SALES,
            MigrationDomain.PAYMENTS,
            MigrationDomain.STOCK_LEDGER,
            MigrationDomain.CUSTOMER_LEDGER,
        ]:
            self._create_postgres_primary_control(domain)

        payload = {
            "command_id": "cmd-sale-001",
            "base_domain_epoch": 4,
            "source_surface": "flutter_pos",
            "sale": {
                "customer_id": str(self.customer.id),
                "discount_amount": "50.00",
                "items": [
                    {
                        "inventory_item_id": str(self.item.id),
                        "quantity": 2,
                        "unit_price": "500.00",
                    }
                ],
                "payments": [
                    {
                        "payment_method": "CASH",
                        "amount": "950.00",
                    }
                ],
            },
        }

        first = self.client.post(
            f"/api/v1/shops/{self.shop.id}/sales/commands/",
            payload,
            format="json",
        )
        second = self.client.post(
            f"/api/v1/shops/{self.shop.id}/sales/commands/",
            payload,
            format="json",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertFalse(first.json()["duplicate"])
        self.assertTrue(second.json()["duplicate"])
        self.assertEqual(Sale.objects.count(), 1)
        self.assertEqual(SaleCommandReceipt.objects.count(), 1)

    def test_sale_command_rejects_legacy_write_owner(self):
        MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=MigrationDomain.SALES,
            write_master=MigrationWriteMaster.FIREBASE,
            bridge_mode=MigrationBridgeMode.COMPARE_ONLY,
            cutover_status=MigrationCutoverStatus.LEGACY,
            current_epoch=1,
            shadow_reads_enabled=True,
        )

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/sales/commands/",
            {
                "command_id": "cmd-sale-blocked",
                "base_domain_epoch": 1,
                "sale": {
                    "items": [
                        {
                            "inventory_item_id": str(self.item.id),
                            "quantity": 1,
                            "unit_price": "500.00",
                        }
                    ],
                    "payments": [
                        {
                            "payment_method": "CASH",
                            "amount": "500.00",
                        }
                    ],
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, 409)

    def test_sale_command_rejects_stale_epoch(self):
        for domain in [
            MigrationDomain.SALES,
            MigrationDomain.PAYMENTS,
            MigrationDomain.STOCK_LEDGER,
        ]:
            self._create_postgres_primary_control(domain, epoch=7)

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/sales/commands/",
            {
                "command_id": "cmd-sale-stale",
                "base_domain_epoch": 3,
                "sale": {
                    "items": [
                        {
                            "inventory_item_id": str(self.item.id),
                            "quantity": 1,
                            "unit_price": "500.00",
                        }
                    ],
                    "payments": [
                        {
                            "payment_method": "CASH",
                            "amount": "500.00",
                        }
                    ],
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, 409)

    def test_direct_sale_create_is_blocked_when_sales_control_is_legacy(self):
        MigrationDomainControl.objects.create(
            shop=self.shop,
            domain=MigrationDomain.SALES,
            write_master=MigrationWriteMaster.FIREBASE,
            bridge_mode=MigrationBridgeMode.COMPARE_ONLY,
            cutover_status=MigrationCutoverStatus.LEGACY,
            current_epoch=1,
            shadow_reads_enabled=True,
        )

        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/sales/",
            {
                "items": [
                    {
                        "inventory_item_id": str(self.item.id),
                        "quantity": 1,
                        "unit_price": "500.00",
                    }
                ],
                "payments": [
                    {
                        "payment_method": "CASH",
                        "amount": "500.00",
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 409)
