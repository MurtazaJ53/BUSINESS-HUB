from __future__ import annotations

from rest_framework import serializers

from platform_apps.shops.models import ShopMembership


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
