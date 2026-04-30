from __future__ import annotations

from rest_framework import serializers

from platform_apps.shops.models import ShopMembership


class ShopMembershipListSerializer(serializers.ModelSerializer):
    shop_id = serializers.UUIDField(source="shop.id")
    shop_name = serializers.CharField(source="shop.name")
    shop_slug = serializers.CharField(source="shop.slug")
    shop_currency_code = serializers.CharField(source="shop.currency_code")
    shop_timezone = serializers.CharField(source="shop.timezone")

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
        )
