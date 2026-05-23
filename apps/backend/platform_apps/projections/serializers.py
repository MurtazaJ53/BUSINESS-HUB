from __future__ import annotations

from rest_framework import serializers

from platform_apps.projections.models import (
    ShopDashboardSnapshot,
    ShopLowStockSnapshot,
    ShopPulseSignal,
)
from platform_apps.shops.permissions import has_feature_enabled


class ShopLowStockSnapshotSerializer(serializers.ModelSerializer):
    inventory_item_id = serializers.SerializerMethodField()

    def get_inventory_item_id(self, obj):
        return str(obj.inventory_item_id) if obj.inventory_item_id else None

    class Meta:
        model = ShopLowStockSnapshot
        fields = (
            "id",
            "inventory_item_id",
            "item_name",
            "sku",
            "category",
            "stock_on_hand",
            "sell_price",
            "severity_rank",
            "refreshed_at",
        )


class ShopDashboardSnapshotSerializer(serializers.ModelSerializer):
    low_stock_preview = ShopLowStockSnapshotSerializer(many=True, read_only=True)

    class Meta:
        model = ShopDashboardSnapshot
        fields = (
            "id",
            "shop",
            "inventory_items_count",
            "active_inventory_items_count",
            "category_count",
            "low_stock_items_count",
            "out_of_stock_items_count",
            "projected_sell_value",
            "customer_count",
            "active_credit_customers_count",
            "total_outstanding_balance",
            "total_lifetime_spend",
            "sales_count",
            "gross_revenue",
            "outstanding_revenue",
            "payment_count",
            "total_collected",
            "credit_payment_count",
            "digital_payment_count",
            "last_sale_at",
            "refreshed_at",
            "metadata_json",
            "low_stock_preview",
        )

    def to_representation(self, instance):
        payload = super().to_representation(instance)
        membership = self.context.get("membership")
        if membership is None:
            return payload

        if not has_feature_enabled(membership, "advanced_reports"):
            payload["projected_sell_value"] = None
            payload["total_lifetime_spend"] = None

        if not has_feature_enabled(membership, "finance_summary"):
            payload["total_outstanding_balance"] = None
            payload["gross_revenue"] = None
            payload["outstanding_revenue"] = None
            payload["total_collected"] = None

        return payload


class ShopPulseHeadlineSerializer(serializers.Serializer):
    title = serializers.CharField()
    body = serializers.CharField()
    route = serializers.CharField()
    cta_label = serializers.CharField()
    tone = serializers.CharField()


class ShopPulseTaskSerializer(serializers.Serializer):
    code = serializers.CharField()
    priority = serializers.CharField()
    tone = serializers.CharField()
    title = serializers.CharField()
    body = serializers.CharField()
    route = serializers.CharField()
    cta_label = serializers.CharField()
    count = serializers.IntegerField()
    metadata_json = serializers.JSONField()


class ShopPulseAnomalySerializer(serializers.Serializer):
    code = serializers.CharField()
    severity = serializers.CharField()
    title = serializers.CharField()
    body = serializers.CharField()
    route = serializers.CharField()
    cta_label = serializers.CharField()
    metric_value = serializers.CharField()
    metadata_json = serializers.JSONField()


class ShopPulseStatsSerializer(serializers.Serializer):
    open_task_count = serializers.IntegerField()
    critical_anomaly_count = serializers.IntegerField()
    warning_anomaly_count = serializers.IntegerField()
    stale_session_count = serializers.IntegerField()
    wipe_pending_count = serializers.IntegerField()
    open_plan_request_count = serializers.IntegerField()
    low_stock_count = serializers.IntegerField()


class ShopPulseSnapshotSerializer(serializers.Serializer):
    refreshed_at = serializers.DateTimeField()
    headline = ShopPulseHeadlineSerializer()
    stats = ShopPulseStatsSerializer()
    tasks = ShopPulseTaskSerializer(many=True)
    anomalies = ShopPulseAnomalySerializer(many=True)


class ShopPulseSignalSerializer(serializers.ModelSerializer):
    acknowledged_by_name = serializers.SerializerMethodField()
    resolved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ShopPulseSignal
        fields = (
            "id",
            "signal_kind",
            "code",
            "status",
            "signal_level",
            "signal_rank",
            "tone",
            "title",
            "body",
            "route",
            "cta_label",
            "metric_value",
            "count",
            "first_detected_at",
            "last_detected_at",
            "last_snapshot_refreshed_at",
            "acknowledged_at",
            "acknowledged_by_name",
            "resolved_at",
            "resolved_by_name",
            "resolution_note",
            "metadata_json",
            "created_at",
            "updated_at",
        )

    def get_acknowledged_by_name(self, obj):
        if obj.acknowledged_by_user is None:
            return None
        return obj.acknowledged_by_user.full_name or obj.acknowledged_by_user.email

    def get_resolved_by_name(self, obj):
        if obj.resolved_by_user is None:
            return None
        return obj.resolved_by_user.full_name or obj.resolved_by_user.email


class ShopPulseSignalUpdateSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["acknowledge", "resolve", "reopen"])
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)

    def apply(self, *, signal: ShopPulseSignal, actor_user):
        action = self.validated_data["action"]
        note = self.validated_data.get("note", "").strip()

        from django.utils import timezone

        current_time = timezone.now()
        update_fields = ["updated_at"]

        if action == "acknowledge":
            signal.status = ShopPulseSignal.Status.ACKNOWLEDGED
            signal.acknowledged_at = current_time
            signal.acknowledged_by_user = actor_user
            if note:
                signal.resolution_note = note
                update_fields.append("resolution_note")
            update_fields.extend(["status", "acknowledged_at", "acknowledged_by_user"])
        elif action == "resolve":
            signal.status = ShopPulseSignal.Status.RESOLVED
            signal.resolved_at = current_time
            signal.resolved_by_user = actor_user
            signal.resolution_note = note
            update_fields.extend(["status", "resolved_at", "resolved_by_user", "resolution_note"])
        else:
            signal.status = ShopPulseSignal.Status.OPEN
            signal.acknowledged_at = None
            signal.acknowledged_by_user = None
            signal.resolved_at = None
            signal.resolved_by_user = None
            if note:
                signal.resolution_note = note
                update_fields.append("resolution_note")
            update_fields.extend(
                [
                    "status",
                    "acknowledged_at",
                    "acknowledged_by_user",
                    "resolved_at",
                    "resolved_by_user",
                ]
            )

        signal.save(update_fields=update_fields)
        return signal
