from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from platform_apps.common.models import SourceTrackedModel
from platform_apps.shops.models import Shop


class Customer(SourceTrackedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="customers")
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, blank=True, default="-")
    email = models.EmailField(blank=True)
    total_spent = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    tombstone = models.BooleanField(default=False)
    source_meta_json = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["shop", "name"]),
            models.Index(fields=["shop", "phone"]),
            models.Index(fields=["shop", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.shop.name})"


class CustomerLedgerEntry(SourceTrackedModel):
    class EventType(models.TextChoices):
        OPENING_BALANCE = "opening_balance", "Opening balance"
        SALE = "sale", "Sale"
        PAYMENT = "payment", "Payment"
        ADJUSTMENT = "adjustment", "Adjustment"
        IMPORT = "import", "Import"
        SYNC = "sync", "Sync"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="customer_ledger_entries")
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="ledger_entries")
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="customer_ledger_events",
        blank=True,
        null=True,
    )
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    amount_delta = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_spent_delta = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    note = models.TextField(blank=True)
    occurred_at = models.DateTimeField()

    class Meta:
        ordering = ["-occurred_at", "-created_at"]
        indexes = [
            models.Index(fields=["shop", "occurred_at"]),
            models.Index(fields=["customer", "occurred_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.customer.name}: {self.amount_delta}"
