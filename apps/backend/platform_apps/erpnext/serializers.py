from __future__ import annotations

from rest_framework import serializers

from platform_apps.erpnext.models import ERPNextDocumentLink, ERPNextShopBinding, ERPNextSyncCursor


class ERPNextShopBindingSerializer(serializers.ModelSerializer):
    shop_id = serializers.UUIDField(source="shop.id", read_only=True)

    class Meta:
        model = ERPNextShopBinding
        fields = [
            "id",
            "shop_id",
            "is_enabled",
            "environment",
            "site_url_override",
            "company",
            "warehouse",
            "selling_price_list",
            "cost_center",
            "customer_group",
            "supplier_group",
            "currency_code",
            "item_sync_enabled",
            "customer_sync_enabled",
            "stock_sync_enabled",
            "sales_posting_enabled",
            "payment_posting_enabled",
            "purchase_sync_enabled",
            "metadata_json",
            "last_verified_at",
            "last_health_status",
            "last_error_message",
            "last_health_payload_json",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "shop_id",
            "last_verified_at",
            "last_health_status",
            "last_error_message",
            "last_health_payload_json",
            "created_at",
            "updated_at",
        ]


class ERPNextSyncCursorSerializer(serializers.ModelSerializer):
    shop_id = serializers.UUIDField(source="shop.id", read_only=True)

    class Meta:
        model = ERPNextSyncCursor
        fields = [
            "id",
            "shop_id",
            "domain",
            "direction",
            "status",
            "last_remote_modified_at",
            "last_remote_cursor",
            "last_started_at",
            "last_finished_at",
            "last_result_count",
            "last_error_message",
            "metadata_json",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ERPNextDocumentLinkSerializer(serializers.ModelSerializer):
    shop_id = serializers.UUIDField(source="shop.id", read_only=True)

    class Meta:
        model = ERPNextDocumentLink
        fields = [
            "id",
            "shop_id",
            "local_domain",
            "local_object_id",
            "remote_doctype",
            "remote_name",
            "direction",
            "sync_status",
            "last_synced_at",
            "last_error_message",
            "metadata_json",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ERPNextActionSerializer(serializers.Serializer):
    limit = serializers.IntegerField(min_value=1, max_value=500, required=False, default=100)
