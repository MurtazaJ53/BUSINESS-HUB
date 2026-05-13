from __future__ import annotations

from celery import shared_task

from platform_apps.erpnext.models import ERPNextShopBinding
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
    sync_stock: bool = True,
    sync_suppliers: bool = True,
    sync_purchases: bool = True,
    sync_supplier_payments: bool = True,
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
        sync_stock=sync_stock,
        sync_suppliers=sync_suppliers,
        sync_purchases=sync_purchases,
        sync_supplier_payments=sync_supplier_payments,
        push_sales=push_sales,
        push_payments=push_payments,
    )


@shared_task(bind=True)
def run_erpnext_enabled_cycles_task(
    self,
    *,
    limit: int = 100,
    verify_connection: bool = True,
    sync_items: bool = True,
    sync_customers: bool = True,
    sync_stock: bool = True,
    sync_suppliers: bool = True,
    sync_purchases: bool = True,
    sync_supplier_payments: bool = True,
    push_sales: bool = True,
    push_payments: bool = True,
):
    service = ERPNextIntegrationService()
    results: list[dict[str, object]] = []
    bindings = ERPNextShopBinding.objects.filter(is_enabled=True).select_related("shop").order_by("shop__slug")
    for binding in bindings:
        try:
            payload = service.run_cycle(
                shop=binding.shop,
                limit=limit,
                verify_connection=verify_connection,
                sync_items=sync_items,
                sync_customers=sync_customers,
                sync_stock=sync_stock,
                sync_suppliers=sync_suppliers,
                sync_purchases=sync_purchases,
                sync_supplier_payments=sync_supplier_payments,
                push_sales=push_sales,
                push_payments=push_payments,
            )
            results.append(
                {
                    "shop_id": str(binding.shop.id),
                    "shop_slug": binding.shop.slug,
                    "status": payload.get("overall_status", "unknown"),
                    "payload": payload,
                }
            )
        except Exception as exc:
            results.append(
                {
                    "shop_id": str(binding.shop.id),
                    "shop_slug": binding.shop.slug,
                    "status": "failed",
                    "detail": str(exc),
                }
            )
    return {
        "enabled_shop_count": bindings.count(),
        "results": results,
    }
