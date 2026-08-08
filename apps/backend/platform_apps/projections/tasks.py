from __future__ import annotations

from celery import shared_task

from platform_apps.projections.pulse import run_shop_pulse_cycle
from platform_apps.projections.services import refresh_shop_dashboard_projection
from platform_apps.shops.models import Shop


@shared_task(bind=True)
def refresh_dashboard_projection_task(self, shop_id: str) -> dict[str, str]:
    shop = Shop.objects.get(pk=shop_id)
    snapshot = refresh_shop_dashboard_projection(shop)
    return {
        "status": "ok",
        "task_id": self.request.id,
        "shop_id": str(shop.id),
        "snapshot_id": str(snapshot.id),
        "refreshed_at": snapshot.refreshed_at.isoformat(),
    }


@shared_task(bind=True)
def run_shop_pulse_cycle_task(
    self,
    *,
    shop_id: str,
    signal_limit: int | None = None,
):
    shop = Shop.objects.get(pk=shop_id)
    payload = run_shop_pulse_cycle(shop, signal_limit=signal_limit)
    return {
        "status": "ok",
        "task_id": self.request.id,
        **payload,
    }


@shared_task(bind=True)
def run_workspace_pulse_cycles_task(
    self,
    *,
    signal_limit: int | None = None,
    active_only: bool = True,
):
    results: list[dict[str, object]] = []
    queryset = Shop.objects.all().order_by("slug")
    if active_only:
        queryset = queryset.filter(is_active=True)
    for shop in queryset:
        payload = run_shop_pulse_cycle(shop, signal_limit=signal_limit)
        results.append(
            {
                "shop_id": str(shop.id),
                "shop_slug": shop.slug,
                "signal_count": payload["signal_count"],
                "auto_escalated_count": payload["auto_escalated_count"],
                "auto_escalated_signal_codes": payload["auto_escalated_signal_codes"],
                "refreshed_at": payload["refreshed_at"],
            }
        )
    return {
        "status": "ok",
        "task_id": self.request.id,
        "shop_count": queryset.count(),
        "results": results,
    }
