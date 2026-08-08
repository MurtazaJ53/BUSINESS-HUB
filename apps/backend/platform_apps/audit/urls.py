from django.urls import path

from platform_apps.audit.views import (
    MigrationReconciliationEventDetailView,
    MigrationReconciliationEventListCreateView,
)

urlpatterns = [
    path("", MigrationReconciliationEventListCreateView.as_view(), name="migration-reconciliation-list"),
    path("<uuid:event_id>/", MigrationReconciliationEventDetailView.as_view(), name="migration-reconciliation-detail"),
]
