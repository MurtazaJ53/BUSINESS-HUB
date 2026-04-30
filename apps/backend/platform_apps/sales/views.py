from __future__ import annotations

from django.db.models import Q
from django.db.models import Prefetch
from rest_framework import generics, permissions

from platform_apps.payments.models import SalePayment
from platform_apps.sales.models import Sale, SaleItem
from platform_apps.sales.serializers import SaleSerializer
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


class SaleListCreateView(ShopScopedMixin, generics.ListCreateAPIView):
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        membership = self.get_membership()
        queryset = (
            Sale.objects.filter(shop=membership.shop, tombstone=False)
            .select_related("actor_user", "customer")
            .prefetch_related(
                Prefetch("items", queryset=SaleItem.objects.select_related("inventory_item").order_by("created_at")),
                Prefetch("payments", queryset=SalePayment.objects.order_by("created_at")),
            )
        )

        query = self.request.query_params.get("q", "").strip()
        date_from = self.request.query_params.get("date_from", "").strip()
        date_to = self.request.query_params.get("date_to", "").strip()
        payment_mode = self.request.query_params.get("payment_mode", "").strip()
        status_value = self.request.query_params.get("status", "").strip()
        customer_id = self.request.query_params.get("customer_id", "").strip()

        if query:
            queryset = queryset.filter(
                Q(receipt_number__icontains=query)
                | Q(customer_name_snapshot__icontains=query)
                | Q(customer_phone_snapshot__icontains=query)
            )
        if date_from:
            queryset = queryset.filter(sale_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(sale_date__lte=date_to)
        if payment_mode:
            queryset = queryset.filter(payment_mode=payment_mode)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update(
            {
                "shop": self.get_membership().shop,
                "actor": self.request.user,
            }
        )
        return context

    def perform_create(self, serializer):
        get_membership_or_403(self.request.user, self.kwargs["shop_id"], ShopMembership.Role.STAFF)
        serializer.save()


class SaleDetailView(ShopScopedMixin, generics.RetrieveAPIView):
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = "sale_id"

    def get_queryset(self):
        membership = self.get_membership()
        return (
            Sale.objects.filter(shop=membership.shop, tombstone=False)
            .select_related("actor_user", "customer")
            .prefetch_related(
                Prefetch("items", queryset=SaleItem.objects.select_related("inventory_item").order_by("created_at")),
                Prefetch("payments", queryset=SalePayment.objects.order_by("created_at")),
            )
        )
