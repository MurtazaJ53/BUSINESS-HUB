from django.urls import path

from platform_apps.shops.invite_views import (
    ShopInviteListCreateView,
    ShopInviteRevokeView,
)
from platform_apps.audit.views import WorkspaceAuditEventListView
from platform_apps.attendance.views import (
    AttendanceSessionDetailView,
    AttendanceSessionListCreateView,
    AttendanceSummaryView,
)
from platform_apps.customers.views import (
    CustomerDetailView,
    CustomerLedgerListCreateView,
    CustomerLedgerTimelineView,
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
from platform_apps.purchases.views import (
    PurchaseDetailView,
    PurchaseListCreateView,
    PurchaseSummaryView,
    SupplierDetailView,
    SupplierLedgerView,
    SupplierListCreateView,
    SupplierSummaryView,
)
from platform_apps.projections.reports import ProfitAndLossView
from platform_apps.projections.views import (
    ShopDashboardSnapshotView,
    ShopPulseSignalDetailView,
    ShopPulseSignalListView,
    ShopPulseSnapshotView,
)
from platform_apps.sales.views import SaleCommandIngestionView, SaleDetailView, SaleListCreateView, SaleVoidView, SaleSummaryView, SaleGstSummaryView, GSTR1ExportView, GSTR3BExportView, GSTFilingPackView
from platform_apps.shops.views import (
    ShopDomainStateView,
    ShopMembershipListView,
    ShopPlanRequestListCreateView,
    WorkspaceOwnershipTransferView,
    WorkspaceAccessSessionDetailView,
    WorkspaceAccessSessionHeartbeatView,
    WorkspaceAccessSessionListView,
    WorkspaceAccessSessionWipeAcknowledgeView,
    WorkspaceTeamDetailView,
    WorkspaceTeamListCreateView,
)

urlpatterns = [
    path("", ShopMembershipListView.as_view(), name="shop-memberships"),
    path("<uuid:shop_id>/domain-state/<slug:domain>/", ShopDomainStateView.as_view(), name="shop-domain-state"),
    path("<uuid:shop_id>/plan-requests/", ShopPlanRequestListCreateView.as_view(), name="shop-plan-requests"),
    path("<uuid:shop_id>/team/", WorkspaceTeamListCreateView.as_view(), name="workspace-team"),
    path("<uuid:shop_id>/team/<uuid:membership_id>/", WorkspaceTeamDetailView.as_view(), name="workspace-team-detail"),
    path("<uuid:shop_id>/invites/", ShopInviteListCreateView.as_view(), name="shop-invites"),
    path("<uuid:shop_id>/invites/<uuid:invite_id>/revoke/", ShopInviteRevokeView.as_view(), name="shop-invite-revoke"),
    path("<uuid:shop_id>/audit/", WorkspaceAuditEventListView.as_view(), name="workspace-audit"),
    path("<uuid:shop_id>/sessions/", WorkspaceAccessSessionListView.as_view(), name="workspace-sessions"),
    path(
        "<uuid:shop_id>/sessions/mobile/heartbeat/",
        WorkspaceAccessSessionHeartbeatView.as_view(),
        name="workspace-sessions-mobile-heartbeat",
    ),
    path(
        "<uuid:shop_id>/sessions/<uuid:session_id>/",
        WorkspaceAccessSessionDetailView.as_view(),
        name="workspace-session-detail",
    ),
    path(
        "<uuid:shop_id>/sessions/<uuid:session_id>/wipe-ack/",
        WorkspaceAccessSessionWipeAcknowledgeView.as_view(),
        name="workspace-session-wipe-ack",
    ),
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
    path(
        "<uuid:shop_id>/customers/<uuid:customer_id>/timeline/",
        CustomerLedgerTimelineView.as_view(),
        name="customer-ledger-timeline",
    ),
    path("<uuid:shop_id>/attendance/", AttendanceSessionListCreateView.as_view(), name="attendance-list"),
    path("<uuid:shop_id>/attendance/summary/", AttendanceSummaryView.as_view(), name="attendance-summary"),
    path(
        "<uuid:shop_id>/attendance/<uuid:attendance_id>/",
        AttendanceSessionDetailView.as_view(),
        name="attendance-detail",
    ),
    path("<uuid:shop_id>/suppliers/", SupplierListCreateView.as_view(), name="supplier-list"),
    path("<uuid:shop_id>/suppliers/summary/", SupplierSummaryView.as_view(), name="supplier-summary"),
    path("<uuid:shop_id>/suppliers/<uuid:supplier_id>/", SupplierDetailView.as_view(), name="supplier-detail"),
    path(
        "<uuid:shop_id>/suppliers/<uuid:supplier_id>/ledger/",
        SupplierLedgerView.as_view(),
        name="supplier-ledger",
    ),
    path("<uuid:shop_id>/purchases/", PurchaseListCreateView.as_view(), name="purchase-list"),
    path("<uuid:shop_id>/purchases/summary/", PurchaseSummaryView.as_view(), name="purchase-summary"),
    path("<uuid:shop_id>/purchases/<uuid:purchase_id>/", PurchaseDetailView.as_view(), name="purchase-detail"),
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
    path(
        "<uuid:shop_id>/reports/profit-loss/",
        ProfitAndLossView.as_view(),
        name="report-profit-loss",
    ),
    path(
        "<uuid:shop_id>/projections/pulse/",
        ShopPulseSnapshotView.as_view(),
        name="projection-pulse",
    ),
    path(
        "<uuid:shop_id>/projections/pulse/signals/",
        ShopPulseSignalListView.as_view(),
        name="projection-pulse-signals",
    ),
    path(
        "<uuid:shop_id>/projections/pulse/signals/<uuid:signal_id>/",
        ShopPulseSignalDetailView.as_view(),
        name="projection-pulse-signal-detail",
    ),
    path("<uuid:shop_id>/sales/", SaleListCreateView.as_view(), name="sale-list"),
    path("<uuid:shop_id>/sales/export/gstr1/", GSTR1ExportView.as_view(), name="sale-gstr1-export"),
    path("<uuid:shop_id>/sales/export/gstr3b/", GSTR3BExportView.as_view(), name="sale-gstr3b-export"),
    path("<uuid:shop_id>/sales/export/gst-pack/", GSTFilingPackView.as_view(), name="sale-gst-pack"),
    path("<uuid:shop_id>/sales/summary/", SaleSummaryView.as_view(), name="sale-summary"),
    path("<uuid:shop_id>/sales/summary/gst/", SaleGstSummaryView.as_view(), name="sale-gst-summary"),
    path("<uuid:shop_id>/sales/commands/", SaleCommandIngestionView.as_view(), name="sale-command-ingestion"),
    path("<uuid:shop_id>/sales/<uuid:sale_id>/", SaleDetailView.as_view(), name="sale-detail"),
    path("<uuid:shop_id>/sales/<uuid:sale_id>/void/", SaleVoidView.as_view(), name="sale-void"),
    path(
        "<uuid:shop_id>/inventory/<uuid:item_id>/adjust-stock/",
        InventoryItemAdjustmentView.as_view(),
        name="inventory-adjust-stock",
    ),
]
