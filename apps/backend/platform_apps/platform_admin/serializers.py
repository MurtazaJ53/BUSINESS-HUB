from rest_framework import serializers
from platform_apps.shops.models import Shop
from platform_apps.platform_admin.models import PlatformAuditEvent

class PlatformShopSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    owner_email = serializers.SerializerMethodField(read_only=True)
    owner_name = serializers.SerializerMethodField(read_only=True)
    member_count = serializers.SerializerMethodField(read_only=True)
    plan_tier = serializers.CharField(read_only=True)

    class Meta:
        model = Shop
        fields = [
            'id', 'name', 'slug', 'legal_name', 'currency_code', 'timezone',
            'region_code', 'is_active', 'status', 'status_display',
            'status_reason', 'plan_tier', 'owner_email', 'owner_name',
            'member_count', 'created_at', 'updated_at'
        ]
        read_only_fields = fields

    def get_owner_email(self, obj):
        return obj.owner_user.email if obj.owner_user else None

    def get_owner_name(self, obj):
        return obj.owner_user.get_full_name() if obj.owner_user else None

    def get_member_count(self, obj):
        return getattr(obj, '_member_count', 0)


class PlatformShopLifecycleSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, required=True, allow_blank=False)


class PlatformShopPlanSerializer(serializers.Serializer):
    plan_tier = serializers.ChoiceField(choices=['starter', 'growth', 'pro'])
    reason = serializers.CharField(max_length=500, required=True, allow_blank=False)


class PlatformAuditEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    actor_email = serializers.SerializerMethodField()
    shop_name = serializers.SerializerMethodField()
    shop_slug = serializers.SerializerMethodField()

    class Meta:
        model = PlatformAuditEvent
        fields = [
            'id', 'action', 'reason', 'actor_user', 'actor_name', 'actor_email',
            'shop', 'shop_name', 'shop_slug', 'before_json', 'after_json',
            'metadata_json', 'ip_address', 'created_at'
        ]
        read_only_fields = fields

    def get_actor_name(self, obj):
        return obj.actor_user.get_full_name() if obj.actor_user else None

    def get_actor_email(self, obj):
        return obj.actor_user.email if obj.actor_user else None

    def get_shop_name(self, obj):
        return obj.shop.name if obj.shop else None

    def get_shop_slug(self, obj):
        return obj.shop.slug if obj.shop else None


class PlatformMetricsSerializer(serializers.Serializer):
    total_shops = serializers.IntegerField()
    active_shops = serializers.IntegerField()
    pending_shops = serializers.IntegerField()
    suspended_shops = serializers.IntegerField()
    total_users = serializers.IntegerField()
    starter_shops = serializers.IntegerField()
    growth_shops = serializers.IntegerField()
    pro_shops = serializers.IntegerField()
    shops_created_last_30d = serializers.IntegerField()
    open_plan_requests = serializers.IntegerField()
