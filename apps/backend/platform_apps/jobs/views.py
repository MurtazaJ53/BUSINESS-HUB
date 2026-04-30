from __future__ import annotations

from rest_framework import generics

from platform_apps.common.migration import MigrationJobStatus
from platform_apps.common.permissions import IsPlatformAdminUser
from platform_apps.jobs.models import MigrationDomainControl, MigrationJobRun
from platform_apps.jobs.serializers import MigrationDomainControlSerializer, MigrationJobRunSerializer
from platform_apps.jobs.services import execute_migration_job


class MigrationDomainControlListCreateView(generics.ListCreateAPIView):
    serializer_class = MigrationDomainControlSerializer
    permission_classes = [IsPlatformAdminUser]
    pagination_class = None

    def get_queryset(self):
        queryset = MigrationDomainControl.objects.select_related("shop").order_by("shop__name", "domain")
        domain = self.request.query_params.get("domain", "").strip()
        shop_id = self.request.query_params.get("shop_id", "").strip()
        write_master = self.request.query_params.get("write_master", "").strip()
        bridge_mode = self.request.query_params.get("bridge_mode", "").strip()

        if domain:
            queryset = queryset.filter(domain=domain)
        if shop_id:
            queryset = queryset.filter(shop_id=shop_id)
        if write_master:
            queryset = queryset.filter(write_master=write_master)
        if bridge_mode:
            queryset = queryset.filter(bridge_mode=bridge_mode)
        return queryset


class MigrationDomainControlDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = MigrationDomainControlSerializer
    permission_classes = [IsPlatformAdminUser]
    lookup_url_kwarg = "control_id"

    def get_queryset(self):
        return MigrationDomainControl.objects.select_related("shop")


class MigrationJobRunListCreateView(generics.ListCreateAPIView):
    serializer_class = MigrationJobRunSerializer
    permission_classes = [IsPlatformAdminUser]
    pagination_class = None

    def get_queryset(self):
        queryset = MigrationJobRun.objects.select_related("shop", "actor_user")
        domain = self.request.query_params.get("domain", "").strip()
        shop_id = self.request.query_params.get("shop_id", "").strip()
        job_type = self.request.query_params.get("job_type", "").strip()
        status = self.request.query_params.get("status", "").strip()

        if domain:
            queryset = queryset.filter(domain=domain)
        if shop_id:
            queryset = queryset.filter(shop_id=shop_id)
        if job_type:
            queryset = queryset.filter(job_type=job_type)
        if status:
            queryset = queryset.filter(status=status)
        return queryset

    def perform_create(self, serializer):
        job_run = serializer.save(actor_user=self.request.user, status=MigrationJobStatus.QUEUED)
        if self.request.query_params.get("run_inline", "").strip().lower() in {"1", "true", "yes"}:
            serializer.instance = execute_migration_job(str(job_run.id))


class MigrationJobRunDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = MigrationJobRunSerializer
    permission_classes = [IsPlatformAdminUser]
    lookup_url_kwarg = "job_id"

    def get_queryset(self):
        return MigrationJobRun.objects.select_related("shop", "actor_user")
