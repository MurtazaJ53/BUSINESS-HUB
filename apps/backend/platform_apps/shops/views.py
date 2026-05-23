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
from platform_apps.shops.models import ShopMembership, ShopPlanRequest
from platform_apps.shops.permissions import get_membership_or_403
from platform_apps.shops.serializers import (
    ShopDomainStateSerializer,
    ShopMembershipListSerializer,
    ShopPlanRequestCreateSerializer,
    ShopPlanRequestSerializer,
    WorkspaceOwnershipTransferResultSerializer,
    WorkspaceOwnershipTransferSerializer,
    WorkspaceTeamMemberCreateSerializer,
    WorkspaceTeamMemberSerializer,
    WorkspaceTeamMemberUpdateSerializer,
)


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


class ShopPlanRequestListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get_membership(self, shop_id):
        return get_membership_or_403(self.request.user, shop_id, ShopMembership.Role.ADMIN)

    def get(self, request, shop_id):
        membership = self.get_membership(shop_id)
        queryset = (
            ShopPlanRequest.objects.filter(shop=membership.shop)
            .select_related("requested_by_user")
            .order_by("-created_at")
        )
        serializer = ShopPlanRequestSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request, shop_id):
        membership = self.get_membership(shop_id)
        serializer = ShopPlanRequestCreateSerializer(
            data=request.data,
            context={"membership": membership},
        )
        serializer.is_valid(raise_exception=True)

        requested_plan_tier = serializer.validated_data["requested_plan_tier"]
        existing = (
            ShopPlanRequest.objects.filter(
                shop=membership.shop,
                requested_by_user=request.user,
                requested_plan_tier=requested_plan_tier,
                status__in=[ShopPlanRequest.Status.OPEN, ShopPlanRequest.Status.IN_REVIEW],
            )
            .select_related("requested_by_user")
            .order_by("-created_at")
            .first()
        )
        if existing is not None:
            response_serializer = ShopPlanRequestSerializer(existing)
            return Response(response_serializer.data)

        plan_request = ShopPlanRequest.objects.create(
            shop=membership.shop,
            requested_by_user=request.user,
            current_plan_tier=membership.shop.plan_tier,
            requested_plan_tier=requested_plan_tier,
            request_note=serializer.validated_data.get("request_note", ""),
            context_json=serializer.validated_data.get("context_json", {}),
        )
        response_serializer = ShopPlanRequestSerializer(plan_request)
        return Response(response_serializer.data, status=201)


class WorkspaceTeamListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get_membership(self, shop_id):
        return get_membership_or_403(self.request.user, shop_id, ShopMembership.Role.ADMIN)

    def get(self, request, shop_id):
        actor_membership = self.get_membership(shop_id)
        queryset = (
            ShopMembership.objects.filter(shop=actor_membership.shop)
            .select_related("user", "shop")
            .order_by("role", "status", "user__full_name", "user__email")
        )
        serializer = WorkspaceTeamMemberSerializer(
            queryset,
            many=True,
            context={"actor_membership": actor_membership},
        )
        return Response(serializer.data)

    def post(self, request, shop_id):
        actor_membership = self.get_membership(shop_id)
        serializer = WorkspaceTeamMemberCreateSerializer(
            data=request.data,
            context={"actor_membership": actor_membership},
        )
        serializer.is_valid(raise_exception=True)
        membership = serializer.create_or_update_membership()
        response_serializer = WorkspaceTeamMemberSerializer(
            membership,
            context={"actor_membership": actor_membership},
        )
        return Response(response_serializer.data, status=201)


class WorkspaceTeamDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_actor_membership(self, shop_id):
        return get_membership_or_403(self.request.user, shop_id, ShopMembership.Role.ADMIN)

    def get_target_membership(self, actor_membership, membership_id):
        membership = (
            ShopMembership.objects.filter(shop=actor_membership.shop, pk=membership_id)
            .select_related("user", "shop")
            .first()
        )
        if membership is None:
            raise exceptions.NotFound("Workspace membership not found.")
        return membership

    def patch(self, request, shop_id, membership_id):
        actor_membership = self.get_actor_membership(shop_id)
        target_membership = self.get_target_membership(actor_membership, membership_id)
        serializer = WorkspaceTeamMemberUpdateSerializer(
            data=request.data,
            context={
                "actor_membership": actor_membership,
                "target_membership": target_membership,
            },
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        membership = serializer.apply()
        response_serializer = WorkspaceTeamMemberSerializer(
            membership,
            context={"actor_membership": actor_membership},
        )
        return Response(response_serializer.data)


class WorkspaceOwnershipTransferView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, shop_id):
        actor_membership = get_membership_or_403(request.user, shop_id, ShopMembership.Role.OWNER)
        serializer = WorkspaceOwnershipTransferSerializer(
            data=request.data,
            context={"actor_membership": actor_membership},
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.transfer()
        response_serializer = WorkspaceOwnershipTransferResultSerializer(result)
        return Response(response_serializer.data)
