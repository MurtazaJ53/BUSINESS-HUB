from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from platform_apps.customers.models import Customer, CustomerLedgerEntry
from platform_apps.inventory.models import InventoryItem, InventoryStockLedger
from platform_apps.payments.models import SalePayment
from platform_apps.sales.models import Sale, SaleItem


class SaleItemSerializer(serializers.ModelSerializer):
    inventory_item_id = serializers.UUIDField(required=False, allow_null=True)
    name = serializers.CharField(source="name_snapshot", required=False, allow_blank=True)
    sku = serializers.CharField(source="sku_snapshot", required=False, allow_blank=True)
    size = serializers.CharField(source="size_snapshot", required=False, allow_blank=True)
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = SaleItem
        fields = (
            "id",
            "inventory_item_id",
            "name",
            "sku",
            "size",
            "quantity",
            "unit_price",
            "unit_cost",
            "line_total",
            "is_return",
        )
        read_only_fields = ("id", "line_total")


class SalePaymentWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalePayment
        fields = (
            "id",
            "payment_method",
            "amount",
            "reference_code",
            "note",
            "occurred_at",
        )
        read_only_fields = ("id", "occurred_at")


class SaleSerializer(serializers.ModelSerializer):
    customer_id = serializers.UUIDField(required=False, allow_null=True)
    customer_name = serializers.CharField(source="customer_name_snapshot", required=False, allow_blank=True)
    customer_phone = serializers.CharField(source="customer_phone_snapshot", required=False, allow_blank=True)
    items = SaleItemSerializer(many=True)
    payments = SalePaymentWriteSerializer(many=True)
    actor_name = serializers.SerializerMethodField(read_only=True)
    item_count = serializers.SerializerMethodField(read_only=True)
    payment_count = serializers.SerializerMethodField(read_only=True)
    subtotal_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    amount_received = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    amount_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    sale_date = serializers.DateField(required=False)
    occurred_at = serializers.DateTimeField(required=False)

    class Meta:
        model = Sale
        fields = (
            "id",
            "receipt_number",
            "customer_id",
            "customer_name",
            "customer_phone",
            "subtotal_amount",
            "discount_amount",
            "total_amount",
            "amount_received",
            "amount_due",
            "payment_mode",
            "footer_note",
            "note",
            "sale_date",
            "occurred_at",
            "status",
            "tombstone",
            "source_meta_json",
            "actor_name",
            "item_count",
            "payment_count",
            "items",
            "payments",
        )
        read_only_fields = (
            "id",
            "receipt_number",
            "payment_mode",
            "amount_received",
            "amount_due",
            "status",
            "tombstone",
            "actor_name",
            "item_count",
            "payment_count",
        )

    def get_actor_name(self, obj):
        if obj.actor_user_id and obj.actor_user.full_name:
            return obj.actor_user.full_name
        if obj.actor_user_id:
            return obj.actor_user.email
        return None

    def get_item_count(self, obj):
        prefetched = getattr(obj, "_prefetched_objects_cache", {})
        if "items" in prefetched:
            return sum(item.quantity for item in prefetched["items"])
        return sum(obj.items.values_list("quantity", flat=True))

    def get_payment_count(self, obj):
        prefetched = getattr(obj, "_prefetched_objects_cache", {})
        if "payments" in prefetched:
            return len(prefetched["payments"])
        return obj.payments.count()

    def validate(self, attrs):
        items = attrs.get("items") or []
        payments = attrs.get("payments") or []
        discount_amount = attrs.get("discount_amount", Decimal("0.00"))
        declared_subtotal = attrs.get("subtotal_amount")
        declared_total = attrs.get("total_amount")

        if not items:
            raise serializers.ValidationError({"items": "At least one sale item is required."})
        if not payments:
            raise serializers.ValidationError({"payments": "At least one payment is required."})

        computed_subtotal = Decimal("0.00")
        total_paid = Decimal("0.00")

        for item in items:
            quantity = item.get("quantity", 0)
            if quantity <= 0:
                raise serializers.ValidationError({"items": "Each sale item must have a positive quantity."})
            unit_price = item.get("unit_price") or Decimal("0.00")
            computed_subtotal += Decimal(quantity) * unit_price

        for payment in payments:
            amount = payment.get("amount") or Decimal("0.00")
            if amount <= 0:
                raise serializers.ValidationError({"payments": "Each payment amount must be positive."})
            total_paid += amount

        if declared_subtotal is not None and declared_subtotal != computed_subtotal:
            raise serializers.ValidationError(
                {"subtotal_amount": f"Subtotal must match item totals ({computed_subtotal})."}
            )

        expected_total = computed_subtotal - discount_amount
        if expected_total < Decimal("0.00"):
            raise serializers.ValidationError({"discount_amount": "Discount cannot exceed subtotal."})

        if declared_total is not None and declared_total != expected_total:
            raise serializers.ValidationError({"total_amount": f"Total must equal subtotal minus discount ({expected_total})."})

        if total_paid > expected_total:
            raise serializers.ValidationError({"payments": "Payments cannot exceed the sale total in phase 1."})

        attrs["_computed_subtotal"] = computed_subtotal
        attrs["_computed_total"] = expected_total
        attrs["_computed_paid"] = total_paid
        attrs["_computed_due"] = expected_total - total_paid
        return attrs

    def _resolve_inventory_item(self, shop, item_payload):
        inventory_item_id = item_payload.get("inventory_item_id")
        if not inventory_item_id:
            return None
        try:
            return InventoryItem.objects.select_related("private").get(
                pk=inventory_item_id,
                shop=shop,
                tombstone=False,
            )
        except InventoryItem.DoesNotExist as exc:
            raise serializers.ValidationError({"items": f"Inventory item {inventory_item_id} is not available in this shop."}) from exc

    def _resolve_customer(self, shop, customer_id):
        if not customer_id:
            return None
        try:
            return Customer.objects.get(pk=customer_id, shop=shop, tombstone=False)
        except Customer.DoesNotExist as exc:
            raise serializers.ValidationError({"customer_id": "Customer is not available in this shop."}) from exc

    @transaction.atomic
    def create(self, validated_data):
        item_payloads = validated_data.pop("items")
        payment_payloads = validated_data.pop("payments")
        computed_subtotal = validated_data.pop("_computed_subtotal")
        computed_total = validated_data.pop("_computed_total")
        computed_paid = validated_data.pop("_computed_paid")
        computed_due = validated_data.pop("_computed_due")

        shop = self.context["shop"]
        actor = self.context["actor"]
        customer = self._resolve_customer(shop, validated_data.pop("customer_id", None))

        sale_date = validated_data.get("sale_date") or timezone.localdate()
        occurred_at = validated_data.get("occurred_at") or timezone.now()
        validated_data["sale_date"] = sale_date
        validated_data["occurred_at"] = occurred_at

        customer_name_snapshot = validated_data.pop("customer_name_snapshot", "")
        customer_phone_snapshot = validated_data.pop("customer_phone_snapshot", "")
        if customer is not None:
            customer_name_snapshot = customer_name_snapshot or customer.name
            customer_phone_snapshot = customer_phone_snapshot or customer.phone

        payment_mode = payment_payloads[0]["payment_method"] if len(payment_payloads) == 1 else Sale.PaymentMode.SPLIT

        sale = Sale.objects.create(
            shop=shop,
            actor_user=actor,
            customer=customer,
            customer_name_snapshot=customer_name_snapshot,
            customer_phone_snapshot=customer_phone_snapshot,
            subtotal_amount=computed_subtotal,
            total_amount=computed_total,
            amount_received=computed_paid,
            amount_due=computed_due,
            payment_mode=payment_mode,
            **validated_data,
        )
        sale.receipt_number = sale.receipt_number or f"S-{str(sale.id).replace('-', '')[:8].upper()}"
        sale.save(update_fields=["receipt_number", "updated_at"])

        for item_payload in item_payloads:
            inventory_item = self._resolve_inventory_item(shop, item_payload)
            quantity = item_payload["quantity"]
            unit_price = item_payload["unit_price"]
            unit_cost = item_payload.get("unit_cost")

            if inventory_item is not None:
                item_name = item_payload.get("name_snapshot") or inventory_item.name
                sku_snapshot = item_payload.get("sku_snapshot") or inventory_item.sku
                size_snapshot = item_payload.get("size_snapshot") or inventory_item.size
                if unit_cost is None and hasattr(inventory_item, "private") and not inventory_item.private.tombstone:
                    unit_cost = inventory_item.private.cost_price
            else:
                item_name = item_payload.get("name_snapshot") or ""
                sku_snapshot = item_payload.get("sku_snapshot") or ""
                size_snapshot = item_payload.get("size_snapshot") or ""
                if not item_name:
                    raise serializers.ValidationError({"items": "Non-catalog items must include a name."})

            sale_item = SaleItem.objects.create(
                sale=sale,
                inventory_item=inventory_item,
                name_snapshot=item_name,
                sku_snapshot=sku_snapshot,
                size_snapshot=size_snapshot,
                quantity=quantity,
                unit_price=unit_price,
                unit_cost=unit_cost,
                line_total=Decimal(quantity) * unit_price,
                is_return=item_payload.get("is_return", False),
                source_system=sale.source_system,
                source_shop_id=sale.source_shop_id,
                source_path=f"sales/{sale.id}/items",
                domain_epoch=sale.domain_epoch,
            )

            if inventory_item is not None:
                InventoryStockLedger.objects.create(
                    shop=shop,
                    item=inventory_item,
                    actor_user=actor,
                    event_type=(
                        InventoryStockLedger.EventType.RETURN
                        if sale_item.is_return
                        else InventoryStockLedger.EventType.SALE
                    ),
                    quantity_delta=quantity if sale_item.is_return else -quantity,
                    unit_cost=unit_cost,
                    unit_price=unit_price,
                    note=f"Sale {sale.receipt_number}",
                    occurred_at=occurred_at,
                    source_system=sale.source_system,
                    source_id=str(sale.id),
                    source_shop_id=sale.source_shop_id,
                    source_path=f"sales/{sale.id}/items/{sale_item.id}",
                    domain_epoch=sale.domain_epoch,
                )

        for payment_payload in payment_payloads:
            SalePayment.objects.create(
                sale=sale,
                shop=shop,
                actor_user=actor,
                occurred_at=occurred_at,
                source_system=sale.source_system,
                source_id=str(sale.id),
                source_shop_id=sale.source_shop_id,
                source_path=f"sales/{sale.id}/payments",
                domain_epoch=sale.domain_epoch,
                **payment_payload,
            )

        if customer is not None:
            CustomerLedgerEntry.objects.create(
                shop=shop,
                customer=customer,
                actor_user=actor,
                event_type=CustomerLedgerEntry.EventType.SALE,
                amount_delta=computed_due,
                total_spent_delta=computed_total,
                note=f"Sale {sale.receipt_number}",
                occurred_at=occurred_at,
                source_system=sale.source_system,
                source_id=str(sale.id),
                source_shop_id=sale.source_shop_id,
                source_path=f"sales/{sale.id}",
                domain_epoch=sale.domain_epoch,
            )
            customer.balance = customer.balance + computed_due
            customer.total_spent = customer.total_spent + computed_total
            customer.save(update_fields=["balance", "total_spent", "updated_at"])

        return sale
