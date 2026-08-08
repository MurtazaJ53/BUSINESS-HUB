from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from platform_apps.inventory.models import InventoryItem, InventoryItemPrivate, InventoryStockLedger
from platform_apps.purchases.models import (
    Purchase,
    PurchaseItem,
    Supplier,
    SupplierLedgerEntry,
)


# --------------------------------------------------------------------------- #
# Suppliers
# --------------------------------------------------------------------------- #
class SupplierSummarySerializer(serializers.Serializer):
    total_suppliers = serializers.IntegerField()
    payable_suppliers = serializers.IntegerField()
    total_outstanding_balance = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_purchased = serializers.DecimalField(max_digits=14, decimal_places=2)


class SupplierSerializer(serializers.ModelSerializer):
    opening_balance = serializers.DecimalField(
        max_digits=12, decimal_places=2, write_only=True, required=False, default=Decimal("0.00")
    )

    class Meta:
        model = Supplier
        fields = (
            "id",
            "name",
            "phone",
            "email",
            "gstin",
            "address",
            "balance",
            "total_purchased",
            "notes",
            "status",
            "tombstone",
            "opening_balance",
        )
        read_only_fields = ("id", "balance", "total_purchased", "tombstone")

    @transaction.atomic
    def create(self, validated_data):
        opening_balance = Decimal(str(validated_data.pop("opening_balance", Decimal("0.00"))))
        supplier = Supplier.objects.create(
            shop=self.context["shop"],
            balance=opening_balance,
            **validated_data,
        )
        if opening_balance != Decimal("0.00"):
            SupplierLedgerEntry.objects.create(
                shop=supplier.shop,
                supplier=supplier,
                actor_user=self.context.get("actor"),
                event_type=SupplierLedgerEntry.EventType.OPENING_BALANCE,
                amount_delta=opening_balance,
                note="Opening balance",
                occurred_at=timezone.now(),
            )
        return supplier


class SupplierLedgerEntrySerializer(serializers.ModelSerializer):
    running_balance = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True, required=False
    )

    class Meta:
        model = SupplierLedgerEntry
        fields = (
            "id",
            "event_type",
            "amount_delta",
            "note",
            "occurred_at",
            "running_balance",
        )
        read_only_fields = ("id", "running_balance")


# --------------------------------------------------------------------------- #
# Purchases
# --------------------------------------------------------------------------- #
class PurchaseItemSerializer(serializers.ModelSerializer):
    inventory_item_id = serializers.UUIDField(required=False, allow_null=True)
    name = serializers.CharField(source="name_snapshot", required=False, allow_blank=True)
    sku = serializers.CharField(source="sku_snapshot", required=False, allow_blank=True)
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseItem
        fields = (
            "id",
            "inventory_item_id",
            "name",
            "sku",
            "quantity",
            "unit_cost",
            "line_total",
        )
        read_only_fields = ("id", "line_total")


class PurchaseSummarySerializer(serializers.Serializer):
    total_purchases = serializers.IntegerField()
    total_spent = serializers.DecimalField(max_digits=14, decimal_places=2)
    outstanding_payable = serializers.DecimalField(max_digits=14, decimal_places=2)


class PurchaseSerializer(serializers.ModelSerializer):
    supplier_id = serializers.UUIDField(required=False, allow_null=True)
    supplier_name = serializers.CharField(source="supplier_name_snapshot", required=False, allow_blank=True)
    items = PurchaseItemSerializer(many=True)
    amount_paid = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=Decimal("0.00"))
    amount_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    subtotal_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    actor_name = serializers.SerializerMethodField(read_only=True)
    item_count = serializers.SerializerMethodField(read_only=True)
    purchase_date = serializers.DateField(required=False)
    occurred_at = serializers.DateTimeField(required=False)

    class Meta:
        model = Purchase
        fields = (
            "id",
            "supplier_id",
            "supplier_name",
            "invoice_number",
            "reference",
            "subtotal_amount",
            "discount_amount",
            "tax_amount",
            "total_amount",
            "amount_paid",
            "amount_due",
            "payment_mode",
            "note",
            "purchase_date",
            "occurred_at",
            "status",
            "tombstone",
            "actor_name",
            "item_count",
            "items",
        )
        read_only_fields = (
            "id",
            "subtotal_amount",
            "total_amount",
            "amount_due",
            "status",
            "tombstone",
            "actor_name",
            "item_count",
        )

    def get_actor_name(self, obj):
        if not obj.actor_user_id:
            return None
        return obj.actor_user.full_name or obj.actor_user.email

    def get_item_count(self, obj):
        if hasattr(obj, "_prefetched_objects_cache") and "items" in obj._prefetched_objects_cache:
            return len(obj._prefetched_objects_cache["items"])
        return obj.items.count()

    def validate(self, attrs):
        items = attrs.get("items") or []
        if not items:
            raise serializers.ValidationError({"items": "At least one purchase item is required."})
        for item in items:
            quantity = Decimal(str(item.get("quantity", 0)))
            if quantity <= 0:
                raise serializers.ValidationError({"items": "Each item must have a positive quantity."})
            if (item.get("unit_cost") or Decimal("0.00")) < 0:
                raise serializers.ValidationError({"items": "Unit cost cannot be negative."})
        return attrs

    def _resolve_inventory_item(self, shop, item_payload):
        inventory_item_id = item_payload.get("inventory_item_id")
        if not inventory_item_id:
            return None
        try:
            return InventoryItem.objects.select_related("private").get(
                pk=inventory_item_id, shop=shop, tombstone=False
            )
        except InventoryItem.DoesNotExist as exc:
            raise serializers.ValidationError(
                {"items": f"Inventory item {inventory_item_id} is not available in this shop."}
            ) from exc

    def _resolve_supplier(self, shop, supplier_id):
        if not supplier_id:
            return None
        try:
            return Supplier.objects.get(pk=supplier_id, shop=shop, tombstone=False)
        except Supplier.DoesNotExist as exc:
            raise serializers.ValidationError(
                {"supplier_id": "Supplier is not available in this shop."}
            ) from exc

    @transaction.atomic
    def create(self, validated_data):
        shop = self.context["shop"]
        actor = self.context["actor"]
        item_payloads = validated_data.pop("items")
        supplier = self._resolve_supplier(shop, validated_data.pop("supplier_id", None))

        discount_amount = validated_data.get("discount_amount", Decimal("0.00")) or Decimal("0.00")
        tax_amount = validated_data.get("tax_amount", Decimal("0.00")) or Decimal("0.00")
        amount_paid = Decimal(str(validated_data.pop("amount_paid", Decimal("0.00")) or Decimal("0.00")))

        subtotal = sum(
            (Decimal(str(ip["quantity"])) * (ip.get("unit_cost") or Decimal("0.00")) for ip in item_payloads),
            Decimal("0.00"),
        )
        total = (subtotal - discount_amount + tax_amount).quantize(Decimal("0.01"))
        if total < Decimal("0.00"):
            raise serializers.ValidationError({"discount_amount": "Discount cannot exceed the purchase value."})
        if amount_paid > total:
            raise serializers.ValidationError({"amount_paid": "Amount paid cannot exceed the purchase total."})
        amount_due = total - amount_paid

        purchase_date = validated_data.get("purchase_date") or timezone.localdate()
        occurred_at = validated_data.get("occurred_at") or timezone.now()
        validated_data["purchase_date"] = purchase_date
        validated_data["occurred_at"] = occurred_at

        supplier_name = validated_data.pop("supplier_name_snapshot", "")
        if supplier is not None:
            supplier_name = supplier_name or supplier.name

        purchase = Purchase.objects.create(
            shop=shop,
            supplier=supplier,
            actor_user=actor,
            supplier_name_snapshot=supplier_name,
            subtotal_amount=subtotal.quantize(Decimal("0.01")),
            total_amount=total,
            amount_paid=amount_paid,
            amount_due=amount_due,
            **validated_data,
        )

        for item_payload in item_payloads:
            inventory_item = self._resolve_inventory_item(shop, item_payload)
            quantity = Decimal(str(item_payload["quantity"]))
            unit_cost = item_payload.get("unit_cost") or Decimal("0.00")
            line_total = (quantity * unit_cost).quantize(Decimal("0.01"))

            if inventory_item is not None:
                name_snapshot = item_payload.get("name_snapshot") or inventory_item.name
                sku_snapshot = item_payload.get("sku_snapshot") or inventory_item.sku
            else:
                name_snapshot = item_payload.get("name_snapshot") or ""
                sku_snapshot = item_payload.get("sku_snapshot") or ""
                if not name_snapshot:
                    raise serializers.ValidationError({"items": "Non-catalog items must include a name."})

            purchase_item = PurchaseItem.objects.create(
                purchase=purchase,
                inventory_item=inventory_item,
                name_snapshot=name_snapshot,
                sku_snapshot=sku_snapshot,
                quantity=quantity,
                unit_cost=unit_cost,
                line_total=line_total,
                source_system=purchase.source_system,
                source_shop_id=purchase.source_shop_id,
                source_path=f"purchases/{purchase.id}/items",
                domain_epoch=purchase.domain_epoch,
            )

            # --- Procurement -> Inventory: post received stock and refresh cost. ---
            if inventory_item is not None:
                InventoryStockLedger.objects.create(
                    shop=shop,
                    item=inventory_item,
                    actor_user=actor,
                    event_type=InventoryStockLedger.EventType.PURCHASE,
                    quantity_delta=quantity,
                    unit_cost=unit_cost,
                    note=f"Purchase {purchase.invoice_number or purchase.id}",
                    occurred_at=occurred_at,
                    source_system=purchase.source_system,
                    source_id=str(purchase.id),
                    source_shop_id=purchase.source_shop_id,
                    source_path=f"purchases/{purchase.id}/items/{purchase_item.id}",
                    domain_epoch=purchase.domain_epoch,
                )
                private, _ = InventoryItemPrivate.objects.get_or_create(item=inventory_item)
                private.cost_price = unit_cost
                private.last_purchase_date = purchase_date
                if supplier is not None:
                    private.supplier_id = str(supplier.id)
                private.tombstone = False
                private.save(update_fields=["cost_price", "last_purchase_date", "supplier_id", "tombstone", "updated_at"])

        # --- Supplier payables ledger (accounts payable timeline). ---
        if supplier is not None:
            SupplierLedgerEntry.objects.create(
                shop=shop,
                supplier=supplier,
                actor_user=actor,
                event_type=SupplierLedgerEntry.EventType.PURCHASE,
                amount_delta=total,
                note=f"Purchase {purchase.invoice_number or purchase.id}",
                occurred_at=occurred_at,
            )
            if amount_paid > Decimal("0.00"):
                SupplierLedgerEntry.objects.create(
                    shop=shop,
                    supplier=supplier,
                    actor_user=actor,
                    event_type=SupplierLedgerEntry.EventType.PAYMENT,
                    amount_delta=-amount_paid,
                    note=f"Payment for {purchase.invoice_number or purchase.id}",
                    occurred_at=occurred_at,
                )
            supplier.balance = supplier.balance + amount_due
            supplier.total_purchased = supplier.total_purchased + total
            supplier.save(update_fields=["balance", "total_purchased", "updated_at"])

        return purchase
