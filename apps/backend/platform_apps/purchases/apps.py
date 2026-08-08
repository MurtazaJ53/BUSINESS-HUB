from __future__ import annotations

from django.apps import AppConfig


class PurchasesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "platform_apps.purchases"
    label = "purchases"
