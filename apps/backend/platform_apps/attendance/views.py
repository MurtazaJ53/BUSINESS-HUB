from __future__ import annotations

from django.db.models import Q
from rest_framework import generics, permissions

from platform_apps.attendance.models import AttendanceSession
from platform_apps.attendance.serializers import AttendanceSessionSerializer, AttendanceSessionWriteSerializer
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

    def get_membership_map(self):
        if not hasattr(self, "_membership_map_cache"):
            memberships = ShopMembership.objects.select_related("user").filter(
                shop=self.get_membership().shop,
                status=ShopMembership.Status.ACTIVE,
            )
            self._membership_map_cache = {str(membership.id): membership for membership in memberships}
        return self._membership_map_cache


class AttendanceSessionListCreateView(ShopScopedMixin, generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        membership = self.get_membership()
        queryset = AttendanceSession.objects.filter(shop=membership.shop, tombstone=False).select_related(
            "membership",
            "membership__user",
        )

        date_from = self.request.query_params.get("date_from", "").strip()
        date_to = self.request.query_params.get("date_to", "").strip()
        membership_id = self.request.query_params.get("membership_id", "").strip()
        status_value = self.request.query_params.get("status", "").strip()
        query = self.request.query_params.get("q", "").strip()

        if date_from:
            queryset = queryset.filter(session_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(session_date__lte=date_to)
        if membership_id:
            queryset = queryset.filter(membership_id=membership_id)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if query:
            queryset = queryset.filter(
                Q(membership__user__full_name__icontains=query) | Q(membership__user__email__icontains=query)
            )
        return queryset

    def get_serializer_class(self):
        if self.request.method == "GET":
            return AttendanceSessionSerializer
        return AttendanceSessionWriteSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update(
            {
                "shop": self.get_membership().shop,
                "membership_map": self.get_membership_map(),
            }
        )
        return context

    def perform_create(self, serializer):
        get_membership_or_403(self.request.user, self.kwargs["shop_id"], ShopMembership.Role.ADMIN)
        serializer.save()


class AttendanceSessionDetailView(ShopScopedMixin, generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = "attendance_id"
    minimum_role = ShopMembership.Role.ADMIN
    serializer_class = AttendanceSessionWriteSerializer

    def get_queryset(self):
        membership = self.get_membership()
        return AttendanceSession.objects.filter(shop=membership.shop, tombstone=False).select_related(
            "membership",
            "membership__user",
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update(
            {
                "shop": self.get_membership().shop,
                "membership_map": self.get_membership_map(),
            }
        )
        return context

    def perform_destroy(self, instance):
        instance.tombstone = True
        instance.save(update_fields=["tombstone", "updated_at"])
