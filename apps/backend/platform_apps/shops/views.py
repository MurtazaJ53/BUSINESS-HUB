from __future__ import annotations

from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from platform_apps.common.migration import (
    MigrationBridgeMode,
    MigrationCutoverStatus,
    MigrationDomain,
    MigrationWriteMaster,
)
from platform_apps.jobs.readiness import build_pilot_signoff
from platform_apps.jobs.models import MigrationDomainControl
from platform_apps.shops.models import ShopMembership
from platform_apps.shops.permissions import get_membership_or_403
from platform_apps.shops.serializers import ShopDomainStateSerializer, ShopMembershipListSerializer


class ShopMembershipListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ShopMembershipListSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            ShopMembership.objects.select_related("shop")
            .filter(user=self.request.user)
            .order_by("shop__name")
        )


class ShopDomainStateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, shop_id, domain):
        membership = get_membership_or_403(request.user, shop_id, ShopMembership.Role.VIEWER)

        if domain not in MigrationDomain.values:
            raise exceptions.NotFound("Unknown migration domain.")

        control = (
            MigrationDomainControl.objects.filter(
                shop=membership.shop,
                domain=domain,
                is_enabled=True,
            )
            .select_related("shop")
            .first()
        )

        if control is None:
            payload = {
                "shop_id": membership.shop_id,
                "domain": domain,
                "control_present": False,
                "write_master": MigrationWriteMaster.FIREBASE,
                "bridge_mode": MigrationBridgeMode.DISABLED,
                "cutover_status": MigrationCutoverStatus.LEGACY,
                "current_epoch": 1,
                "shadow_reads_enabled": False,
                "is_enabled": True,
                "can_write_on_postgres_surface": False,
                "pilot_signoff_status": None,
                "pilot_signoff_summary": None,
                "pilot_recommended_action": None,
                "pilot_latest_verify_result": None,
            }
        else:
            signoff = build_pilot_signoff(control)
            payload = {
                "shop_id": membership.shop_id,
                "domain": control.domain,
                "control_present": True,
                "write_master": control.write_master,
                "bridge_mode": control.bridge_mode,
                "cutover_status": control.cutover_status,
                "current_epoch": control.current_epoch,
                "shadow_reads_enabled": control.shadow_reads_enabled,
                "is_enabled": control.is_enabled,
                "can_write_on_postgres_surface": (
                    control.write_master == MigrationWriteMaster.POSTGRES
                    and control.cutover_status == MigrationCutoverStatus.POSTGRES_PRIMARY
                ),
                "pilot_signoff_status": signoff["signoff_status"],
                "pilot_signoff_summary": signoff["summary"],
                "pilot_recommended_action": signoff["recommended_action"],
                "pilot_latest_verify_result": signoff["latest_verify_result"],
            }

        serializer = ShopDomainStateSerializer(payload)
        return Response(serializer.data)
