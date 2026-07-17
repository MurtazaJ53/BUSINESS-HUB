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

    def test_create_sale_accepts_fractional_quantity(self):
        # Sell 1.5 kg at Rs.60/kg = Rs.90; stock must decrement by exactly 1.5.
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/sales/",
            {
                "items": [
                    {
                        "inventory_item_id": str(self.item.id),
                        "quantity": "1.5",
                        "unit_price": "60.00",
                    }
                ],
                "payments": [
                    {"payment_method": "CASH", "amount": "90.00"},
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        sale = Sale.objects.get()
        self.assertEqual(sale.subtotal_amount, Decimal("90.00"))
        item = SaleItem.objects.get(sale=sale)
        self.assertEqual(item.quantity, Decimal("1.500"))
        self.assertEqual(item.line_total, Decimal("90.00"))
        ledger = InventoryStockLedger.objects.get(
            item=self.item,
            event_type=InventoryStockLedger.EventType.SALE,
        )
        self.assertEqual(ledger.quantity_delta, Decimal("-1.500"))

    def test_gstr3b_export_returns_rate_wise_summary(self):
        self.shop.state_code = "27"
        self.shop.gstin = "27ABCDE1234F1Z5"
        self.shop.save(update_fields=["state_code", "gstin"])
        self.item.gst_rate = Decimal("18.00")
        self.item.save(update_fields=["gst_rate"])
        self.client.post(
            f"/api/v1/shops/{self.shop.id}/sales/",
            {
                "items": [
                    {"inventory_item_id": str(self.item.id), "quantity": 1, "unit_price": "118.00"}
                ],
                "payments": [{"payment_method": "CASH", "amount": "118.00"}],
            },
            format="json",
        )
        today = timezone.localdate()
        response = self.client.get(
            f"/api/v1/shops/{self.shop.id}/sales/export/gstr3b/",
            {"month": today.month, "year": today.year},
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response["Content-Type"], "text/csv")
        body = response.content.decode()
        self.assertIn("Outward taxable supplies", body)
        self.assertIn("Total (3.1a)", body)
        self.assertIn("18.00", body)  # the tax rate row

    def test_gstr3b_export_blocks_cashier(self):
        cashier = PlatformUser.objects.create_user(
            email="cashier@example.com", password="secret", full_name="Cashier"
        )
        ShopMembership.objects.create(
            user=cashier, shop=self.shop, role=ShopMembership.Role.STAFF,
            status=ShopMembership.Status.ACTIVE,
        )
        client = APIClient()
        client.force_authenticate(user=cashier)
        response = client.get(
            f"/api/v1/shops/{self.shop.id}/sales/export/gstr3b/",
            {"month": 1, "year": 2026},
        )
        self.assertEqual(response.status_code, 403, response.content)

    def test_sale_computes_intra_state_gst_breakdown(self):
        self.shop.state_code = "27"
        self.shop.save(update_fields=["state_code"])
        taxed_item = InventoryItem.objects.create(
            shop=self.shop,
            name="GST Mug",
            sku="SKU-GST",
            sell_price=Decimal("118.00"),
            gst_rate=Decimal("18.00"),
            hsn_code="6912",
            price_includes_tax=True,
        )
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/sales/",
            {
                "items": [
                    {
                        "inventory_item_id": str(taxed_item.id),
                        "quantity": 1,
                        "unit_price": "118.00",
                    }
                ],
                "payments": [{"payment_method": "CASH", "amount": "118.00"}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        sale = Sale.objects.get(items__inventory_item=taxed_item)
        self.assertEqual(sale.taxable_amount, Decimal("100.00"))
        self.assertEqual(sale.tax_amount, Decimal("18.00"))
        self.assertEqual(sale.cgst_amount, Decimal("9.00"))
        self.assertEqual(sale.sgst_amount, Decimal("9.00"))
        self.assertEqual(sale.igst_amount, Decimal("0.00"))
        self.assertEqual(sale.place_of_supply_state, "27")
        line = sale.items.get(inventory_item=taxed_item)
        self.assertEqual(line.gst_rate, Decimal("18.00"))
        self.assertEqual(line.hsn_snapshot, "6912")
        self.assertEqual(line.tax_amount, Decimal("18.00"))

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

    def test_sale_void_reverses_inventory_and_customer_balances(self):
        sale = Sale.objects.create(
            shop=self.shop,
            actor_user=self.user,
            customer=self.customer,
            receipt_number="S-VOID001",
            subtotal_amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            amount_received=Decimal("0.00"),
            amount_due=Decimal("500.00"),
            payment_mode=Sale.PaymentMode.CREDIT,
            customer_name_snapshot="Ayaan Retail",
            sale_date=timezone.localdate(),
            occurred_at=timezone.now(),
        )
        SaleItem.objects.create(
            sale=sale,
            inventory_item=self.item,
            quantity=1,
            unit_price=Decimal("500.00"),
            line_total=Decimal("500.00"),
        )
        self.customer.balance = Decimal("500.00")
        self.customer.total_spent = Decimal("500.00")
        self.customer.save()

        response = self.client.patch(f"/api/v1/shops/{self.shop.id}/sales/{sale.id}/void/")
        
        self.assertEqual(response.status_code, 200)
        sale.refresh_from_db()
        self.assertEqual(sale.status, Sale.Status.VOID)
        
        # Verify customer ledger reversed
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.balance, Decimal("0.00"))
        self.assertEqual(self.customer.total_spent, Decimal("0.00"))
        
        # Verify inventory reversed
        ledger = InventoryStockLedger.objects.filter(item=self.item, event_type=InventoryStockLedger.EventType.RETURN).first()
        self.assertIsNotNone(ledger)
        self.assertEqual(ledger.quantity_delta, 1)

    def test_sale_gst_summary_endpoint(self):
        self.shop.state_code = "27"
        self.shop.save()
        
        taxed_item = InventoryItem.objects.create(
            shop=self.shop,
            name="GST Mug",
            sell_price=Decimal("118.00"),
            gst_rate=Decimal("18.00"),
            hsn_code="6912",
            price_includes_tax=True,
        )
        
        # Create an intra-state sale
        self.client.post(
            f"/api/v1/shops/{self.shop.id}/sales/",
            {
                "items": [{"inventory_item_id": str(taxed_item.id), "quantity": 1, "unit_price": "118.00"}],
                "payments": [{"payment_method": "CASH", "amount": "118.00"}],
            },
            format="json",
        )
        
        response = self.client.get(f"/api/v1/shops/{self.shop.id}/sales/summary/gst/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertEqual(data["taxable_amount"], "100.00")
        self.assertEqual(data["cgst_amount"], "9.00")
        self.assertEqual(data["sgst_amount"], "9.00")
        
        # Verify B2C small and HSN summary lists
        self.assertEqual(len(data["b2c_small"]), 1)
        self.assertEqual(float(data["b2c_small"][0]["items__gst_rate"]), 18.0)
        self.assertEqual(float(data["b2c_small"][0]["taxable_amount"]), 100.0)
        
        self.assertEqual(len(data["hsn_summary"]), 1)
        self.assertEqual(data["hsn_summary"][0]["items__hsn_snapshot"], "6912")
        self.assertEqual(float(data["hsn_summary"][0]["tax_amount"]), 18.0)

    def test_sale_inter_state_place_of_supply(self):
        self.shop.state_code = "27"
        self.shop.save()
        
        taxed_item = InventoryItem.objects.create(
            shop=self.shop,
            name="GST Mug",
            sell_price=Decimal("118.00"),
            gst_rate=Decimal("18.00"),
            price_includes_tax=True,
        )
        
        response = self.client.post(
            f"/api/v1/shops/{self.shop.id}/sales/",
            {
                "place_of_supply_state": "29",  # Karnataka (Inter-state from 27)
                "items": [{"inventory_item_id": str(taxed_item.id), "quantity": 1, "unit_price": "118.00"}],
                "payments": [{"payment_method": "CASH", "amount": "118.00"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        sale = Sale.objects.get(receipt_number=response.json()["receipt_number"])
        self.assertEqual(sale.place_of_supply_state, "29")
        self.assertEqual(sale.igst_amount, Decimal("18.00"))
        self.assertEqual(sale.cgst_amount, Decimal("0.00"))
