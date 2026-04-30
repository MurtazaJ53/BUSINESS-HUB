from __future__ import annotations

from rest_framework import generics

from platform_apps.audit.models import MigrationReconciliationEvent
from platform_apps.audit.serializers import MigrationReconciliationEventSerializer
from platform_apps.common.permissions import IsPlatformAdminUser


class MigrationReconciliationEventListCreateView(generics.ListCreateAPIView):
    serializer_class = MigrationReconciliationEventSerializer
    permission_classes = [IsPlatformAdminUser]
    pagination_class = None

    def get_queryset(self):
        queryset = MigrationReconciliationEvent.objects.select_related("shop", "resolver_user")
        domain = self.request.query_params.get("domain", "").strip()
        shop_id = self.request.query_params.get("shop_id", "").strip()
        status = self.request.query_params.get("status", "").strip()
        severity = self.request.query_params.get("severity", "").strip()
        issue_code = self.request.query_params.get("issue_code", "").strip()

        if domain:
            queryset = queryset.filter(domain=domain)
        if shop_id:
            queryset = queryset.filter(shop_id=shop_id)
        if status:
            queryset = queryset.filter(status=status)
        if severity:
            queryset = queryset.filter(severity=severity)
        if issue_code:
            queryset = queryset.filter(issue_code=issue_code)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["resolver_user"] = self.request.user
        return context


class MigrationReconciliationEventDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = MigrationReconciliationEventSerializer
    permission_classes = [IsPlatformAdminUser]
    lookup_url_kwarg = "event_id"

    def get_queryset(self):
        return MigrationReconciliationEvent.objects.select_related("shop", "resolver_user")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["resolver_user"] = self.request.user
        return context
