from __future__ import annotations

from rest_framework import serializers

from platform_apps.shops.models import ShopMembership, ShopPlanRequest
from platform_apps.shops.plans import PLAN_TIERS, normalize_plan_tier


class ShopMembershipListSerializer(serializers.ModelSerializer):
    shop_id = serializers.UUIDField(source="shop.id")
    shop_name = serializers.CharField(source="shop.name")
    shop_slug = serializers.CharField(source="shop.slug")
    shop_currency_code = serializers.CharField(source="shop.currency_code")
    shop_timezone = serializers.CharField(source="shop.timezone")
    shop_plan_tier = serializers.CharField(source="shop.plan_tier")
    shop_enabled_features = serializers.DictField(
        source="shop.enabled_features",
        child=serializers.BooleanField(),
    )

    class Meta:
        model = ShopMembership
        fields = (
            "id",
            "role",
            "status",
            "permissions_version",
            "permissions_json",
            "shop_id",
            "shop_name",
            "shop_slug",
            "shop_currency_code",
            "shop_timezone",
            "shop_plan_tier",
            "shop_enabled_features",
        )


class ShopDomainStateSerializer(serializers.Serializer):
    shop_id = serializers.UUIDField()
    domain = serializers.CharField()
    control_present = serializers.BooleanField()
    write_master = serializers.CharField()
    bridge_mode = serializers.CharField()
    cutover_status = serializers.CharField()
    current_epoch = serializers.IntegerField()
    shadow_reads_enabled = serializers.BooleanField()
    is_enabled = serializers.BooleanField()
    can_write_on_postgres_surface = serializers.BooleanField()
    pilot_signoff_status = serializers.CharField(allow_null=True)
    pilot_signoff_summary = serializers.CharField(allow_blank=True, allow_null=True)
    pilot_recommended_action = serializers.CharField(allow_blank=True, allow_null=True)
    pilot_latest_verify_result = serializers.CharField(allow_blank=True, allow_null=True)


class ShopPlanRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source="requested_by_user.full_name", read_only=True)

    class Meta:
        model = ShopPlanRequest
        fields = (
            "id",
            "current_plan_tier",
            "requested_plan_tier",
            "status",
            "request_note",
            "context_json",
            "requested_by_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "current_plan_tier",
            "status",
            "context_json",
            "requested_by_name",
            "created_at",
            "updated_at",
        )


class ShopPlanRequestCreateSerializer(serializers.Serializer):
    requested_plan_tier = serializers.CharField(max_length=16)
    request_note = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    context_json = serializers.DictField(required=False)

    def validate_requested_plan_tier(self, value: str) -> str:
        normalized = normalize_plan_tier(value)
        membership = self.context["membership"]
        current_tier = membership.shop.plan_tier
        tier_order = {tier: index for index, tier in enumerate(PLAN_TIERS)}

        if normalized == current_tier:
            raise serializers.ValidationError("This workspace is already on that plan.")

        if tier_order[normalized] < tier_order[current_tier]:
            raise serializers.ValidationError("Plan requests must move upward, not downward.")

        if current_tier == PLAN_TIERS[-1]:
            raise serializers.ValidationError("This workspace is already on the highest curated plan.")

        return normalized
