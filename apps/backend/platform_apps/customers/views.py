from __future__ import annotations

from django.db.models import Q
from rest_framework import exceptions, generics, permissions

from platform_apps.customers.models import Customer, CustomerLedgerEntry
from platform_apps.customers.serializers import CustomerLedgerEntrySerializer, CustomerSerializer
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


class CustomerListCreateView(ShopScopedMixin, generics.ListCreateAPIView):
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        membership = self.get_membership()
        queryset = Customer.objects.filter(shop=membership.shop, tombstone=False).order_by("-balance", "name")

        query = self.request.query_params.get("q", "").strip()
        status_value = self.request.query_params.get("status", "").strip()

        if query:
            queryset = queryset.filter(
                Q(name__icontains=query) | Q(phone__icontains=query) | Q(email__icontains=query)
            )
        if status_value:
            queryset = queryset.filter(status=status_value)
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


class CustomerDetailView(ShopScopedMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = "customer_id"

    def get_queryset(self):
        membership = self.get_membership()
        return Customer.objects.filter(shop=membership.shop)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update(
            {
                "shop": self.get_membership().shop,
                "actor": self.request.user,
            }
        )
        return context

    def perform_update(self, serializer):
        get_membership_or_403(self.request.user, self.kwargs["shop_id"], ShopMembership.Role.STAFF)
        serializer.save()

    def perform_destroy(self, instance):
        get_membership_or_403(self.request.user, self.kwargs["shop_id"], ShopMembership.Role.ADMIN)
        instance.tombstone = True
        instance.status = Customer.Status.ARCHIVED
        instance.save(update_fields=["tombstone", "status", "updated_at"])


class CustomerLedgerListCreateView(ShopScopedMixin, generics.ListCreateAPIView):
    serializer_class = CustomerLedgerEntrySerializer
    permission_classes = [permissions.IsAuthenticated]
    minimum_role = ShopMembership.Role.VIEWER
    pagination_class = None

    def get_customer(self):
        if not hasattr(self, "_customer_cache"):
            membership = self.get_membership()
            customer = Customer.objects.filter(
                shop=membership.shop,
                pk=self.kwargs["customer_id"],
                tombstone=False,
            ).first()
            if customer is None:
                raise exceptions.NotFound("Customer not found.")
            self._customer_cache = customer
        return self._customer_cache

    def get_queryset(self):
        return CustomerLedgerEntry.objects.filter(customer=self.get_customer()).select_related("actor_user")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update(
            {
                "shop": self.get_membership().shop,
                "customer": self.get_customer(),
                "actor": self.request.user,
            }
        )
        return context

    def perform_create(self, serializer):
        get_membership_or_403(self.request.user, self.kwargs["shop_id"], ShopMembership.Role.STAFF)
        serializer.save()
