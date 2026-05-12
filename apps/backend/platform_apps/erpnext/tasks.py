from __future__ import annotations

from celery import shared_task

from platform_apps.erpnext.services import ERPNextIntegrationService
from platform_apps.shops.models import Shop


@shared_task(bind=True)
def run_erpnext_cycle_task(
    self,
    *,
    shop_id: str,
    limit: int = 100,
    verify_connection: bool = True,
    sync_items: bool = True,
    sync_customers: bool = True,
    push_sales: bool = True,
    push_payments: bool = True,
):
    shop = Shop.objects.get(pk=shop_id)
    return ERPNextIntegrationService().run_cycle(
        shop=shop,
        limit=limit,
        verify_connection=verify_connection,
        sync_items=sync_items,
        sync_customers=sync_customers,
        push_sales=push_sales,
        push_payments=push_payments,
    )
