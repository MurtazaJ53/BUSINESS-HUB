from django.urls import path

from platform_apps.inventory.views import (
    InventoryItemAdjustmentView,
    InventoryItemDetailView,
    InventoryItemListCreateView,
)
from platform_apps.shops.views import ShopMembershipListView

urlpatterns = [
    path("", ShopMembershipListView.as_view(), name="shop-memberships"),
    path("<uuid:shop_id>/inventory/", InventoryItemListCreateView.as_view(), name="inventory-list"),
    path("<uuid:shop_id>/inventory/<uuid:item_id>/", InventoryItemDetailView.as_view(), name="inventory-detail"),
    path(
        "<uuid:shop_id>/inventory/<uuid:item_id>/adjust-stock/",
        InventoryItemAdjustmentView.as_view(),
        name="inventory-adjust-stock",
    ),
]
