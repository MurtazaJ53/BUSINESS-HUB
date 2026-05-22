from __future__ import annotations

from django.db import transaction
from django.db.models import Q
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import exceptions, generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_apps.common.migration import MigrationDomain
from platform_apps.common.migration_guards import assert_postgres_primary_write_enabled
from platform_apps.inventory.models import InventoryItem, InventoryStockLedger
from platform_apps.inventory.serializers import InventoryAdjustmentSerializer, InventoryItemSerializer
from platform_apps.shops.models import ShopMembership
from platform_apps.shops.permissions import (
    ROLE_ORDER,
    get_membership_or_403,
    has_feature_enabled,
)


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

    def can_view_costs(self) -> bool:
        return ROLE_ORDER[self.get_membership().role] >= ROLE_ORDER[ShopMembership.Role.ADMIN]

    def can_view_supplier_directory(self) -> bool:
        membership = self.get_membership()
        return (
            ROLE_ORDER[membership.role] >= ROLE_ORDER[ShopMembership.Role.ADMIN]
            and has_feature_enabled(membership, "supplier_directory")
        )

    def can_view_purchase_workflow(self) -> bool:
        membership = self.get_membership()
        return (
            ROLE_ORDER[membership.role] >= ROLE_ORDER[ShopMembership.Role.ADMIN]
            and has_feature_enabled(membership, "purchase_workflow")
        )

    def assert_inventory_postgres_write_enabled(self) -> None:
        assert_postgres_primary_write_enabled(
            shop_id=self.kwargs["shop_id"],
            domain=MigrationDomain.INVENTORY,
        )


class InventoryItemListCreateView(ShopScopedMixin, generics.ListCreateAPIView):
    serializer_class = InventoryItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        membership = self.get_membership()
        queryset = (
            InventoryItem.objects.filter(shop=membership.shop, tombstone=False)
            .select_related("private")
            .annotate(stock_on_hand=Coalesce(Sum("ledger_entries__quantity_delta"), 0))
            .order_by("name", "created_at")
        )
        query = self.request.query_params.get("q", "").strip()
        category = self.request.query_params.get("category", "").strip()
        status_value = self.request.query_params.get("status", "").strip()

        if query:
            queryset = queryset.filter(
                Q(name__icontains=query) | Q(sku__icontains=query) | Q(barcode__icontains=query)
            )
        if category:
            queryset = queryset.filter(category__iexact=category)
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update(
            {
                "shop": self.get_membership().shop,
                "actor": self.request.user,
                "can_view_costs": self.can_view_costs(),
                "can_view_supplier_directory": self.can_view_supplier_directory(),
                "can_view_purchase_workflow": self.can_view_purchase_workflow(),
            }
        )
        return context

    def perform_create(self, serializer):
        get_membership_or_403(self.request.user, self.kwargs["shop_id"], ShopMembership.Role.STAFF)
        self.assert_inventory_postgres_write_enabled()
        serializer.save()


class InventoryItemDetailView(ShopScopedMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = InventoryItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = "item_id"

    def get_queryset(self):
        membership = self.get_membership()
        return (
            InventoryItem.objects.filter(shop=membership.shop)
            .select_related("private")
            .annotate(stock_on_hand=Coalesce(Sum("ledger_entries__quantity_delta"), 0))
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update(
            {
                "shop": self.get_membership().shop,
                "actor": self.request.user,
                "can_view_costs": self.can_view_costs(),
                "can_view_supplier_directory": self.can_view_supplier_directory(),
                "can_view_purchase_workflow": self.can_view_purchase_workflow(),
            }
        )
        return context

    def perform_update(self, serializer):
        get_membership_or_403(self.request.user, self.kwargs["shop_id"], ShopMembership.Role.STAFF)
        self.assert_inventory_postgres_write_enabled()
        serializer.save()

    @transaction.atomic
    def perform_destroy(self, instance):
        get_membership_or_403(self.request.user, self.kwargs["shop_id"], ShopMembership.Role.ADMIN)
        self.assert_inventory_postgres_write_enabled()
        instance.tombstone = True
        instance.status = InventoryItem.Status.ARCHIVED
        instance.save(update_fields=["tombstone", "status", "updated_at"])


class InventoryItemAdjustmentView(ShopScopedMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]
    minimum_role = ShopMembership.Role.STAFF

    def post(self, request, shop_id, item_id):
        membership = self.get_membership()
        self.assert_inventory_postgres_write_enabled()
        item = InventoryItem.objects.filter(shop=membership.shop, pk=item_id, tombstone=False).first()
        if item is None:
            raise exceptions.NotFound("Inventory item not found.")

        serializer = InventoryAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        ledger = InventoryStockLedger.objects.create(
            shop=membership.shop,
            item=item,
            actor_user=request.user,
            event_type=payload["event_type"],
            quantity_delta=payload["quantity_delta"],
            unit_price=item.sell_price,
            note=payload.get("note", ""),
            occurred_at=timezone.now(),
        )

        current_stock = (
            item.ledger_entries.aggregate(total=Coalesce(Sum("quantity_delta"), 0))["total"]
        )
        return Response(
            {
                "item_id": str(item.id),
                "ledger_event_id": str(ledger.id),
                "stock_on_hand": current_stock,
            },
            status=status.HTTP_201_CREATED,
        )
