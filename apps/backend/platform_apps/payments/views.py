from __future__ import annotations

from rest_framework import generics, permissions

from platform_apps.payments.models import SalePayment
from platform_apps.payments.serializers import SalePaymentSerializer
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


class SalePaymentListView(ShopScopedMixin, generics.ListAPIView):
    serializer_class = SalePaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        membership = self.get_membership()
        queryset = SalePayment.objects.filter(
            shop=membership.shop,
            sale__tombstone=False,
        ).select_related("sale", "actor_user")

        sale_id = self.request.query_params.get("sale_id", "").strip()
        payment_method = self.request.query_params.get("payment_method", "").strip()
        date_from = self.request.query_params.get("date_from", "").strip()
        date_to = self.request.query_params.get("date_to", "").strip()

        if sale_id:
            queryset = queryset.filter(sale_id=sale_id)
        if payment_method:
            queryset = queryset.filter(payment_method=payment_method)
        if date_from:
            queryset = queryset.filter(sale__sale_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(sale__sale_date__lte=date_to)
        return queryset
