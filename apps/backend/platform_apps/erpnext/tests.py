from __future__ import annotations

from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from platform_apps.customers.models import Customer
from platform_apps.erpnext.models import ERPNextDocumentLink, ERPNextShopBinding, ERPNextSyncCursor
from platform_apps.inventory.models import InventoryItem
from platform_apps.payments.models import SalePayment
from platform_apps.sales.models import Sale, SaleItem
from platform_apps.inventory.models import InventoryItemPrivate
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class FakeERPNextClient:
    def __init__(self, *, resource_lists=None, create_responses=None, resource_details=None):
        self.resource_lists = resource_lists or {}
        self.create_responses = create_responses or {}
        self.resource_details = resource_details or {}

    def list_resource(self, *, doctype, filters=None, fields=None, limit_page_length=20):
        return {"data": self.resource_lists.get(doctype, [])[:limit_page_length]}

    def get_resource(self, *, doctype, name):
        return {"data": self.resource_details.get((doctype, name), {})}

    def create_resource(self, *, doctype, payload):
        response = self.create_responses.get(doctype)
        if callable(response):
            return response(payload)
        if response is not None:
            return response
        return {"data": {"name": f"{doctype}-AUTO-0001"}}


class ERPNextApiTests(TestCase):
    def setUp(self):
        self.user = PlatformUser.objects.create_user(
            email="owner@example.com",
            password="secret",
            full_name="Owner",
        )
        self.viewer = PlatformUser.objects.create_user(
            email="viewer@example.com",
            password="secret",
            full_name="Viewer",
        )
        self.shop = Shop.objects.create(name="Demo Shop", slug="demo-shop")
        ShopMembership.objects.create(
            user=self.user,
            shop=self.shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
        )
        ShopMembership.objects.create(
            user=self.viewer,
            shop=self.shop,
            role=ShopMembership.Role.VIEWER,
            status=ShopMembership.Status.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.binding = ERPNextShopBinding.objects.create(
            shop=self.shop,
            is_enabled=True,
            company="Zarra Retail Private Limited",
            warehouse="Limbdi Warehouse - ZR",
            selling_price_list="Retail Price",
            metadata_json={
                "walk_in_customer_name": "Walk In Customer",
                "default_payment_account": "Cash - ZR",
                "payment_account_map": {
                    "CASH": "Cash - ZR",
                    "UPI": "UPI Clearing - ZR",
                },
            },
        )

    def test_meta_reports_configuration_state(self):
        response = self.client.get("/api/v1/erpnext/meta/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("configured", payload)
        self.assertIn("timeout_seconds", payload)

    def test_binding_get_creates_default_record(self):
        response = self.client.get(f"/api/v1/shops/{self.shop.id}/erpnext/binding/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(ERPNextShopBinding.objects.filter(shop=self.shop).count(), 1)
        self.assertEqual(response.json()["environment"], ERPNextShopBinding.Environment.SANDBOX)

    def test_binding_patch_updates_shop_mapping(self):
        response = self.client.patch(
            f"/api/v1/shops/{self.shop.id}/erpnext/binding/",
            {
                "is_enabled": True,
                "company": "Zarra Retail Private Limited",
                "warehouse": "Limbdi Warehouse - ZR",
                "selling_price_list": "Retail Price",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        binding = ERPNextShopBinding.objects.get(shop=self.shop)
        self.assertTrue(binding.is_enabled)
        self.assertEqual(binding.company, "Zarra Retail Private Limited")
        self.assertEqual(binding.warehouse, "Limbdi Warehouse - ZR")

    def test_viewer_cannot_edit_binding(self):
        self.client.force_authenticate(user=self.viewer)

        response = self.client.patch(
            f"/api/v1/shops/{self.shop.id}/erpnext/binding/",
            {"is_enabled": True},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_verify_connection_updates_binding_and_bootstraps_cursors(self):
        with patch(
            "platform_apps.erpnext.views.ERPNextIntegrationService.health_check",
            return_value={
                "status": ERPNextShopBinding.HealthStatus.OK,
                "configured": True,
                "reachable": True,
                "authenticated": True,
                "base_url": "https://erpnext.example.com",
                "site_name": "business-hub-poc",
                "logged_user": "integration@example.com",
            },
        ):
            response = self.client.post(f"/api/v1/shops/{self.shop.id}/erpnext/verify-connection/")

        self.assertEqual(response.status_code, 200)
        self.binding.refresh_from_db()
        self.assertEqual(self.binding.last_health_status, ERPNextShopBinding.HealthStatus.OK)
        self.assertIsNotNone(self.binding.last_verified_at)
        self.assertGreaterEqual(ERPNextSyncCursor.objects.filter(shop=self.shop).count(), 7)

    def test_sync_state_returns_binding_cursor_and_link_counts(self):
        ERPNextSyncCursor.objects.create(
            shop=self.shop,
            domain=ERPNextSyncCursor.Domain.ITEMS,
            direction=ERPNextSyncCursor.Direction.PULL,
            status=ERPNextSyncCursor.Status.SUCCEEDED,
        )
        ERPNextDocumentLink.objects.create(
            shop=self.shop,
            local_domain=ERPNextDocumentLink.LocalDomain.ITEM,
            local_object_id="item-001",
            remote_doctype="Item",
            remote_name="ITEM-0001",
            direction=ERPNextDocumentLink.Direction.PULL,
            sync_status=ERPNextDocumentLink.SyncStatus.LINKED,
        )

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/erpnext/sync-state/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIsNotNone(payload["binding"])
        self.assertGreaterEqual(len(payload["cursors"]), 7)
        self.assertEqual(payload["document_link_counts"]["linked"], 1)

    def test_poc_summary_rolls_up_local_counts(self):
        InventoryItem.objects.create(shop=self.shop, name="Cotton Shirt", sell_price=Decimal("500.00"))
        customer = Customer.objects.create(shop=self.shop, name="Ayaan Retail", phone="9999999999")
        sale = Sale.objects.create(
            shop=self.shop,
            actor_user=self.user,
            customer=customer,
            receipt_number="S-DEMO0001",
            subtotal_amount=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            amount_received=Decimal("500.00"),
            amount_due=Decimal("0.00"),
            payment_mode=Sale.PaymentMode.CASH,
            customer_name_snapshot=customer.name,
            customer_phone_snapshot=customer.phone,
            sale_date=timezone.localdate(),
            occurred_at=timezone.now(),
        )
        SalePayment.objects.create(
            sale=sale,
            shop=self.shop,
            actor_user=self.user,
            payment_method=SalePayment.PaymentMethod.CASH,
            amount=Decimal("500.00"),
            occurred_at=timezone.now(),
        )

        response = self.client.get(f"/api/v1/shops/{self.shop.id}/erpnext/poc-summary/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["local_counts"]["inventory_items"], 1)
        self.assertEqual(payload["local_counts"]["customers"], 1)
        self.assertEqual(payload["local_counts"]["sales"], 1)
        self.assertEqual(payload["local_counts"]["payments"], 1)

    def test_sync_items_imports_inventory_and_links(self):
        fake_client = FakeERPNextClient(
            resource_lists={
                "Item": [
                    {
                        "name": "ITEM-0001",
                        "item_code": "ITEM-0001",
                        "item_name": "Cotton Shirt",
                        "item_group": "Shirts",
                        "description": "Combed cotton shirt",
                        "standard_rate": "599.00",
                        "disabled": 0,
                        "modified": "2026-05-12 14:30:00",
                    }
                ]
            }
        )

        with patch(
            "platform_apps.erpnext.services.ERPNextIntegrationService.build_client",
            return_value=fake_client,
        ):
            response = self.client.post(
                f"/api/v1/shops/{self.shop.id}/erpnext/sync-items/",
                {"limit": 10},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        item = InventoryItem.objects.get(shop=self.shop, source_system="erpnext", source_id="ITEM-0001")
        self.assertEqual(item.name, "Cotton Shirt")
        self.assertEqual(item.sell_price, Decimal("599.00"))
        self.assertTrue(
            ERPNextDocumentLink.objects.filter(
                shop=self.shop,
                local_domain=ERPNextDocumentLink.LocalDomain.ITEM,
                local_object_id=str(item.id),
                remote_doctype="Item",
                remote_name="ITEM-0001",
                sync_status=ERPNextDocumentLink.SyncStatus.LINKED,
            ).exists()
        )

    def test_sync_customers_imports_customer_and_links(self):
        fake_client = FakeERPNextClient(
            resource_lists={
                "Customer": [
                    {
                        "name": "CUST-0001",
                        "customer_name": "Ayaan Retail",
                        "mobile_no": "9999999999",
                        "email_id": "ayaan@example.com",
                        "customer_group": "Retail",
                        "customer_type": "Company",
                        "disabled": 0,
                        "modified": "2026-05-12 14:35:00",
                    }
                ]
            }
        )

        with patch(
            "platform_apps.erpnext.services.ERPNextIntegrationService.build_client",
            return_value=fake_client,
        ):
            response = self.client.post(
                f"/api/v1/shops/{self.shop.id}/erpnext/sync-customers/",
                {"limit": 10},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        customer = Customer.objects.get(shop=self.shop, source_system="erpnext", source_id="CUST-0001")
        self.assertEqual(customer.name, "Ayaan Retail")
        self.assertEqual(customer.phone, "9999999999")
        self.assertTrue(
            ERPNextDocumentLink.objects.filter(
                shop=self.shop,
                local_domain=ERPNextDocumentLink.LocalDomain.CUSTOMER,
                local_object_id=str(customer.id),
                remote_doctype="Customer",
                remote_name="CUST-0001",
                sync_status=ERPNextDocumentLink.SyncStatus.LINKED,
            ).exists()
        )

    def test_sync_stock_reconciles_inventory_ledger(self):
        item = InventoryItem.objects.create(
            shop=self.shop,
            name="Cotton Shirt",
            sku="ITEM-0001",
            sell_price=Decimal("599.00"),
            source_system="erpnext",
            source_id="ITEM-0001",
        )
        fake_client = FakeERPNextClient(
            resource_lists={
                "Bin": [
                    {
                        "name": "BIN-0001",
                        "item_code": "ITEM-0001",
                        "warehouse": self.binding.warehouse,
                        "actual_qty": "8",
                        "modified": "2026-05-12 14:45:00",
                    }
                ]
            }
        )

        with patch(
            "platform_apps.erpnext.services.ERPNextIntegrationService.build_client",
            return_value=fake_client,
        ):
            response = self.client.post(
                f"/api/v1/shops/{self.shop.id}/erpnext/sync-stock/",
                {"limit": 10},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        total_stock = sum(item.ledger_entries.values_list("quantity_delta", flat=True))
        self.assertEqual(total_stock, 8)

    def test_sync_suppliers_imports_supplier_mirror(self):
        self.binding.purchase_sync_enabled = True
        self.binding.save(update_fields=["purchase_sync_enabled", "updated_at"])
        fake_client = FakeERPNextClient(
            resource_lists={
                "Supplier": [
                    {
                        "name": "SUP-0001",
                        "supplier_name": "Alpha Textiles",
                        "supplier_group": "Default Supplier Group",
                        "supplier_type": "Company",
                        "mobile_no": "8888888888",
                        "email_id": "alpha@example.com",
                        "disabled": 0,
                        "modified": "2026-05-12 14:50:00",
                    }
                ]
            }
        )

        with patch(
            "platform_apps.erpnext.services.ERPNextIntegrationService.build_client",
            return_value=fake_client,
        ):
            response = self.client.post(
                f"/api/v1/shops/{self.shop.id}/erpnext/sync-suppliers/",
                {"limit": 10},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["imported_count"], 1)
        self.assertTrue(
            ERPNextDocumentLink.objects.filter(
                shop=self.shop,
                local_domain=ERPNextDocumentLink.LocalDomain.SUPPLIER,
                remote_doctype="Supplier",
                remote_name="SUP-0001",
            ).exists()
        )

    def test_sync_purchases_imports_purchase_mirror(self):
        self.binding.purchase_sync_enabled = True
        self.binding.save(update_fields=["purchase_sync_enabled", "updated_at"])
        supplier_client = FakeERPNextClient(
            resource_lists={
                "Supplier": [
                    {
                        "name": "SUP-0001",
                        "supplier_name": "Alpha Textiles",
                        "supplier_group": "Default Supplier Group",
                        "supplier_type": "Company",
                        "mobile_no": "8888888888",
                        "email_id": "alpha@example.com",
                        "disabled": 0,
                        "modified": "2026-05-12 14:50:00",
                    }
                ],
                "Purchase Receipt": [
                    {
                        "name": "PREC-0001",
                        "supplier": "SUP-0001",
                        "posting_date": "2026-05-12",
                        "grand_total": "1200.00",
                        "status": "Completed",
                        "docstatus": 1,
                        "currency": "INR",
                        "set_warehouse": self.binding.warehouse,
                        "modified": "2026-05-12 15:00:00",
                    }
                ],
            },
            resource_details={
                ("Purchase Receipt", "PREC-0001"): {
                    "name": "PREC-0001",
                    "supplier": "SUP-0001",
                    "posting_date": "2026-05-12",
                    "grand_total": "1200.00",
                    "status": "Completed",
                    "docstatus": 1,
                    "currency": "INR",
                    "set_warehouse": self.binding.warehouse,
                    "items": [
                        {
                            "item_code": "ITEM-0001",
                            "item_name": "Cotton Shirt",
                            "qty": 5,
                            "rate": "240.00",
                            "warehouse": self.binding.warehouse,
                        }
                    ],
                    "modified": "2026-05-12 15:00:00",
                }
            },
        )
        item = InventoryItem.objects.create(
            shop=self.shop,
            name="Cotton Shirt",
            sku="ITEM-0001",
            sell_price=Decimal("599.00"),
            source_system="erpnext",
            source_id="ITEM-0001",
        )

        with patch(
            "platform_apps.erpnext.services.ERPNextIntegrationService.build_client",
            return_value=supplier_client,
        ):
            self.client.post(
                f"/api/v1/shops/{self.shop.id}/erpnext/sync-suppliers/",
                {"limit": 10},
                format="json",
            )
            response = self.client.post(
                f"/api/v1/shops/{self.shop.id}/erpnext/sync-purchases/",
                {"limit": 10},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["imported_count"], 1)
        item.refresh_from_db()
        self.assertEqual(item.private.supplier_id, "SUP-0001")
        self.assertEqual(item.private.cost_price, Decimal("240.00"))

    def test_push_sales_creates_sales_invoice_link(self):
        customer = Customer.objects.create(
            shop=self.shop,
            name="Ayaan Retail",
            phone="9999999999",
            source_system="erpnext",
            source_id="CUST-0001",
        )
        item = InventoryItem.objects.create(
            shop=self.shop,
            name="Cotton Shirt",
            sku="ITEM-0001",
            sell_price=Decimal("599.00"),
            source_system="erpnext",
            source_id="ITEM-0001",
        )
        InventoryItemPrivate.objects.create(item=item)
        sale = Sale.objects.create(
            shop=self.shop,
            actor_user=self.user,
            customer=customer,
            receipt_number="S-DEMO0001",
            subtotal_amount=Decimal("599.00"),
            total_amount=Decimal("599.00"),
            amount_received=Decimal("599.00"),
            amount_due=Decimal("0.00"),
            payment_mode=Sale.PaymentMode.CASH,
            customer_name_snapshot=customer.name,
            customer_phone_snapshot=customer.phone,
            sale_date=timezone.localdate(),
            occurred_at=timezone.now(),
        )
        SaleItem.objects.create(
            sale=sale,
            inventory_item=item,
            name_snapshot=item.name,
            sku_snapshot=item.sku,
            quantity=1,
            unit_price=Decimal("599.00"),
            line_total=Decimal("599.00"),
        )

        fake_client = FakeERPNextClient(
            create_responses={"Sales Invoice": {"data": {"name": "SINV-0001"}}}
        )

        with patch(
            "platform_apps.erpnext.services.ERPNextIntegrationService.build_client",
            return_value=fake_client,
        ):
            response = self.client.post(
                f"/api/v1/shops/{self.shop.id}/erpnext/push-sales/",
                {"limit": 10},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["pushed_count"], 1)
        self.assertTrue(
            ERPNextDocumentLink.objects.filter(
                shop=self.shop,
                local_domain=ERPNextDocumentLink.LocalDomain.SALE,
                local_object_id=str(sale.id),
                remote_doctype="Sales Invoice",
                remote_name="SINV-0001",
                sync_status=ERPNextDocumentLink.SyncStatus.LINKED,
            ).exists()
        )

    def test_push_payments_creates_payment_entry_link(self):
        customer = Customer.objects.create(
            shop=self.shop,
            name="Ayaan Retail",
            phone="9999999999",
            source_system="erpnext",
            source_id="CUST-0001",
        )
        sale = Sale.objects.create(
            shop=self.shop,
            actor_user=self.user,
            customer=customer,
            receipt_number="S-DEMO0002",
            subtotal_amount=Decimal("599.00"),
            total_amount=Decimal("599.00"),
            amount_received=Decimal("599.00"),
            amount_due=Decimal("0.00"),
            payment_mode=Sale.PaymentMode.CASH,
            customer_name_snapshot=customer.name,
            customer_phone_snapshot=customer.phone,
            sale_date=timezone.localdate(),
            occurred_at=timezone.now(),
        )
        payment = SalePayment.objects.create(
            sale=sale,
            shop=self.shop,
            actor_user=self.user,
            payment_method=SalePayment.PaymentMethod.CASH,
            amount=Decimal("599.00"),
            reference_code="txn-001",
            occurred_at=timezone.now(),
        )
        ERPNextDocumentLink.objects.create(
            shop=self.shop,
            local_domain=ERPNextDocumentLink.LocalDomain.SALE,
            local_object_id=str(sale.id),
            remote_doctype="Sales Invoice",
            remote_name="SINV-0002",
            direction=ERPNextDocumentLink.Direction.PUSH,
            sync_status=ERPNextDocumentLink.SyncStatus.LINKED,
        )

        fake_client = FakeERPNextClient(
            create_responses={"Payment Entry": {"data": {"name": "ACC-PAY-0001"}}}
        )

        with patch(
            "platform_apps.erpnext.services.ERPNextIntegrationService.build_client",
            return_value=fake_client,
        ):
            response = self.client.post(
                f"/api/v1/shops/{self.shop.id}/erpnext/push-payments/",
                {"limit": 10},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["pushed_count"], 1)
        self.assertTrue(
            ERPNextDocumentLink.objects.filter(
                shop=self.shop,
                local_domain=ERPNextDocumentLink.LocalDomain.PAYMENT,
                local_object_id=str(payment.id),
                remote_doctype="Payment Entry",
                remote_name="ACC-PAY-0001",
                sync_status=ERPNextDocumentLink.SyncStatus.LINKED,
            ).exists()
        )

    def test_run_cycle_endpoint_returns_aggregated_status(self):
        with patch(
            "platform_apps.erpnext.views.ERPNextIntegrationService.run_cycle",
            return_value={
                "shop_id": str(self.shop.id),
                "overall_status": "ok",
                "steps": [
                    {"step": "verify_connection", "status": "ok"},
                    {"step": "sync_items", "status": "ok"},
                ],
            },
        ):
            response = self.client.post(
                f"/api/v1/shops/{self.shop.id}/erpnext/run-cycle/",
                {"limit": 25},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["overall_status"], "ok")

    def test_enqueue_cycle_returns_task_stub(self):
        with patch(
            "platform_apps.erpnext.views.run_erpnext_cycle_task.delay",
        ) as mocked_delay:
            mocked_delay.return_value.id = "task-001"
            response = self.client.post(
                f"/api/v1/shops/{self.shop.id}/erpnext/enqueue-cycle/",
                {"limit": 25},
                format="json",
            )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["task_id"], "task-001")

    @override_settings(
        ERPNEXT_BASE_URL="https://erpnext.example.com",
        ERPNEXT_API_KEY="key-123",
        ERPNEXT_API_SECRET="secret-123",
        ERPNEXT_SITE_NAME="business-hub-poc",
        ERPNEXT_VERIFY_SSL=True,
        ERPNEXT_TIMEOUT_SECONDS=12,
    )
    def test_health_view_uses_service_payload(self):
        with patch(
            "platform_apps.erpnext.views.ERPNextIntegrationService.health_check",
            return_value={
                "status": ERPNextShopBinding.HealthStatus.OK,
                "configured": True,
                "reachable": True,
                "authenticated": True,
                "base_url": "https://erpnext.example.com",
                "site_name": "business-hub-poc",
                "logged_user": "integration@example.com",
            },
        ):
            response = self.client.get("/api/v1/erpnext/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], ERPNextShopBinding.HealthStatus.OK)
