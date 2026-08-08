"""Thread-local current-tenant (shop) registry for background jobs.

HTTP requests carry the tenant in the URL and enforce it via
``get_membership_or_403``. Celery tasks run outside that cycle, so
[TenantTask][platform_apps.common.tenant_task.TenantTask] binds the shop id here
for the duration of the task, and [TenantAwareManager] reads it to auto-scope
queries — defense in depth against a task forgetting an explicit ``.filter``.
"""

from __future__ import annotations

import threading

_thread_locals = threading.local()


def set_current_shop_id(shop_id) -> None:
    _thread_locals.shop_id = shop_id


def get_current_shop_id():
    return getattr(_thread_locals, "shop_id", None)


def clear_current_shop_id() -> None:
    if hasattr(_thread_locals, "shop_id"):
        del _thread_locals.shop_id
