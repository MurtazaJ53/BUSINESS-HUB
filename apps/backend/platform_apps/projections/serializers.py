from __future__ import annotations

from rest_framework import serializers

from platform_apps.projections.models import ShopDashboardSnapshot, ShopLowStockSnapshot
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
