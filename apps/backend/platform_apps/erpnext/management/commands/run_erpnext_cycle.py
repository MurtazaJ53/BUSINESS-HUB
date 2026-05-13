from __future__ import annotations

import json

from django.core.management.base import BaseCommand, CommandError

from platform_apps.erpnext.services import ERPNextConfigurationError, ERPNextIntegrationService
from platform_apps.shops.models import Shop


class Command(BaseCommand):
    help = "Run the ERPNext sync/posting cycle for one Business Hub shop."

    def add_arguments(self, parser):
        parser.add_argument("--shop-id", dest="shop_id")
        parser.add_argument("--shop-slug", dest="shop_slug")
        parser.add_argument("--limit", type=int, default=100)
        parser.add_argument("--skip-verify", action="store_true")
        parser.add_argument("--skip-items", action="store_true")
        parser.add_argument("--skip-customers", action="store_true")
        parser.add_argument("--skip-stock", action="store_true")
        parser.add_argument("--skip-suppliers", action="store_true")
        parser.add_argument("--skip-purchases", action="store_true")
        parser.add_argument("--skip-supplier-payments", action="store_true")
        parser.add_argument("--skip-sales", action="store_true")
        parser.add_argument("--skip-payments", action="store_true")

    def handle(self, *args, **options):
        shop = self._resolve_shop(shop_id=options.get("shop_id"), shop_slug=options.get("shop_slug"))
        service = ERPNextIntegrationService()
        try:
            payload = service.run_cycle(
                shop=shop,
                limit=options["limit"],
                verify_connection=not options["skip_verify"],
                sync_items=not options["skip_items"],
                sync_customers=not options["skip_customers"],
                sync_stock=not options["skip_stock"],
                sync_suppliers=not options["skip_suppliers"],
                sync_purchases=not options["skip_purchases"],
                sync_supplier_payments=not options["skip_supplier_payments"],
                push_sales=not options["skip_sales"],
                push_payments=not options["skip_payments"],
            )
        except ERPNextConfigurationError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(json.dumps(payload, indent=2, default=str))

    def _resolve_shop(self, *, shop_id: str | None, shop_slug: str | None) -> Shop:
        if not shop_id and not shop_slug:
            raise CommandError("Pass either --shop-id or --shop-slug.")
        queryset = Shop.objects.all()
        if shop_id:
            shop = queryset.filter(id=shop_id).first()
            if shop is None:
                raise CommandError(f"Shop {shop_id} was not found.")
            return shop
        shop = queryset.filter(slug=shop_slug).first()
        if shop is None:
            raise CommandError(f"Shop {shop_slug} was not found.")
        return shop
