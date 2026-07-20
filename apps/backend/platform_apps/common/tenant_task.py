"""A Celery base task that enforces + binds the tenant (shop) context.

Usage::

    @shared_task(base=TenantTask, bind=True)
    def build_something(self, shop_id=None, ...):
        ...  # queries via a TenantAwareManager are auto-scoped to shop_id

Any task inheriting this MUST be enqueued with a ``shop_id`` kwarg, or it fails
fast (before running) — so a background job can never silently process every
shop's data. The context is always cleared afterwards so the pooled worker
thread is clean for the next task.
"""

from __future__ import annotations

from celery import Task

from platform_apps.common.tenant_context import clear_current_shop_id, set_current_shop_id


class TenantTask(Task):
    abstract = True

    def __call__(self, *args, **kwargs):
        shop_id = kwargs.get("shop_id")
        if not shop_id:
            raise ValueError(
                f"TenantTask '{self.name}' was enqueued without a 'shop_id' kwarg. "
                "Background tasks must declare the tenant explicitly."
            )
        set_current_shop_id(shop_id)
        try:
            return super().__call__(*args, **kwargs)
        finally:
            clear_current_shop_id()
