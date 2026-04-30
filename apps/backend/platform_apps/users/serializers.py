from __future__ import annotations

from rest_framework import serializers

from platform_apps.shops.models import ShopMembership
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


class SessionMembershipSerializer(serializers.ModelSerializer):
    shop = serializers.SerializerMethodField()

    class Meta:
        model = ShopMembership
        fields = ("id", "role", "status", "permissions_version", "permissions_json", "shop")

    def get_shop(self, obj):
        return MembershipShopSerializer(obj.shop).data

