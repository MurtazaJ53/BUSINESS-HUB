"""Tenant-aware model manager.

When a Celery [TenantTask] has bound a shop id to the thread, reads through this
manager are automatically restricted to that shop — so a background job that
forgets an explicit ``.filter(shop=...)`` still can't leak another tenant's
rows. Outside a task (HTTP requests, Django admin, management commands, tests)
``get_current_shop_id()`` is ``None`` and the manager behaves exactly like the
default one, so nothing else changes.
"""

from __future__ import annotations

from django.db import models

from platform_apps.common.tenant_context import get_current_shop_id


class TenantAwareManager(models.Manager):
    def get_queryset(self):
        qs = super().get_queryset()
        shop_id = get_current_shop_id()
        if shop_id is not None:
            return qs.filter(shop_id=shop_id)
        return qs
