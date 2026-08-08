from __future__ import annotations

import json

from django.core.management.base import BaseCommand

from platform_apps.projections.tasks import run_workspace_pulse_cycles_task


class Command(BaseCommand):
    help = "Run the workspace pulse cycle for every active shop."

    def add_arguments(self, parser):
        parser.add_argument("--signal-limit", type=int, default=None)
        parser.add_argument("--include-inactive", action="store_true")

    def handle(self, *args, **options):
        payload = run_workspace_pulse_cycles_task.run(
            signal_limit=options["signal_limit"],
            active_only=not options["include_inactive"],
        )
        self.stdout.write(json.dumps(payload, indent=2, default=str))
