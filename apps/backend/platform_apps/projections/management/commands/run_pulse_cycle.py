from __future__ import annotations

import json

from django.core.management.base import BaseCommand, CommandError

from platform_apps.projections.tasks import run_shop_pulse_cycle_task
from platform_apps.shops.models import Shop


class Command(BaseCommand):
    help = "Run the workspace pulse cycle for one shop."

    def add_arguments(self, parser):
        parser.add_argument("--shop-slug", required=True)
        parser.add_argument("--signal-limit", type=int, default=None)

    def handle(self, *args, **options):
        shop_slug = options["shop_slug"].strip()
        shop = Shop.objects.filter(slug=shop_slug).first()
        if shop is None:
            raise CommandError(f"Shop with slug '{shop_slug}' was not found.")
        payload = run_shop_pulse_cycle_task.run(
            shop_id=str(shop.id),
            signal_limit=options["signal_limit"],
        )
        self.stdout.write(json.dumps(payload, indent=2, default=str))

