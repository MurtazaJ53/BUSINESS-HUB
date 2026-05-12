from __future__ import annotations

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

celery_app = Celery("business_hub_backend")
celery_app.config_from_object("django.conf:settings", namespace="CELERY")
celery_app.conf.task_default_queue = os.getenv("CELERY_TASK_DEFAULT_QUEUE", "default")
celery_app.conf.task_routes = {
    "platform_apps.jobs.tasks.backfill_domain_snapshot": {"queue": "migration"},
    "platform_apps.jobs.tasks.run_shadow_compare": {"queue": "reconciliation"},
    "platform_apps.jobs.tasks.ping_task": {"queue": "default"},
    "platform_apps.projections.tasks.refresh_dashboard_projection_task": {
        "queue": "projection-refresh"
    },
    "platform_apps.erpnext.tasks.run_erpnext_cycle_task": {"queue": "erpnext-sync"},
}
celery_app.autodiscover_tasks()
