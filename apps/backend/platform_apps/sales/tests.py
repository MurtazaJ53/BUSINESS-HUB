from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.customers.models import Customer
from platform_apps.customers.models import CustomerLedgerEntry
from platform_apps.inventory.models import InventoryItem, InventoryStockLedger
from platform_apps.payments.models import SalePayment
from platform_apps.sales.models import Sale, SaleItem
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
