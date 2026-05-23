from __future__ import annotations

from django.db import models
from rest_framework import generics, permissions

from platform_apps.audit.models import MigrationReconciliationEvent, WorkspaceAuditEvent
from platform_apps.audit.serializers import (
    MigrationReconciliationEventSerializer,
    WorkspaceAuditEventSerializer,
)
from platform_apps.common.permissions import IsPlatformAdminUser
from platform_apps.shops.models import ShopMembership
from platform_apps.shops.permissions import get_membership_or_403


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


class WorkspaceAuditEventListView(generics.ListAPIView):
    serializer_class = WorkspaceAuditEventSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_membership(self):
        if not hasattr(self, "_membership_cache"):
            self._membership_cache = get_membership_or_403(
                self.request.user,
                self.kwargs["shop_id"],
                ShopMembership.Role.ADMIN,
            )
        return self._membership_cache

    def get_queryset(self):
        membership = self.get_membership()
        queryset = WorkspaceAuditEvent.objects.filter(shop=membership.shop).select_related("shop", "actor_user")
        category = self.request.query_params.get("category", "").strip()
        event_type = self.request.query_params.get("event_type", "").strip()
        actor_role = self.request.query_params.get("actor_role", "").strip()
        q = self.request.query_params.get("q", "").strip()

        if category:
            queryset = queryset.filter(category=category)
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        if actor_role:
            queryset = queryset.filter(actor_role=actor_role)
        if q:
            queryset = queryset.filter(
                models.Q(summary__icontains=q)
                | models.Q(entity_label__icontains=q)
                | models.Q(entity_id__icontains=q)
                | models.Q(actor_user__email__icontains=q)
            )
        return queryset
