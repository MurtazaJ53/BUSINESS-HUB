from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from platform_apps.inventory.models import InventoryItem, InventoryItemPrivate, InventoryStockLedger


class InventoryItemSerializer(serializers.ModelSerializer):
    stock_on_hand = serializers.IntegerField(read_only=True)
    cost_price = serializers.SerializerMethodField()
    supplier_id = serializers.SerializerMethodField()
    last_purchase_date = serializers.SerializerMethodField()
    opening_stock = serializers.IntegerField(write_only=True, required=False, default=0)
    private_cost_price = serializers.DecimalField(
        source="cost_price_input",
        max_digits=12,
        decimal_places=2,
        required=False,
        write_only=True,
    )
    private_supplier_id = serializers.CharField(source="supplier_id_input", required=False, write_only=True, allow_blank=True)
    private_last_purchase_date = serializers.DateField(
        source="last_purchase_date_input",
        required=False,
        write_only=True,
        allow_null=True,
    )

    class Meta:
        model = InventoryItem
        fields = (
            "id",
            "name",
            "sku",
            "barcode",
            "category",
            "subcategory",
            "size",
            "description",
            "sell_price",
            "status",
            "tombstone",
            "source_meta_json",
            "stock_on_hand",
            "cost_price",
            "supplier_id",
            "last_purchase_date",
            "opening_stock",
            "private_cost_price",
            "private_supplier_id",
            "private_last_purchase_date",
        )
        read_only_fields = ("id", "stock_on_hand")

    def _can_view_costs(self) -> bool:
        return bool(self.context.get("can_view_costs"))

    def _can_view_supplier_directory(self) -> bool:
        return bool(self.context.get("can_view_supplier_directory"))

    def _can_view_purchase_workflow(self) -> bool:
        return bool(self.context.get("can_view_purchase_workflow"))

    def validate(self, attrs):
        supplier_id = attrs.get("supplier_id_input")
        last_purchase_date = attrs.get("last_purchase_date_input")

        if (
            supplier_id not in (None, "")
            and not self._can_view_supplier_directory()
        ):
            raise serializers.ValidationError(
                {
                    "private_supplier_id": (
                        "Supplier directory is not enabled for this workspace plan."
                    )
                }
            )

        if (
            last_purchase_date is not None
            and not self._can_view_purchase_workflow()
        ):
            raise serializers.ValidationError(
                {
                    "private_last_purchase_date": (
                        "Purchase workflow is not enabled for this workspace plan."
                    )
                }
            )

        return attrs

    def get_cost_price(self, obj):
        if not self._can_view_costs():
            return None
        private = getattr(obj, "private", None)
        return private.cost_price if private and not private.tombstone else None

    def get_supplier_id(self, obj):
        if not self._can_view_supplier_directory():
            return None
        private = getattr(obj, "private", None)
        return private.supplier_id if private and not private.tombstone else None

    def get_last_purchase_date(self, obj):
        if not self._can_view_purchase_workflow():
            return None
        private = getattr(obj, "private", None)
        return private.last_purchase_date if private and not private.tombstone else None

    @transaction.atomic
    def create(self, validated_data):
        opening_stock = int(validated_data.pop("opening_stock", 0))
        cost_price = validated_data.pop("cost_price_input", None)
        supplier_id = validated_data.pop("supplier_id_input", "")
        last_purchase_date = validated_data.pop("last_purchase_date_input", None)
        shop = self.context["shop"]
        actor = self.context["actor"]

        item = InventoryItem.objects.create(shop=shop, **validated_data)

        if (
            self._can_view_costs()
            and any(
                value is not None and value != ""
                for value in [cost_price, supplier_id, last_purchase_date]
            )
        ):
            InventoryItemPrivate.objects.create(
                item=item,
                cost_price=cost_price if cost_price is not None else Decimal("0.00"),
                supplier_id=(
                    supplier_id if self._can_view_supplier_directory() else ""
                ),
                last_purchase_date=(
                    last_purchase_date
                    if self._can_view_purchase_workflow()
                    else None
                ),
                source_system=validated_data.get("source_system", ""),
                source_shop_id=validated_data.get("source_shop_id", ""),
            )

        if opening_stock != 0:
            InventoryStockLedger.objects.create(
                shop=shop,
                item=item,
                actor_user=actor,
                event_type=InventoryStockLedger.EventType.OPENING_BALANCE,
                quantity_delta=opening_stock,
                unit_cost=cost_price if self._can_view_costs() and cost_price is not None else None,
                unit_price=item.sell_price,
                note="Opening balance",
                occurred_at=timezone.now(),
                source_system=validated_data.get("source_system", ""),
                source_shop_id=validated_data.get("source_shop_id", ""),
            )

        return item

    @transaction.atomic
    def update(self, instance, validated_data):
        validated_data.pop("opening_stock", None)
        cost_price = validated_data.pop("cost_price_input", None)
        supplier_id = validated_data.pop("supplier_id_input", None)
        last_purchase_date = validated_data.pop("last_purchase_date_input", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        if self._can_view_costs():
            private, _ = InventoryItemPrivate.objects.get_or_create(item=instance)
            updated = False
            if cost_price is not None:
                private.cost_price = cost_price
                updated = True
            if supplier_id is not None and self._can_view_supplier_directory():
                private.supplier_id = supplier_id
                updated = True
            if (
                last_purchase_date is not None
                and self._can_view_purchase_workflow()
            ):
                private.last_purchase_date = last_purchase_date
                updated = True
            if updated:
                private.save()

        return instance


class InventoryAdjustmentSerializer(serializers.Serializer):
    quantity_delta = serializers.IntegerField()
    note = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    event_type = serializers.ChoiceField(
        choices=[
            InventoryStockLedger.EventType.ADJUSTMENT,
            InventoryStockLedger.EventType.IMPORT,
            InventoryStockLedger.EventType.SYNC,
            InventoryStockLedger.EventType.RETURN,
        ],
        default=InventoryStockLedger.EventType.ADJUSTMENT,
    )


class InventorySummarySerializer(serializers.Serializer):
    total_items = serializers.IntegerField()
    available_items = serializers.IntegerField()
    low_stock_items = serializers.IntegerField()
    out_of_stock_items = serializers.IntegerField()
    categories = serializers.IntegerField()
    projected_sell_value = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        allow_null=True,
    )
