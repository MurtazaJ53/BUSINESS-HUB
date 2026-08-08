from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from platform_apps.customers.models import Customer
from platform_apps.erpnext.mock_client import build_demo_mock_state, write_mock_state
from platform_apps.erpnext.models import (
    ERPNextDocumentLink,
    ERPNextPurchaseMirror,
    ERPNextShopBinding,
    ERPNextSupplierMirror,
    ERPNextSupplierPaymentMirror,
    ERPNextSyncCursor,
)
from platform_apps.erpnext.services import ERPNextIntegrationService
from platform_apps.inventory.models import InventoryItem, InventoryStockLedger
from platform_apps.payments.models import SalePayment
from platform_apps.sales.models import Sale, SaleItem
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser


class Command(BaseCommand):
    help = "Bootstrap a fully local ERPNext mock demo, seed commerce data, and run the sync/posting cycle."

    def add_arguments(self, parser):
        parser.add_argument("--shop-slug", default="demo-shop")
        parser.add_argument("--owner-email", default="erpnext-demo@example.com")
        parser.add_argument("--limit", type=int, default=100)
        parser.add_argument("--reset-mock-state", action="store_true")

    def handle(self, *args, **options):
        if not settings.ERPNEXT_MOCK_MODE:
            raise CommandError(
                "ERPNEXT_MOCK_MODE is not enabled. Set ERPNEXT_MOCK_MODE=true in apps/backend/.env before running this command."
            )

        state_path = Path(settings.ERPNEXT_MOCK_STATE_PATH)
        if options["reset_mock_state"] or not state_path.exists():
            write_mock_state(state_path, build_demo_mock_state())

        owner = self._ensure_owner(email=options["owner_email"])
        shop = self._ensure_shop(shop_slug=options["shop_slug"], owner=owner)
        binding = self._ensure_binding(shop=shop)
        service = ERPNextIntegrationService()

        if options["reset_mock_state"]:
            self._reset_local_demo_state(shop=shop)

        service.ensure_default_cursors(shop=shop)
        preflight = service.health_check(binding=binding)
        service.apply_health_payload(binding=binding, payload=preflight)
        if preflight.get("status") != ERPNextShopBinding.HealthStatus.OK:
            raise CommandError(f"Mock ERPNext health check failed: {preflight}")

        service.sync_items(shop=shop, limit=options["limit"])
        service.sync_customers(shop=shop, limit=options["limit"])
        seeded_sale = self._create_demo_sale(shop=shop, owner=owner)

        cycle_payload = service.run_cycle(
            shop=shop,
            limit=options["limit"],
            verify_connection=True,
            sync_items=True,
            sync_customers=True,
            sync_stock=True,
            sync_suppliers=True,
            sync_purchases=True,
            sync_supplier_payments=True,
            push_sales=True,
            push_payments=True,
        )
        summary = service.build_poc_summary(shop=shop)

        self.stdout.write(
            json.dumps(
                {
                    "mock_state_path": str(state_path),
                    "shop_id": str(shop.id),
                    "shop_slug": shop.slug,
                    "owner_email": owner.email,
                    "seeded_sale": seeded_sale,
                    "cycle": cycle_payload,
                    "summary": summary,
                },
                indent=2,
                default=str,
            )
        )

    def _ensure_owner(self, *, email: str) -> PlatformUser:
        user, created = PlatformUser.objects.get_or_create(
            email=email,
            defaults={
                "full_name": "ERPNext Demo Owner",
                "is_active": True,
            },
        )
        if created:
            user.set_password("demo-pass-1234")
            user.save(update_fields=["password", "updated_at"])
        elif not user.full_name:
            user.full_name = "ERPNext Demo Owner"
            user.save(update_fields=["full_name", "updated_at"])
        return user

    def _ensure_shop(self, *, shop_slug: str, owner: PlatformUser) -> Shop:
        shop, _ = Shop.objects.get_or_create(
            slug=shop_slug,
            defaults={
                "name": "ERPNext Demo Shop",
                "legal_name": "ERPNext Demo Shop Pvt Ltd",
                "owner_user": owner,
                "settings_json": {"surface": "erpnext-mock-demo"},
            },
        )
        if shop.owner_user_id != owner.id:
            shop.owner_user = owner
            shop.save(update_fields=["owner_user", "updated_at"])
        ShopMembership.objects.get_or_create(
            user=owner,
            shop=shop,
            defaults={
                "role": ShopMembership.Role.OWNER,
                "status": ShopMembership.Status.ACTIVE,
            },
        )
        return shop

    def _ensure_binding(self, *, shop: Shop) -> ERPNextShopBinding:
        binding, _ = ERPNextShopBinding.objects.get_or_create(
            shop=shop,
            defaults={
                "is_enabled": True,
                "environment": ERPNextShopBinding.Environment.SANDBOX,
                "company": "Zarra Retail Private Limited",
                "warehouse": "Limbdi Warehouse - ZR",
                "selling_price_list": "Retail Price",
                "customer_group": "Retail",
                "supplier_group": "Fabric Vendors",
                "currency_code": "INR",
                "item_sync_enabled": True,
                "customer_sync_enabled": True,
                "stock_sync_enabled": True,
                "sales_posting_enabled": True,
                "payment_posting_enabled": True,
                "purchase_sync_enabled": True,
                "metadata_json": {
                    "walk_in_customer_name": "Walk In Customer",
                    "default_payment_account": "Cash - ZR",
                    "payment_account_map": {
                        "CASH": "Cash - ZR",
                        "UPI": "UPI Clearing - ZR",
                        "CARD": "Card Clearing - ZR",
                        "BANK": "Bank - ZR",
                        "OTHER": "Misc Receipts - ZR",
                    },
                    "mode_of_payment_map": {
                        "CASH": "Cash",
                        "UPI": "UPI",
                        "CARD": "Card",
                        "BANK": "Bank",
                        "OTHER": "Other",
                    },
                    "receivable_account": "Debtors - ZR",
                },
            },
        )
        if not binding.is_enabled or not binding.purchase_sync_enabled:
            binding.is_enabled = True
            binding.purchase_sync_enabled = True
            binding.item_sync_enabled = True
            binding.customer_sync_enabled = True
            binding.stock_sync_enabled = True
            binding.sales_posting_enabled = True
            binding.payment_posting_enabled = True
            binding.company = binding.company or "Zarra Retail Private Limited"
            binding.warehouse = binding.warehouse or "Limbdi Warehouse - ZR"
            binding.selling_price_list = binding.selling_price_list or "Retail Price"
            binding.customer_group = binding.customer_group or "Retail"
            binding.supplier_group = binding.supplier_group or "Fabric Vendors"
            metadata = binding.metadata_json or {}
            metadata.setdefault("walk_in_customer_name", "Walk In Customer")
            metadata.setdefault("default_payment_account", "Cash - ZR")
            metadata.setdefault(
                "payment_account_map",
                {
                    "CASH": "Cash - ZR",
                    "UPI": "UPI Clearing - ZR",
                    "CARD": "Card Clearing - ZR",
                    "BANK": "Bank - ZR",
                    "OTHER": "Misc Receipts - ZR",
                },
            )
            metadata.setdefault(
                "mode_of_payment_map",
                {
                    "CASH": "Cash",
                    "UPI": "UPI",
                    "CARD": "Card",
                    "BANK": "Bank",
                    "OTHER": "Other",
                },
            )
            metadata.setdefault("receivable_account", "Debtors - ZR")
            binding.metadata_json = metadata
            binding.save()
        return binding

    def _create_demo_sale(self, *, shop: Shop, owner: PlatformUser) -> dict[str, str]:
        customer = (
            Customer.objects.filter(shop=shop, source_system="erpnext", tombstone=False)
            .order_by("created_at")
            .first()
        )
        item = (
            shop.inventory_items.filter(source_system="erpnext", tombstone=False)
            .order_by("created_at")
            .first()
        )
        if customer is None or item is None:
            raise CommandError("Demo sale cannot be seeded because ERPNext items/customers were not imported.")

        sequence = Sale.objects.filter(shop=shop, receipt_number__startswith="ERPDEMO").count() + 1
        receipt_number = f"ERPDEMO{sequence:04d}"
        quantity = 2
        unit_price = item.sell_price or Decimal("0.00")
        total_amount = unit_price * quantity
        occurred_at = timezone.now()

        sale = Sale.objects.create(
            shop=shop,
            actor_user=owner,
            customer=customer,
            receipt_number=receipt_number,
            subtotal_amount=total_amount,
            discount_amount=Decimal("0.00"),
            total_amount=total_amount,
            amount_received=total_amount,
            amount_due=Decimal("0.00"),
            payment_mode=Sale.PaymentMode.UPI,
            customer_name_snapshot=customer.name,
            customer_phone_snapshot=customer.phone,
            note="Locally seeded demo sale for ERPNext mock cycle.",
            sale_date=timezone.localdate(),
            occurred_at=occurred_at,
        )
        SaleItem.objects.create(
            sale=sale,
            inventory_item=item,
            name_snapshot=item.name,
            sku_snapshot=item.sku,
            quantity=quantity,
            unit_price=unit_price,
            line_total=total_amount,
        )
        payment = SalePayment.objects.create(
            sale=sale,
            shop=shop,
            actor_user=owner,
            payment_method=SalePayment.PaymentMethod.UPI,
            amount=total_amount,
            reference_code=f"UPI-DEMO-{sequence:04d}",
            note="Locally seeded demo payment for ERPNext mock cycle.",
            occurred_at=occurred_at,
        )
        return {
            "sale_id": str(sale.id),
            "receipt_number": sale.receipt_number,
            "payment_id": str(payment.id),
        }

    def _reset_local_demo_state(self, *, shop: Shop) -> None:
        Sale.objects.filter(shop=shop, receipt_number__startswith="ERPDEMO").delete()
        ERPNextDocumentLink.objects.filter(shop=shop).delete()
        ERPNextSyncCursor.objects.filter(shop=shop).delete()
        ERPNextSupplierPaymentMirror.objects.filter(shop=shop).delete()
        ERPNextPurchaseMirror.objects.filter(shop=shop).delete()
        ERPNextSupplierMirror.objects.filter(shop=shop).delete()
        InventoryStockLedger.objects.filter(shop=shop, source_system="erpnext").delete()
        InventoryItem.objects.filter(shop=shop, source_system="erpnext").delete()
        Customer.objects.filter(shop=shop, source_system="erpnext").delete()
