from django.urls import path

from platform_apps.jobs.views import (
    MigrationBridgeReceiptListView,
    MigrationControlEventListView,
    MigrationDomainControlDetailView,
    MigrationDomainControlListCreateView,
    MigrationJobRunDetailView,
    MigrationJobRunListCreateView,
    MigrationPilotPrepareView,
    MigrationPilotPromotePrimaryView,
    MigrationPilotPromoteReadyView,
    MigrationPilotRollbackView,
    MigrationPilotReadinessListView,
    MigrationPilotSignoffListView,
    MigrationPilotShopScorecardListView,
    MigrationPilotVerifyView,
    MigrationShadowSummaryListView,
)

urlpatterns = [
    path("domains/", MigrationDomainControlListCreateView.as_view(), name="migration-domain-list"),
    path("domains/<uuid:control_id>/", MigrationDomainControlDetailView.as_view(), name="migration-domain-detail"),
    path("jobs/", MigrationJobRunListCreateView.as_view(), name="migration-job-list"),
    path("jobs/<uuid:job_id>/", MigrationJobRunDetailView.as_view(), name="migration-job-detail"),
    path("bridge-receipts/", MigrationBridgeReceiptListView.as_view(), name="migration-bridge-receipt-list"),
    path("activity/", MigrationControlEventListView.as_view(), name="migration-control-event-list"),
    path("shadow-summaries/", MigrationShadowSummaryListView.as_view(), name="migration-shadow-summary-list"),
    path("pilot-readiness/", MigrationPilotReadinessListView.as_view(), name="migration-pilot-readiness-list"),
    path("pilot-signoff/", MigrationPilotSignoffListView.as_view(), name="migration-pilot-signoff-list"),
    path("pilot-shop-scorecards/", MigrationPilotShopScorecardListView.as_view(), name="migration-pilot-shop-scorecard-list"),
    path("domains/<uuid:control_id>/prepare-pilot/", MigrationPilotPrepareView.as_view(), name="migration-prepare-pilot"),
    path("domains/<uuid:control_id>/promote-ready/", MigrationPilotPromoteReadyView.as_view(), name="migration-promote-ready"),
    path("domains/<uuid:control_id>/promote-primary/", MigrationPilotPromotePrimaryView.as_view(), name="migration-promote-primary"),
    path("domains/<uuid:control_id>/verify-pilot/", MigrationPilotVerifyView.as_view(), name="migration-verify-pilot"),
    path("domains/<uuid:control_id>/rollback/", MigrationPilotRollbackView.as_view(), name="migration-rollback"),
]
