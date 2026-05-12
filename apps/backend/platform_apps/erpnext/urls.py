from django.urls import path

from platform_apps.erpnext.views import (
    ERPNextDocumentLinkListView,
    ERPNextHealthCheckView,
    ERPNextMetaView,
    ERPNextShopBindingDetailView,
    ERPNextShopPocSummaryView,
    ERPNextShopSyncStateView,
    ERPNextShopVerifyConnectionView,
)

urlpatterns = [
    path("erpnext/meta/", ERPNextMetaView.as_view(), name="erpnext-meta"),
    path("erpnext/health/", ERPNextHealthCheckView.as_view(), name="erpnext-health"),
    path("shops/<uuid:shop_id>/erpnext/binding/", ERPNextShopBindingDetailView.as_view(), name="erpnext-binding"),
    path(
        "shops/<uuid:shop_id>/erpnext/verify-connection/",
        ERPNextShopVerifyConnectionView.as_view(),
        name="erpnext-verify-connection",
    ),
    path(
        "shops/<uuid:shop_id>/erpnext/sync-state/",
        ERPNextShopSyncStateView.as_view(),
        name="erpnext-sync-state",
    ),
    path(
        "shops/<uuid:shop_id>/erpnext/poc-summary/",
        ERPNextShopPocSummaryView.as_view(),
        name="erpnext-poc-summary",
    ),
    path(
        "shops/<uuid:shop_id>/erpnext/document-links/",
        ERPNextDocumentLinkListView.as_view(),
        name="erpnext-document-links",
    ),
]

