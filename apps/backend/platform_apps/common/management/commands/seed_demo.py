"""Seed a self-contained demo workspace so the app can be checked end-to-end.

Creates one owner user, one GST-registered shop (Maharashtra / state 27),
a catalog with both unit-priced and loose/by-weight items, a handful of
customers, and ~3 weeks of sales (cash, UPI, split, credit, and a fractional
"sell by weight" line). All migration domains are promoted to
``postgres_primary`` so the Flutter POS command endpoints accept writes.

Usage (from apps/backend)::

    .venv/Scripts/python.exe manage.py seed_demo            # create (fails if demo shop exists)
    .venv/Scripts/python.exe manage.py seed_demo --reset    # wipe demo shop and rebuild

Login for the demo owner:  demo@businesshub.test / demo12345
(In DEBUG the mobile/dev client can also authenticate via the
 X-Dev-User-Email: demo@businesshub.test header.)
"""

from __future__ import annotations

import random
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from platform_apps.common.migration import (
    MigrationBridgeMode,
    MigrationCutoverStatus,
    MigrationDomain,
    MigrationWriteMaster,
)
from platform_apps.customers.models import Customer
from platform_apps.inventory.models import InventoryItem, InventoryItemPrivate, InventoryStockLedger
from platform_apps.jobs.models import MigrationDomainControl
from platform_apps.purchases.models import Supplier
from platform_apps.purchases.serializers import PurchaseSerializer
from platform_apps.sales.serializers import SaleSerializer
from platform_apps.shops.models import Shop, ShopMembership
from platform_apps.users.models import PlatformUser

DEMO_OWNER_EMAIL = "demo@businesshub.test"
DEMO_OWNER_PASSWORD = "demo12345"
DEMO_SHOP_SLUG = "demo-mart"

# (name, sku, category, sell_price, gst_rate, cost_price, opening_stock, unit_hint)
CATALOG = [
    ("Parle-G Biscuits", "BISC-001", "Snacks", "10.00", "18.00", "7.50", "120", "pcs"),
    ("Amul Butter 100g", "DAIR-001", "Dairy", "56.00", "12.00", "48.00", "40", "pcs"),
    ("Aashirvaad Atta 5kg", "STAP-001", "Staples", "265.00", "5.00", "235.00", "25", "pcs"),
    ("Tata Salt 1kg", "STAP-002", "Staples", "28.00", "5.00", "22.00", "60", "pcs"),
    ("Colgate Toothpaste", "PERS-001", "Personal Care", "95.00", "18.00", "72.00", "35", "pcs"),
    ("Lux Soap", "PERS-002", "Personal Care", "38.00", "18.00", "28.00", "80", "pcs"),
    ("Coca-Cola 750ml", "BEVG-001", "Beverages", "40.00", "28.00", "31.00", "48", "pcs"),
    ("Maggi Noodles", "SNAK-002", "Snacks", "14.00", "18.00", "11.00", "150", "pcs"),
    # Loose / by-weight items (fractional stock + fractional sale lines):
    ("Tomatoes (loose)", "LOOSE-TOM", "Vegetables", "40.00", "0.00", "24.00", "35.500", "kg"),
    ("Sugar (loose)", "LOOSE-SUG", "Staples", "45.00", "5.00", "38.00", "62.250", "kg"),
    ("Onions (loose)", "LOOSE-ONI", "Vegetables", "30.00", "0.00", "18.00", "48.750", "kg"),
]

CUSTOMERS = [
    ("Rahul Sharma", "9876543210"),
    ("Priya Patel", "9823001122"),
    ("Imran Khan", "9812345678"),
    ("Sneha Iyer", "9900112233"),
    ("Walk-in Regular", "9000000000"),
]


class Command(BaseCommand):
    help = "Seed a demo shop with catalog, customers and sales for manual testing."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete the existing demo shop (and its data) before seeding.",
        )
        parser.add_argument(
            "--sales",
            type=int,
            default=18,
            help="Number of demo sales to generate (default 18).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        random.seed(42)  # reproducible demo data
        reset = options["reset"]
        num_sales = options["sales"]

        existing = Shop.objects.filter(slug=DEMO_SHOP_SLUG).first()
        if existing and not reset:
            raise CommandError(
                f"Demo shop '{DEMO_SHOP_SLUG}' already exists. Re-run with --reset to rebuild it."
            )
        if existing:
            self.stdout.write(self.style.WARNING(f"Deleting existing demo shop {existing.id} ..."))
            existing.delete()

        owner = self._ensure_owner()
        shop = self._create_shop(owner)
        self._promote_domains(shop)
        items = self._create_catalog(shop, owner)
        customers = self._create_customers(shop)
        suppliers = self._create_suppliers(shop)
        purchase_count = self._create_purchases(shop, owner, items, suppliers)
        sale_count = self._create_sales(shop, owner, items, customers, num_sales)

        self.stdout.write(self.style.SUCCESS("\nDemo workspace ready."))
        self.stdout.write(f"  Shop:      {shop.name}  (id={shop.id})")
        self.stdout.write(f"  Owner:     {DEMO_OWNER_EMAIL} / {DEMO_OWNER_PASSWORD}")
        self.stdout.write(f"  Catalog:   {len(items)} items ({sum(1 for i in items if i.sku.startswith('LOOSE'))} loose/by-weight)")
        self.stdout.write(f"  Customers: {len(customers)}")
        self.stdout.write(f"  Suppliers: {len(suppliers)}")
        self.stdout.write(f"  Purchases: {purchase_count} (auto-incremented stock)")
        self.stdout.write(f"  Sales:     {sale_count}")
        self.stdout.write(
            "\nTry:  GET /api/v1/shops/%s/inventory/summary/  and  /api/v1/shops/%s/projections/dashboard/"
            % (shop.id, shop.id)
        )

    # -- steps -----------------------------------------------------------------

    def _ensure_owner(self) -> PlatformUser:
        owner, created = PlatformUser.objects.get_or_create(
            email=DEMO_OWNER_EMAIL,
            defaults={"full_name": "Demo Owner", "is_staff": True},
        )
        owner.set_password(DEMO_OWNER_PASSWORD)
        owner.is_active = True
        owner.save()
        self.stdout.write(("Created" if created else "Reusing") + f" owner {owner.email}")
        return owner

    def _create_shop(self, owner: PlatformUser) -> Shop:
        shop = Shop.objects.create(
            owner_user=owner,
            name="Demo Mart",
            slug=DEMO_SHOP_SLUG,
            legal_name="Demo Mart Retail Pvt Ltd",
            region_code="IN",
            currency_code="INR",
            state_code="27",  # Maharashtra
            gstin="27ABCDE1234F1Z5",
            settings_json={"plan_tier": "pro"},
        )
        ShopMembership.objects.create(
            user=owner,
            shop=shop,
            role=ShopMembership.Role.OWNER,
            status=ShopMembership.Status.ACTIVE,
            email=owner.email,
        )
        self.stdout.write(f"Created shop {shop.name}")
        return shop

    def _promote_domains(self, shop: Shop) -> None:
        for domain in MigrationDomain.values:
            MigrationDomainControl.objects.update_or_create(
                shop=shop,
                domain=domain,
                defaults={
                    "write_master": MigrationWriteMaster.POSTGRES,
                    "bridge_mode": MigrationBridgeMode.FIREBASE_TO_POSTGRES,
                    "cutover_status": MigrationCutoverStatus.POSTGRES_PRIMARY,
                    "current_epoch": 4,
                    "shadow_reads_enabled": True,
                    "is_enabled": True,
                },
            )
        self.stdout.write(f"Promoted {len(MigrationDomain.values)} domains to postgres_primary")

    def _create_catalog(self, shop: Shop, owner: PlatformUser) -> list[InventoryItem]:
        items: list[InventoryItem] = []
        now = timezone.now()
        for name, sku, category, price, gst, cost, opening, unit in CATALOG:
            item = InventoryItem.objects.create(
                shop=shop,
                name=name,
                sku=sku,
                category=category,
                sell_price=Decimal(price),
                gst_rate=Decimal(gst),
                price_includes_tax=True,
                source_meta_json={"unit": unit},
            )
            InventoryItemPrivate.objects.create(item=item, cost_price=Decimal(cost))
            InventoryStockLedger.objects.create(
                shop=shop,
                item=item,
                actor_user=owner,
                event_type=InventoryStockLedger.EventType.OPENING_BALANCE,
                quantity_delta=Decimal(opening),
                unit_cost=Decimal(cost),
                unit_price=Decimal(price),
                note="Opening balance (demo seed)",
                occurred_at=now,
            )
            items.append(item)
        self.stdout.write(f"Created {len(items)} catalog items")
        return items

    def _create_customers(self, shop: Shop) -> list[Customer]:
        customers = [
            Customer.objects.create(shop=shop, name=name, phone=phone)
            for name, phone in CUSTOMERS
        ]
        self.stdout.write(f"Created {len(customers)} customers")
        return customers

    def _create_suppliers(self, shop: Shop) -> list[Supplier]:
        rows = [
            ("Metro Wholesale", "9820011111", "27AAACM1234A1Z1"),
            ("FreshFarm Produce", "9820022222", ""),
            ("DailyGoods Distributors", "9820033333", "27AAADG5678B1Z2"),
        ]
        suppliers = [
            Supplier.objects.create(shop=shop, name=name, phone=phone, gstin=gstin)
            for name, phone, gstin in rows
        ]
        self.stdout.write(f"Created {len(suppliers)} suppliers")
        return suppliers

    def _create_purchases(self, shop, owner, items, suppliers) -> int:
        """Log purchases that auto-increment stock and refresh cost price, using
        the same serializer the API uses (single source of truth)."""
        by_sku = {i.sku: i for i in items}
        # (supplier index, [(sku, qty, unit_cost)], paid_fraction)
        plans = [
            (0, [("BISC-001", "60", "7.20"), ("SNAK-002", "80", "10.50")], Decimal("1")),
            (1, [("LOOSE-TOM", "40", "23.00"), ("LOOSE-ONI", "50", "17.50")], Decimal("0.5")),
            (2, [("DAIR-001", "24", "47.00"), ("BEVG-001", "48", "30.50")], Decimal("0")),
        ]
        created = 0
        for supplier_idx, lines, paid_fraction in plans:
            supplier = suppliers[supplier_idx]
            item_payloads = []
            total = Decimal("0.00")
            for sku, qty, cost in lines:
                item = by_sku.get(sku)
                if item is None:
                    continue
                item_payloads.append(
                    {"inventory_item_id": str(item.id), "quantity": qty, "unit_cost": cost}
                )
                total += Decimal(qty) * Decimal(cost)
            if not item_payloads:
                continue
            paid = (total * paid_fraction).quantize(Decimal("0.01"))
            payload = {
                "supplier_id": str(supplier.id),
                "invoice_number": f"BILL-{1000 + created}",
                "amount_paid": str(paid),
                "payment_mode": "BANK",
                "items": item_payloads,
            }
            serializer = PurchaseSerializer(data=payload, context={"shop": shop, "actor": owner})
            serializer.is_valid(raise_exception=True)
            serializer.save()
            created += 1
        self.stdout.write(f"Created {created} purchases")
        return created

    def _create_sales(self, shop, owner, items, customers, num_sales) -> int:
        loose = [i for i in items if i.sku.startswith("LOOSE")]
        unit_items = [i for i in items if not i.sku.startswith("LOOSE")]
        methods = ["CASH", "CASH", "CASH", "UPI", "UPI", "CARD"]
        created = 0

        for n in range(num_sales):
            days_ago = random.randint(0, 21)
            occurred = timezone.now() - timedelta(days=days_ago, hours=random.randint(0, 8))
            line_items = []

            # 1-3 unit-priced lines
            for it in random.sample(unit_items, random.randint(1, 3)):
                line_items.append({
                    "inventory_item_id": str(it.id),
                    "quantity": random.randint(1, 4),
                    "unit_price": str(it.sell_price),
                })
            # ~40% of carts include a fractional by-weight line
            if loose and random.random() < 0.4:
                it = random.choice(loose)
                weight = Decimal(random.choice(["0.500", "0.750", "1.250", "1.500", "2.250"]))
                line_items.append({
                    "inventory_item_id": str(it.id),
                    "quantity": str(weight),
                    "unit_price": str(it.sell_price),
                })

            subtotal = sum(
                Decimal(str(li["quantity"])) * Decimal(li["unit_price"]) for li in line_items
            ).quantize(Decimal("0.01"))
            # ~25% credit sales (partial payment leaves a balance on the customer)
            on_credit = random.random() < 0.25
            factor = Decimal("0.5") if on_credit else Decimal("1")
            paid = (subtotal * factor).quantize(Decimal("0.01"))

            payload = {
                "items": line_items,
                "payments": [{"payment_method": random.choice(methods), "amount": str(paid)}],
                "occurred_at": occurred.isoformat(),
                "sale_date": occurred.date().isoformat(),
            }
            if random.random() < 0.6:
                payload["customer_id"] = str(random.choice(customers).id)

            serializer = SaleSerializer(data=payload, context={"shop": shop, "actor": owner})
            serializer.is_valid(raise_exception=True)
            serializer.save()
            created += 1

        self.stdout.write(f"Created {created} sales")
        return created
