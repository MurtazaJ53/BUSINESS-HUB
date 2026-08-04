"""Re-evaluate every subscription against the clock.

Run daily (cron / Celery beat). Moves lapsed workspaces to past_due, then to
expired after the grace period, and mirrors the entitlement onto the shop so
paid features lock without any customer data being touched.
"""
from __future__ import annotations

from django.core.management.base import BaseCommand

from platform_apps.billing.models import Subscription


class Command(BaseCommand):
    help = "Expire or downgrade subscriptions whose paid period has lapsed."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing anything.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        changed = 0
        checked = 0

        queryset = Subscription.objects.select_related("shop").exclude(
            status__in=[Subscription.Status.EXPIRED, Subscription.Status.CANCELLED]
        )
        for subscription in queryset.iterator():
            checked += 1
            before = subscription.status
            if dry_run:
                # Recompute without persisting.
                after = before
                if not subscription.has_paid_access():
                    after = Subscription.Status.EXPIRED
                if after != before:
                    changed += 1
                    self.stdout.write(
                        f"[dry-run] {subscription.shop.name}: {before} -> {after}"
                    )
                continue

            after = subscription.refresh_status()
            if after != before:
                changed += 1
                self.stdout.write(f"{subscription.shop.name}: {before} -> {after}")

        self.stdout.write(
            self.style.SUCCESS(f"Checked {checked} subscription(s); {changed} changed.")
        )
