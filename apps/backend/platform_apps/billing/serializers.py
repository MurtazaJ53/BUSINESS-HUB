from __future__ import annotations

from rest_framework import serializers

from platform_apps.billing.models import Subscription, SubscriptionInvoice
from platform_apps.billing.pricing import PLAN_PRICING


class PlanOptionSerializer(serializers.Serializer):
    period = serializers.CharField()
    label = serializers.CharField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    days = serializers.IntegerField()
    effective_monthly = serializers.DecimalField(max_digits=10, decimal_places=2)
    savings_percent = serializers.IntegerField()


class SubscriptionSerializer(serializers.ModelSerializer):
    plan_tier = serializers.CharField(source="effective_plan_tier", read_only=True)
    days_remaining = serializers.IntegerField(read_only=True)
    has_paid_access = serializers.SerializerMethodField()
    access_until = serializers.DateTimeField(read_only=True)
    is_trial = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        fields = (
            "status",
            "plan_tier",
            "billing_period",
            "trial_ends_at",
            "current_period_start",
            "current_period_end",
            "access_until",
            "days_remaining",
            "has_paid_access",
            "is_trial",
        )

    def get_has_paid_access(self, obj) -> bool:
        return obj.has_paid_access()

    def get_is_trial(self, obj) -> bool:
        return obj.status == Subscription.Status.TRIALING


class SubscriptionInvoiceSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = SubscriptionInvoice
        fields = (
            "invoice_number",
            "billing_period",
            "amount",
            "currency",
            "status",
            "payment_url",
            "paid_at",
            "created_at",
        )


class CheckoutRequestSerializer(serializers.Serializer):
    billing_period = serializers.ChoiceField(choices=sorted(PLAN_PRICING.keys()))
