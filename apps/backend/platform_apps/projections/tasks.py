from __future__ import annotations

from celery import shared_task

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
