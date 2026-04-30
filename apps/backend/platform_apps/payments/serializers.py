from __future__ import annotations

from rest_framework import serializers

from platform_apps.payments.models import SalePayment


class SalePaymentSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    receipt_number = serializers.CharField(source="sale.receipt_number", read_only=True)
    customer_name = serializers.CharField(source="sale.customer_name_snapshot", read_only=True)
    sale_total_amount = serializers.DecimalField(
        source="sale.total_amount",
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = SalePayment
        fields = (
            "id",
            "sale_id",
            "receipt_number",
            "customer_name",
            "sale_total_amount",
            "payment_method",
            "amount",
            "reference_code",
            "note",
            "occurred_at",
            "actor_name",
        )
        read_only_fields = fields

    def get_actor_name(self, obj):
        if obj.actor_user_id and obj.actor_user.full_name:
            return obj.actor_user.full_name
        if obj.actor_user_id:
            return obj.actor_user.email
        return None
