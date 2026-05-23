from __future__ import annotations

from rest_framework import serializers

from platform_apps.shops.models import ShopMembership
from platform_apps.shops.roles import (
    get_membership_role_label,
    get_membership_role_product_profile,
    get_membership_role_summary,
)
from platform_apps.users.models import PlatformUser


class SessionUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformUser
        fields = ("id", "email", "full_name", "firebase_uid", "timezone", "is_platform_admin")


class MembershipShopSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    slug = serializers.CharField()
    currency_code = serializers.CharField()
    timezone = serializers.CharField()
    is_active = serializers.BooleanField()
    plan_tier = serializers.CharField()
    enabled_features = serializers.DictField(
        child=serializers.BooleanField(),
    )


class SessionMembershipSerializer(serializers.ModelSerializer):
    shop = serializers.SerializerMethodField()
    role_label = serializers.SerializerMethodField()
    role_summary = serializers.SerializerMethodField()
    role_profile = serializers.SerializerMethodField()

    class Meta:
        model = ShopMembership
        fields = (
            "id",
            "role",
            "role_label",
            "role_summary",
            "role_profile",
            "status",
            "permissions_version",
            "permissions_json",
            "shop",
        )

    def get_shop(self, obj):
        return MembershipShopSerializer(obj.shop).data

    def get_role_label(self, obj):
        return get_membership_role_label(obj.role)

    def get_role_summary(self, obj):
        return get_membership_role_summary(obj.role)

    def get_role_profile(self, obj):
        return get_membership_role_product_profile(obj.role)
