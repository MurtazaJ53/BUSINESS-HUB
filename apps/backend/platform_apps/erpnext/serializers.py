from __future__ import annotations

from rest_framework import serializers

from platform_apps.erpnext.models import (
    ERPNextDocumentLink,
    ERPNextPurchaseMirror,
    ERPNextShopBinding,
    ERPNextSupplierPaymentMirror,
    ERPNextSupplierMirror,
    ERPNextSyncCursor,
)


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


class ERPNextCycleSerializer(ERPNextActionSerializer):
    verify_connection = serializers.BooleanField(required=False, default=True)
    sync_items = serializers.BooleanField(required=False, default=True)
    sync_customers = serializers.BooleanField(required=False, default=True)
    sync_stock = serializers.BooleanField(required=False, default=True)
    sync_suppliers = serializers.BooleanField(required=False, default=True)
    sync_purchases = serializers.BooleanField(required=False, default=True)
    sync_supplier_payments = serializers.BooleanField(required=False, default=True)
    push_sales = serializers.BooleanField(required=False, default=True)
    push_payments = serializers.BooleanField(required=False, default=True)


class ERPNextSupplierMirrorSerializer(serializers.ModelSerializer):
    shop_id = serializers.UUIDField(source="shop.id", read_only=True)

    class Meta:
        model = ERPNextSupplierMirror
        fields = [
            "id",
            "shop_id",
            "remote_name",
            "supplier_name",
            "supplier_group",
            "supplier_type",
            "phone",
            "email",
            "status",
            "last_remote_modified_at",
            "last_synced_at",
            "metadata_json",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ERPNextPurchaseMirrorSerializer(serializers.ModelSerializer):
    shop_id = serializers.UUIDField(source="shop.id", read_only=True)
    supplier_name = serializers.CharField(source="supplier.supplier_name", read_only=True)

    class Meta:
        model = ERPNextPurchaseMirror
        fields = [
            "id",
            "shop_id",
            "supplier_id",
            "supplier_name",
            "remote_doctype",
            "remote_name",
            "supplier_remote_name",
            "posting_date",
            "warehouse",
            "currency_code",
            "grand_total",
            "status",
            "docstatus",
            "item_count",
            "items_json",
            "metadata_json",
            "last_remote_modified_at",
            "last_synced_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ERPNextSupplierPaymentMirrorSerializer(serializers.ModelSerializer):
    shop_id = serializers.UUIDField(source="shop.id", read_only=True)
    supplier_name = serializers.CharField(source="supplier.supplier_name", read_only=True)

    class Meta:
        model = ERPNextSupplierPaymentMirror
        fields = [
            "id",
            "shop_id",
            "supplier_id",
            "supplier_name",
            "remote_doctype",
            "remote_name",
            "supplier_remote_name",
            "posting_date",
            "payment_type",
            "mode_of_payment",
            "reference_no",
            "currency_code",
            "paid_amount",
            "received_amount",
            "docstatus",
            "status",
            "metadata_json",
            "last_remote_modified_at",
            "last_synced_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
