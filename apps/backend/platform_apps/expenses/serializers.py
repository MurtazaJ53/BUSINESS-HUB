from __future__ import annotations

from rest_framework import serializers

from platform_apps.expenses.models import Expense


class ExpenseSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Expense
        fields = (
            "id",
            "category",
            "amount",
            "description",
            "payment_method",
            "payment_reference",
            "expense_date",
            "tombstone",
            "actor_name",
        )
        read_only_fields = ("id", "actor_name", "tombstone")

    def get_actor_name(self, obj):
        if not obj.actor_user_id:
            return None
        return obj.actor_user.full_name or obj.actor_user.email

    def create(self, validated_data):
        return Expense.objects.create(
            shop=self.context["shop"],
            actor_user=self.context["actor"],
            **validated_data,
        )
