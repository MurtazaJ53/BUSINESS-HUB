from django.urls import path

from platform_apps.attendance.views import (
    AttendanceSessionDetailView,
    AttendanceSessionListCreateView,
    AttendanceSummaryView,
)
from platform_apps.customers.views import (
    CustomerDetailView,
    CustomerLedgerListCreateView,
    CustomerListCreateView,
    CustomerSummaryView,
)
from platform_apps.expenses.views import ExpenseDetailView, ExpenseListCreateView, ExpenseSummaryView
from platform_apps.inventory.views import (
    InventoryItemAdjustmentView,
    InventoryItemDetailView,
    InventoryItemListCreateView,
    InventorySummaryView,
)
from platform_apps.payments.views import SalePaymentCommandIngestionView, SalePaymentListView
from platform_apps.payments.views import SalePaymentSummaryView
from platform_apps.projections.views import ShopDashboardSnapshotView
from platform_apps.sales.views import SaleCommandIngestionView, SaleDetailView, SaleListCreateView
from platform_apps.sales.views import SaleSummaryView
from platform_apps.shops.views import (
    ShopDomainStateView,
    ShopMembershipListView,
    ShopPlanRequestListCreateView,
    WorkspaceOwnershipTransferView,
    WorkspaceTeamDetailView,
    WorkspaceTeamListCreateView,
)

urlpatterns = [
    path("", ShopMembershipListView.as_view(), name="shop-memberships"),
    path("<uuid:shop_id>/domain-state/<slug:domain>/", ShopDomainStateView.as_view(), name="shop-domain-state"),
    path("<uuid:shop_id>/plan-requests/", ShopPlanRequestListCreateView.as_view(), name="shop-plan-requests"),
    path("<uuid:shop_id>/team/", WorkspaceTeamListCreateView.as_view(), name="workspace-team"),
    path("<uuid:shop_id>/team/<uuid:membership_id>/", WorkspaceTeamDetailView.as_view(), name="workspace-team-detail"),
    path(
        "<uuid:shop_id>/team/transfer-ownership/",
        WorkspaceOwnershipTransferView.as_view(),
        name="workspace-team-transfer-ownership",
    ),
    path("<uuid:shop_id>/customers/", CustomerListCreateView.as_view(), name="customer-list"),
    path("<uuid:shop_id>/customers/summary/", CustomerSummaryView.as_view(), name="customer-summary"),
    path("<uuid:shop_id>/customers/<uuid:customer_id>/", CustomerDetailView.as_view(), name="customer-detail"),
    path(
        "<uuid:shop_id>/customers/<uuid:customer_id>/ledger/",
        CustomerLedgerListCreateView.as_view(),
        name="customer-ledger",
    ),
    path("<uuid:shop_id>/attendance/", AttendanceSessionListCreateView.as_view(), name="attendance-list"),
    path("<uuid:shop_id>/attendance/summary/", AttendanceSummaryView.as_view(), name="attendance-summary"),
    path(
        "<uuid:shop_id>/attendance/<uuid:attendance_id>/",
        AttendanceSessionDetailView.as_view(),
        name="attendance-detail",
    ),
    path("<uuid:shop_id>/expenses/", ExpenseListCreateView.as_view(), name="expense-list"),
    path("<uuid:shop_id>/expenses/summary/", ExpenseSummaryView.as_view(), name="expense-summary"),
    path("<uuid:shop_id>/expenses/<uuid:expense_id>/", ExpenseDetailView.as_view(), name="expense-detail"),
    path("<uuid:shop_id>/inventory/", InventoryItemListCreateView.as_view(), name="inventory-list"),
    path("<uuid:shop_id>/inventory/summary/", InventorySummaryView.as_view(), name="inventory-summary"),
    path("<uuid:shop_id>/inventory/<uuid:item_id>/", InventoryItemDetailView.as_view(), name="inventory-detail"),
    path("<uuid:shop_id>/payments/", SalePaymentListView.as_view(), name="payment-list"),
    path("<uuid:shop_id>/payments/summary/", SalePaymentSummaryView.as_view(), name="payment-summary"),
    path(
        "<uuid:shop_id>/payments/commands/",
        SalePaymentCommandIngestionView.as_view(),
        name="payment-command-ingestion",
    ),
    path(
        "<uuid:shop_id>/projections/dashboard/",
        ShopDashboardSnapshotView.as_view(),
        name="projection-dashboard",
    ),
    path("<uuid:shop_id>/sales/", SaleListCreateView.as_view(), name="sale-list"),
    path("<uuid:shop_id>/sales/summary/", SaleSummaryView.as_view(), name="sale-summary"),
    path("<uuid:shop_id>/sales/commands/", SaleCommandIngestionView.as_view(), name="sale-command-ingestion"),
    path("<uuid:shop_id>/sales/<uuid:sale_id>/", SaleDetailView.as_view(), name="sale-detail"),
    path(
        "<uuid:shop_id>/inventory/<uuid:item_id>/adjust-stock/",
        InventoryItemAdjustmentView.as_view(),
        name="inventory-adjust-stock",
    ),
]
