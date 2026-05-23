from __future__ import annotations

from rest_framework import permissions
from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_apps.audit.services import create_workspace_audit_event
from platform_apps.projections.models import ShopDashboardSnapshot
from platform_apps.projections.pulse import build_shop_pulse_snapshot, sync_shop_pulse_signals
from platform_apps.projections.serializers import (
    ShopDashboardSnapshotSerializer,
    ShopPulseSignalSerializer,
    ShopPulseSignalUpdateSerializer,
    ShopPulseSnapshotSerializer,
)
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

        serializer = ShopDashboardSnapshotSerializer(
            snapshot,
            context={
                "membership": membership,
            },
        )
        return Response(serializer.data)


class ShopPulseSnapshotView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, shop_id):
        membership = get_membership_or_403(request.user, shop_id, ShopMembership.Role.ADMIN)
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

        full_pulse = build_shop_pulse_snapshot(
            membership.shop,
            dashboard_snapshot=snapshot,
            signal_limit=None,
        )
        sync_shop_pulse_signals(
            membership.shop,
            pulse_snapshot=full_pulse,
            now=snapshot.refreshed_at,
        )
        pulse = build_shop_pulse_snapshot(
            membership.shop,
            dashboard_snapshot=snapshot,
        )
        serializer = ShopPulseSnapshotSerializer(pulse)
        return Response(serializer.data)


class ShopPulseSignalListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, shop_id):
        membership = get_membership_or_403(request.user, shop_id, ShopMembership.Role.ADMIN)
        snapshot = (
            ShopDashboardSnapshot.objects.filter(shop=membership.shop)
            .select_related("shop")
            .prefetch_related("low_stock_preview")
            .first()
        )
        if snapshot is None:
            snapshot = refresh_shop_dashboard_projection(membership.shop)
        full_pulse = build_shop_pulse_snapshot(
            membership.shop,
            dashboard_snapshot=snapshot,
            signal_limit=None,
        )
        signals = sync_shop_pulse_signals(
            membership.shop,
            pulse_snapshot=full_pulse,
            now=snapshot.refreshed_at,
        )
        status_filter = request.query_params.get("status", "").strip().lower()
        if status_filter in {"open", "acknowledged", "resolved"}:
            signals = [signal for signal in signals if signal.status == status_filter]
        serializer = ShopPulseSignalSerializer(signals, many=True)
        return Response(serializer.data)


class ShopPulseSignalDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, shop_id, signal_id):
        membership = get_membership_or_403(request.user, shop_id, ShopMembership.Role.ADMIN)
        signal = (
            membership.shop.pulse_signals.select_related("acknowledged_by_user", "resolved_by_user")
            .filter(pk=signal_id)
            .first()
        )
        if signal is None:
            raise exceptions.NotFound("Pulse signal not found.")

        serializer = ShopPulseSignalUpdateSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        action = serializer.validated_data["action"]
        before = {
            "status": signal.status,
            "acknowledged_at": signal.acknowledged_at,
            "resolved_at": signal.resolved_at,
            "resolution_note": signal.resolution_note,
        }
        signal = serializer.apply(signal=signal, actor_user=request.user)
        create_workspace_audit_event(
            shop=membership.shop,
            actor_user=request.user,
            actor_role=membership.role,
            category="workspace",
            event_type=f"workspace.pulse.{action}",
            entity_type="shop_pulse_signal",
            entity_id=signal.id,
            entity_label=signal.title,
            summary=f"{action.title()} pulse signal {signal.code}.",
            source_surface="pulse_control",
            before=before,
            after={
                "status": signal.status,
                "acknowledged_at": signal.acknowledged_at,
                "resolved_at": signal.resolved_at,
                "resolution_note": signal.resolution_note,
            },
        )
        response_serializer = ShopPulseSignalSerializer(signal)
        return Response(response_serializer.data)
