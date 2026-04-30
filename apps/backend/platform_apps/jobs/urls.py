from django.urls import path

from platform_apps.jobs.views import (
    MigrationBridgeReceiptListView,
    MigrationDomainControlDetailView,
    MigrationDomainControlListCreateView,
    MigrationJobRunDetailView,
    MigrationJobRunListCreateView,
    MigrationPilotPromotePrimaryView,
    MigrationPilotPromoteReadyView,
    MigrationPilotRollbackView,
    MigrationPilotReadinessListView,
    MigrationShadowSummaryListView,
)

urlpatterns = [
    path("domains/", MigrationDomainControlListCreateView.as_view(), name="migration-domain-list"),
    path("domains/<uuid:control_id>/", MigrationDomainControlDetailView.as_view(), name="migration-domain-detail"),
    path("jobs/", MigrationJobRunListCreateView.as_view(), name="migration-job-list"),
    path("jobs/<uuid:job_id>/", MigrationJobRunDetailView.as_view(), name="migration-job-detail"),
    path("bridge-receipts/", MigrationBridgeReceiptListView.as_view(), name="migration-bridge-receipt-list"),
    path("shadow-summaries/", MigrationShadowSummaryListView.as_view(), name="migration-shadow-summary-list"),
    path("pilot-readiness/", MigrationPilotReadinessListView.as_view(), name="migration-pilot-readiness-list"),
    path("domains/<uuid:control_id>/promote-ready/", MigrationPilotPromoteReadyView.as_view(), name="migration-promote-ready"),
    path("domains/<uuid:control_id>/promote-primary/", MigrationPilotPromotePrimaryView.as_view(), name="migration-promote-primary"),
    path("domains/<uuid:control_id>/rollback/", MigrationPilotRollbackView.as_view(), name="migration-rollback"),
]
