from django.urls import path

from platform_apps.jobs.views import (
    MigrationDomainControlDetailView,
    MigrationDomainControlListCreateView,
    MigrationJobRunDetailView,
    MigrationJobRunListCreateView,
)

urlpatterns = [
    path("domains/", MigrationDomainControlListCreateView.as_view(), name="migration-domain-list"),
    path("domains/<uuid:control_id>/", MigrationDomainControlDetailView.as_view(), name="migration-domain-detail"),
    path("jobs/", MigrationJobRunListCreateView.as_view(), name="migration-job-list"),
    path("jobs/<uuid:job_id>/", MigrationJobRunDetailView.as_view(), name="migration-job-detail"),
]
