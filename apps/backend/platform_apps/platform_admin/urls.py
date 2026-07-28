from django.urls import path
from platform_apps.platform_admin.views import (
    PlatformAuditEventListView, PlatformMetricsView,
    PlatformShopActivateView, PlatformShopApproveView,
    PlatformShopDetailView, PlatformShopListView,
    PlatformShopPlanView, PlatformShopSuspendView,
)

urlpatterns = [
    path("shops/", PlatformShopListView.as_view(), name="platform-shop-list"),
    path("shops/<uuid:shop_id>/", PlatformShopDetailView.as_view(), name="platform-shop-detail"),
    path("shops/<uuid:shop_id>/suspend/", PlatformShopSuspendView.as_view(), name="platform-shop-suspend"),
    path("shops/<uuid:shop_id>/activate/", PlatformShopActivateView.as_view(), name="platform-shop-activate"),
    path("shops/<uuid:shop_id>/approve/", PlatformShopApproveView.as_view(), name="platform-shop-approve"),
    path("shops/<uuid:shop_id>/plan/", PlatformShopPlanView.as_view(), name="platform-shop-plan"),
    path("audit/", PlatformAuditEventListView.as_view(), name="platform-audit"),
    path("metrics/", PlatformMetricsView.as_view(), name="platform-metrics"),
]
