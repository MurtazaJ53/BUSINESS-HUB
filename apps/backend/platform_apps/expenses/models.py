from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from platform_apps.common.models import SourceTrackedModel
from platform_apps.shops.models import Shop


class Expense(SourceTrackedModel):
    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"
        UPI = "UPI", "UPI"
        BANK = "BANK", "Bank"
        CARD = "CARD", "Card"
        OTHER = "OTHER", "Other"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="expenses")
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="expense_entries",
        blank=True,
        null=True,
    )
    category = models.CharField(max_length=128)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    description = models.TextField(blank=True)
    payment_method = models.CharField(
        max_length=16,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CASH,
    )
    payment_reference = models.CharField(max_length=128, blank=True)
    expense_date = models.DateField()
    tombstone = models.BooleanField(default=False)

    class Meta:
        ordering = ["-expense_date", "-created_at"]
        indexes = [
            models.Index(fields=["shop", "expense_date"]),
            models.Index(fields=["shop", "category"]),
            models.Index(fields=["shop", "payment_method"]),
        ]

    def __str__(self) -> str:
        return f"{self.category}: {self.amount}"
