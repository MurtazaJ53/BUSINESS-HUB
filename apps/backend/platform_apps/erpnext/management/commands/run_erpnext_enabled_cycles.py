from __future__ import annotations

import json

from django.core.management.base import BaseCommand

from platform_apps.erpnext.tasks import run_erpnext_enabled_cycles_task


class Command(BaseCommand):
    help = "Run the ERPNext cycle for every enabled shop binding."

    def add_arguments(self, parser):
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
        payload = run_erpnext_enabled_cycles_task.run(
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
        self.stdout.write(json.dumps(payload, indent=2, default=str))
