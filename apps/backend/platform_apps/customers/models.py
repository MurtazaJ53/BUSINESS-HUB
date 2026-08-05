from __future__ import annotations

from django_cryptography.fields import encrypt
from decimal import Decimal

from django.conf import settings
from django.db import models

from platform_apps.common.blind_index import generate_blind_index
from platform_apps.common.models import SourceTrackedModel
from platform_apps.shops.models import Shop


class Customer(SourceTrackedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="customers")
    name = models.CharField(max_length=255)
    phone = encrypt(models.CharField(max_length=32, blank=True, default="-"))
    email = encrypt(models.EmailField(blank=True))
    # Blind index: keyed hash of the (digits-only) phone so a cashier can look a
    # customer up by number WITHOUT decrypting every row. The encrypted `phone`
    # stays the source of truth.
    phone_hash = models.CharField(max_length=64, blank=True, default="", db_index=False)
    total_spent = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    # Loyalty points currently available to redeem. Whole points only: fractional
    # points confuse customers and invite rounding disputes at the counter.
    loyalty_points = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    # When this customer was last chased for an outstanding balance. Shared
    # across devices on purpose: the owner on the web and the cashier on the
    # phone must not both nudge the same person on the same day.
    last_reminded_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    tombstone = models.BooleanField(default=False)
    source_meta_json = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["shop", "name"]),
            # Search by the blind index, not the (unsearchable) encrypted phone.
            models.Index(fields=["shop", "phone_hash"]),
            models.Index(fields=["shop", "status"]),
        ]

    def save(self, *args, **kwargs):
        # Keep the blind index in step with the phone on every write.
        self.phone_hash = generate_blind_index(self.phone)
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and "phone" in update_fields and "phone_hash" not in update_fields:
            kwargs["update_fields"] = list(update_fields) + ["phone_hash"]
        super().save(*args, **kwargs)

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


class LoyaltyLedgerEntry(SourceTrackedModel):
    """Every point earned or spent, so a disputed balance can be explained.

    A bare points number on a customer record is impossible to defend when a
    shopper says "I had more than that" — this is the audit trail.
    """

    class EventType(models.TextChoices):
        EARNED = "earned", "Earned"
        REDEEMED = "redeemed", "Redeemed"
        ADJUSTMENT = "adjustment", "Adjustment"
        EXPIRED = "expired", "Expired"

    shop = models.ForeignKey(
        Shop, on_delete=models.CASCADE, related_name="loyalty_entries"
    )
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name="loyalty_entries"
    )
    event_type = models.CharField(max_length=16, choices=EventType.choices)
    # Negative when spent, positive when earned.
    points_delta = models.IntegerField()
    balance_after = models.PositiveIntegerField(default=0)
    note = models.CharField(max_length=280, blank=True)
    sale_id = models.UUIDField(null=True, blank=True)
    occurred_at = models.DateTimeField()

    class Meta:
        ordering = ("-occurred_at", "-created_at")
        indexes = [models.Index(fields=["shop", "customer"])]

    def __str__(self) -> str:
        return f"{self.customer} {self.points_delta:+d} pts"
