from __future__ import annotations

from django.db.models import Q
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_apps.erpnext.models import (
    ERPNextDocumentLink,
    ERPNextPurchaseMirror,
    ERPNextShopBinding,
    ERPNextSupplierMirror,
    ERPNextSyncCursor,
)
from platform_apps.erpnext.serializers import (
    ERPNextActionSerializer,
    ERPNextCycleSerializer,
    ERPNextDocumentLinkSerializer,
    ERPNextPurchaseMirrorSerializer,
    ERPNextShopBindingSerializer,
    ERPNextSupplierMirrorSerializer,
    ERPNextSyncCursorSerializer,
)
from platform_apps.erpnext.services import ERPNextConfigurationError, ERPNextIntegrationService
from platform_apps.erpnext.tasks import run_erpnext_cycle_task
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


class ERPNextShopActionView(ShopScopedMixin, generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    minimum_role = ShopMembership.Role.ADMIN
    serializer_class = ERPNextActionSerializer

    action_name = ""

    def get_limit(self, request):
        serializer = self.get_serializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data["limit"]

    def action_response(self, request, *args, **kwargs):  # pragma: no cover - overridden
        raise NotImplementedError

    def post(self, request, *args, **kwargs):
        try:
            return self.action_response(request, *args, **kwargs)
        except ERPNextConfigurationError as exc:
            return Response(
                {"action": self.action_name, "status": "blocked", "detail": str(exc)},
                status=409,
            )


class ERPNextItemSyncView(ERPNextShopActionView):
    action_name = "sync_items"

    def action_response(self, request, *args, **kwargs):
        membership = self.get_membership()
        payload = ERPNextIntegrationService().sync_items(
            shop=membership.shop,
            limit=self.get_limit(request),
        )
        return Response({"action": self.action_name, "status": "ok", **payload})


class ERPNextCustomerSyncView(ERPNextShopActionView):
    action_name = "sync_customers"

    def action_response(self, request, *args, **kwargs):
        membership = self.get_membership()
        payload = ERPNextIntegrationService().sync_customers(
            shop=membership.shop,
            limit=self.get_limit(request),
        )
        return Response({"action": self.action_name, "status": "ok", **payload})


class ERPNextStockSyncView(ERPNextShopActionView):
    action_name = "sync_stock"

    def action_response(self, request, *args, **kwargs):
        membership = self.get_membership()
        payload = ERPNextIntegrationService().sync_stock(
            shop=membership.shop,
            limit=self.get_limit(request),
        )
        return Response({"action": self.action_name, "status": "ok", **payload})


class ERPNextSupplierSyncView(ERPNextShopActionView):
    action_name = "sync_suppliers"

    def action_response(self, request, *args, **kwargs):
        membership = self.get_membership()
        payload = ERPNextIntegrationService().sync_suppliers(
            shop=membership.shop,
            limit=self.get_limit(request),
        )
        return Response({"action": self.action_name, "status": "ok", **payload})


class ERPNextPurchaseSyncView(ERPNextShopActionView):
    action_name = "sync_purchases"

    def action_response(self, request, *args, **kwargs):
        membership = self.get_membership()
        payload = ERPNextIntegrationService().sync_purchases(
            shop=membership.shop,
            limit=self.get_limit(request),
        )
        return Response({"action": self.action_name, "status": "ok", **payload})


class ERPNextSalesPushView(ERPNextShopActionView):
    action_name = "push_sales"

    def action_response(self, request, *args, **kwargs):
        membership = self.get_membership()
        payload = ERPNextIntegrationService().push_sales(
            shop=membership.shop,
            limit=self.get_limit(request),
        )
        return Response({"action": self.action_name, "status": "ok", **payload})


class ERPNextPaymentsPushView(ERPNextShopActionView):
    action_name = "push_payments"

    def action_response(self, request, *args, **kwargs):
        membership = self.get_membership()
        payload = ERPNextIntegrationService().push_payments(
            shop=membership.shop,
            limit=self.get_limit(request),
        )
        return Response({"action": self.action_name, "status": "ok", **payload})


class ERPNextRunCycleView(ShopScopedMixin, generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    minimum_role = ShopMembership.Role.ADMIN
    serializer_class = ERPNextCycleSerializer

    def post(self, request, *args, **kwargs):
        membership = self.get_membership()
        serializer = self.get_serializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        try:
            payload = ERPNextIntegrationService().run_cycle(
                shop=membership.shop,
                **serializer.validated_data,
            )
        except ERPNextConfigurationError as exc:
            return Response({"overall_status": "blocked", "detail": str(exc)}, status=409)
        return Response(payload)


class ERPNextEnqueueCycleView(ShopScopedMixin, generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    minimum_role = ShopMembership.Role.ADMIN
    serializer_class = ERPNextCycleSerializer

    def post(self, request, *args, **kwargs):
        membership = self.get_membership()
        serializer = self.get_serializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        task = run_erpnext_cycle_task.delay(shop_id=str(membership.shop.id), **payload)
        return Response(
            {
                "shop_id": str(membership.shop.id),
                "task_id": task.id,
                "queue": "erpnext-sync",
                "status": "queued",
                "payload": payload,
            },
            status=202,
        )


class ERPNextSupplierMirrorListView(ShopScopedMixin, generics.ListAPIView):
    serializer_class = ERPNextSupplierMirrorSerializer
    permission_classes = [permissions.IsAuthenticated]
    minimum_role = ShopMembership.Role.ADMIN
    pagination_class = None

    def get_queryset(self):
        membership = self.get_membership()
        queryset = ERPNextSupplierMirror.objects.filter(shop=membership.shop)
        status_value = self.request.query_params.get("status", "").strip()
        query = self.request.query_params.get("q", "").strip()
        if status_value:
            queryset = queryset.filter(status=status_value)
        if query:
            queryset = queryset.filter(
                Q(remote_name__icontains=query)
                | Q(supplier_name__icontains=query)
                | Q(phone__icontains=query)
                | Q(email__icontains=query)
            )
        return queryset


class ERPNextPurchaseMirrorListView(ShopScopedMixin, generics.ListAPIView):
    serializer_class = ERPNextPurchaseMirrorSerializer
    permission_classes = [permissions.IsAuthenticated]
    minimum_role = ShopMembership.Role.ADMIN
    pagination_class = None

    def get_queryset(self):
        membership = self.get_membership()
        queryset = ERPNextPurchaseMirror.objects.select_related("supplier").filter(shop=membership.shop)
        remote_doctype = self.request.query_params.get("remote_doctype", "").strip()
        status_value = self.request.query_params.get("status", "").strip()
        query = self.request.query_params.get("q", "").strip()
        if remote_doctype:
            queryset = queryset.filter(remote_doctype=remote_doctype)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if query:
            queryset = queryset.filter(
                Q(remote_name__icontains=query)
                | Q(supplier_remote_name__icontains=query)
                | Q(warehouse__icontains=query)
            )
        return queryset
