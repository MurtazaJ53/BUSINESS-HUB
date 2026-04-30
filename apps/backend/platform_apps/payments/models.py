from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from platform_apps.common.models import SourceTrackedModel
from platform_apps.shops.models import Shop


class SalePayment(SourceTrackedModel):
    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"
        UPI = "UPI", "UPI"
        BANK = "BANK", "Bank"
        CARD = "CARD", "Card"
        CREDIT = "CREDIT", "Credit"
        OTHER = "OTHER", "Other"

    sale = models.ForeignKey("sales.Sale", on_delete=models.CASCADE, related_name="payments")
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="sale_payments")
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="sale_payments_authored",
        blank=True,
        null=True,
    )
    payment_method = models.CharField(max_length=16, choices=PaymentMethod.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    reference_code = models.CharField(max_length=128, blank=True)
    note = models.TextField(blank=True)
    occurred_at = models.DateTimeField()

    class Meta:
        ordering = ["-occurred_at", "-created_at"]
        indexes = [
            models.Index(fields=["shop", "occurred_at"]),
            models.Index(fields=["sale", "occurred_at"]),
            models.Index(fields=["shop", "payment_method"]),
        ]

    def __str__(self) -> str:
        return f"{self.payment_method} {self.amount}"
