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
from platform_apps.sales.models import Sale
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


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
        binding = ERPNextShopBinding.objects.create(shop=self.shop, is_enabled=True)
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
        binding.refresh_from_db()
        self.assertEqual(binding.last_health_status, ERPNextShopBinding.HealthStatus.OK)
        self.assertIsNotNone(binding.last_verified_at)
        self.assertGreaterEqual(ERPNextSyncCursor.objects.filter(shop=self.shop).count(), 7)

    def test_sync_state_returns_binding_cursor_and_link_counts(self):
        ERPNextShopBinding.objects.create(shop=self.shop, is_enabled=True)
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

