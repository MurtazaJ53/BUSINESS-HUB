from __future__ import annotations

from django.db.models import Q
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_apps.erpnext.models import ERPNextDocumentLink, ERPNextShopBinding, ERPNextSyncCursor
from platform_apps.erpnext.serializers import (
    ERPNextDocumentLinkSerializer,
    ERPNextShopBindingSerializer,
    ERPNextSyncCursorSerializer,
)
from platform_apps.erpnext.services import ERPNextIntegrationService
from platform_apps.shops.models import ShopMembership
from platform_apps.shops.permissions import get_membership_or_403


class ShopScopedMixin:
    minimum_role = ShopMembership.Role.VIEWER

    def get_membership(self):
        if not hasattr(self, "_membership_cache"):
            self._membership_cache = get_membership_or_403(
                self.request.user,
                self.kwargs["shop_id"],
                self.minimum_role,
            )
        return self._membership_cache


class ERPNextMetaView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        payload = ERPNextIntegrationService.environment_meta()
        payload["recommendation"] = (
            "Configure a shop binding and verify the connection before starting item/customer sync."
        )
        return Response(payload)


class ERPNextHealthCheckView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        payload = ERPNextIntegrationService().health_check()
        return Response(payload)


class ERPNextShopBindingDetailView(ShopScopedMixin, generics.RetrieveUpdateAPIView):
    serializer_class = ERPNextShopBindingSerializer
    permission_classes = [permissions.IsAuthenticated]
    minimum_role = ShopMembership.Role.ADMIN

    def get_object(self):
        membership = self.get_membership()
        binding, _ = ERPNextShopBinding.objects.get_or_create(shop=membership.shop)
        return binding


class ERPNextShopVerifyConnectionView(ShopScopedMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]
    minimum_role = ShopMembership.Role.ADMIN

    def post(self, request, *args, **kwargs):
        membership = self.get_membership()
        binding, _ = ERPNextShopBinding.objects.get_or_create(shop=membership.shop)
        service = ERPNextIntegrationService()
        payload = service.health_check(binding=binding)
        service.apply_health_payload(binding=binding, payload=payload)
        service.ensure_default_cursors(shop=membership.shop)
        return Response(
            {
                "binding": ERPNextShopBindingSerializer(binding).data,
                "health": payload,
            }
        )


class ERPNextShopSyncStateView(ShopScopedMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]
    minimum_role = ShopMembership.Role.ADMIN

    def get(self, request, *args, **kwargs):
        membership = self.get_membership()
        service = ERPNextIntegrationService()
        cursors = service.ensure_default_cursors(shop=membership.shop)
        binding = ERPNextShopBinding.objects.filter(shop=membership.shop).first()
        links = ERPNextDocumentLink.objects.filter(shop=membership.shop)

        return Response(
            {
                "binding": ERPNextShopBindingSerializer(binding).data if binding else None,
                "cursors": ERPNextSyncCursorSerializer(cursors, many=True).data,
                "document_link_counts": {
                    "total": links.count(),
                    "linked": links.filter(sync_status=ERPNextDocumentLink.SyncStatus.LINKED).count(),
                    "pending": links.filter(sync_status=ERPNextDocumentLink.SyncStatus.PENDING).count(),
                    "failed": links.filter(sync_status=ERPNextDocumentLink.SyncStatus.FAILED).count(),
                },
            }
        )


class ERPNextShopPocSummaryView(ShopScopedMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]
    minimum_role = ShopMembership.Role.ADMIN

    def get(self, request, *args, **kwargs):
        membership = self.get_membership()
        payload = ERPNextIntegrationService().build_poc_summary(shop=membership.shop)
        return Response(payload)


class ERPNextDocumentLinkListView(ShopScopedMixin, generics.ListAPIView):
    serializer_class = ERPNextDocumentLinkSerializer
    permission_classes = [permissions.IsAuthenticated]
    minimum_role = ShopMembership.Role.ADMIN
    pagination_class = None

    def get_queryset(self):
        membership = self.get_membership()
        queryset = ERPNextDocumentLink.objects.filter(shop=membership.shop)
        sync_status = self.request.query_params.get("sync_status", "").strip()
        local_domain = self.request.query_params.get("local_domain", "").strip()
        query = self.request.query_params.get("q", "").strip()

        if sync_status:
            queryset = queryset.filter(sync_status=sync_status)
        if local_domain:
            queryset = queryset.filter(local_domain=local_domain)
        if query:
            queryset = queryset.filter(
                Q(local_object_id__icontains=query)
                | Q(remote_doctype__icontains=query)
                | Q(remote_name__icontains=query)
            )
        return queryset

