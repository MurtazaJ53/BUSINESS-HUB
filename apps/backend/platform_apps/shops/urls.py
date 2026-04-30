from django.urls import path

from platform_apps.attendance.views import AttendanceSessionDetailView, AttendanceSessionListCreateView
from platform_apps.customers.views import (
    CustomerDetailView,
    CustomerLedgerListCreateView,
    CustomerListCreateView,
)
from platform_apps.expenses.views import ExpenseDetailView, ExpenseListCreateView
from platform_apps.inventory.views import (
    InventoryItemAdjustmentView,
    InventoryItemDetailView,
    InventoryItemListCreateView,
)
from platform_apps.payments.views import SalePaymentListView
from platform_apps.projections.views import ShopDashboardSnapshotView
from platform_apps.sales.views import SaleDetailView, SaleListCreateView
from platform_apps.shops.views import ShopMembershipListView

urlpatterns = [
    path("", ShopMembershipListView.as_view(), name="shop-memberships"),
    path("<uuid:shop_id>/customers/", CustomerListCreateView.as_view(), name="customer-list"),
    path("<uuid:shop_id>/customers/<uuid:customer_id>/", CustomerDetailView.as_view(), name="customer-detail"),
    path(
        "<uuid:shop_id>/customers/<uuid:customer_id>/ledger/",
        CustomerLedgerListCreateView.as_view(),
        name="customer-ledger",
    ),
    path("<uuid:shop_id>/attendance/", AttendanceSessionListCreateView.as_view(), name="attendance-list"),
    path(
        "<uuid:shop_id>/attendance/<uuid:attendance_id>/",
        AttendanceSessionDetailView.as_view(),
        name="attendance-detail",
    ),
    path("<uuid:shop_id>/expenses/", ExpenseListCreateView.as_view(), name="expense-list"),
    path("<uuid:shop_id>/expenses/<uuid:expense_id>/", ExpenseDetailView.as_view(), name="expense-detail"),
    path("<uuid:shop_id>/inventory/", InventoryItemListCreateView.as_view(), name="inventory-list"),
    path("<uuid:shop_id>/inventory/<uuid:item_id>/", InventoryItemDetailView.as_view(), name="inventory-detail"),
    path("<uuid:shop_id>/payments/", SalePaymentListView.as_view(), name="payment-list"),
    path(
        "<uuid:shop_id>/projections/dashboard/",
        ShopDashboardSnapshotView.as_view(),
        name="projection-dashboard",
    ),
    path("<uuid:shop_id>/sales/", SaleListCreateView.as_view(), name="sale-list"),
    path("<uuid:shop_id>/sales/<uuid:sale_id>/", SaleDetailView.as_view(), name="sale-detail"),
    path(
        "<uuid:shop_id>/inventory/<uuid:item_id>/adjust-stock/",
        InventoryItemAdjustmentView.as_view(),
        name="inventory-adjust-stock",
    ),
]
