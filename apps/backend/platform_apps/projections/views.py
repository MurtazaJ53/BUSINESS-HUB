from __future__ import annotations

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_apps.projections.models import ShopDashboardSnapshot
from platform_apps.projections.serializers import ShopDashboardSnapshotSerializer
from platform_apps.projections.services import refresh_shop_dashboard_projection
from platform_apps.shops.models import ShopMembership
from platform_apps.shops.permissions import get_membership_or_403


class ShopDashboardSnapshotView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, shop_id):
        membership = get_membership_or_403(request.user, shop_id, ShopMembership.Role.VIEWER)
        refresh_requested = request.query_params.get("refresh", "").strip().lower() in {"1", "true", "yes"}

        snapshot = (
            refresh_shop_dashboard_projection(membership.shop)
            if refresh_requested
            else ShopDashboardSnapshot.objects.filter(shop=membership.shop)
            .select_related("shop")
            .prefetch_related("low_stock_preview")
            .first()
        )
        if snapshot is None:
            snapshot = refresh_shop_dashboard_projection(membership.shop)

        serializer = ShopDashboardSnapshotSerializer(snapshot)
        return Response(serializer.data)
