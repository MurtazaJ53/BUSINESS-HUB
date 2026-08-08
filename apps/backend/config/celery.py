from __future__ import annotations

import os
from datetime import timedelta

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
    "platform_apps.projections.tasks.run_shop_pulse_cycle_task": {
        "queue": "projection-refresh"
    },
    "platform_apps.projections.tasks.run_workspace_pulse_cycles_task": {
        "queue": "projection-refresh"
    },
    "platform_apps.erpnext.tasks.run_erpnext_cycle_task": {"queue": "erpnext-sync"},
    "platform_apps.erpnext.tasks.run_erpnext_enabled_cycles_task": {"queue": "erpnext-sync"},
}
beat_schedule: dict[str, object] = {}
if os.getenv("ERPNEXT_CYCLE_BEAT_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}:
    beat_minutes = int(os.getenv("ERPNEXT_CYCLE_BEAT_MINUTES", "15"))
    beat_schedule["erpnext-enabled-shops-cycle"] = {
        "task": "platform_apps.erpnext.tasks.run_erpnext_enabled_cycles_task",
        "schedule": timedelta(minutes=beat_minutes),
        "kwargs": {
            "limit": int(os.getenv("ERPNEXT_CYCLE_BEAT_LIMIT", "100")),
            "verify_connection": True,
            "sync_items": True,
            "sync_customers": True,
            "sync_stock": True,
            "sync_suppliers": True,
            "sync_purchases": True,
            "sync_supplier_payments": True,
            "push_sales": True,
            "push_payments": True,
        },
    }
if os.getenv("WORKSPACE_PULSE_BEAT_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}:
    pulse_minutes = int(os.getenv("WORKSPACE_PULSE_BEAT_MINUTES", "20"))
    beat_schedule["workspace-pulse-cycle"] = {
        "task": "platform_apps.projections.tasks.run_workspace_pulse_cycles_task",
        "schedule": timedelta(minutes=pulse_minutes),
        "kwargs": {
            "signal_limit": None,
            "active_only": True,
        },
    }
if beat_schedule:
    celery_app.conf.beat_schedule = beat_schedule
celery_app.autodiscover_tasks()
