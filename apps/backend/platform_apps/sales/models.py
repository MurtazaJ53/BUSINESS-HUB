from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from platform_apps.common.models import SourceTrackedModel
from platform_apps.common.models import UUIDStampedModel
from platform_apps.customers.models import Customer
from platform_apps.inventory.models import InventoryItem
from platform_apps.shops.models import Shop


class Sale(SourceTrackedModel):
    class Status(models.TextChoices):
        COMPLETED = "completed", "Completed"
        VOID = "void", "Void"

    class PaymentMode(models.TextChoices):
        CASH = "CASH", "Cash"
        UPI = "UPI", "UPI"
        BANK = "BANK", "Bank"
        CARD = "CARD", "Card"
        CREDIT = "CREDIT", "Credit"
        OTHER = "OTHER", "Other"
        SPLIT = "SPLIT", "Split"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="sales")
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="sales_authored",
        blank=True,
        null=True,
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        related_name="sales",
        blank=True,
        null=True,
    )
    receipt_number = models.CharField(max_length=48, blank=True)
    subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    amount_received = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    amount_due = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    payment_mode = models.CharField(max_length=16, choices=PaymentMode.choices, default=PaymentMode.CASH)
    customer_name_snapshot = models.CharField(max_length=255, blank=True)
    customer_phone_snapshot = models.CharField(max_length=32, blank=True)
    footer_note = models.TextField(blank=True)
    note = models.TextField(blank=True)
    sale_date = models.DateField()
    occurred_at = models.DateTimeField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.COMPLETED)
    tombstone = models.BooleanField(default=False)
    source_meta_json = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-sale_date", "-occurred_at", "-created_at"]
        indexes = [
            models.Index(fields=["shop", "sale_date"]),
            models.Index(fields=["shop", "status"]),
            models.Index(fields=["customer", "sale_date"]),
            models.Index(fields=["shop", "receipt_number"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "receipt_number"],
                condition=models.Q(tombstone=False) & ~models.Q(receipt_number=""),
                name="unique_shop_receipt_number",
            )
        ]

    def __str__(self) -> str:
        return self.receipt_number or f"Sale<{self.pk}>"


class SaleItem(SourceTrackedModel):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.SET_NULL,
        related_name="sale_items",
        blank=True,
        null=True,
    )
    name_snapshot = models.CharField(max_length=255)
    sku_snapshot = models.CharField(max_length=128, blank=True)
    size_snapshot = models.CharField(max_length=64, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    is_return = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=["sale"]),
            models.Index(fields=["inventory_item"]),
        ]

    def __str__(self) -> str:
        return f"{self.name_snapshot} x{self.quantity}"


class SaleCommandReceipt(UUIDStampedModel):
    class ResultStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"

    shop = models.ForeignKey(
        Shop,
        on_delete=models.CASCADE,
        related_name="sale_command_receipts",
    )
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="sale_command_receipts",
        blank=True,
        null=True,
    )
    sale = models.OneToOneField(
        Sale,
        on_delete=models.SET_NULL,
        related_name="command_receipt",
        blank=True,
        null=True,
    )
    command_id = models.CharField(max_length=128)
    source_surface = models.CharField(max_length=64, blank=True)
    base_domain_epoch = models.PositiveIntegerField(default=1)
    result_status = models.CharField(
        max_length=16,
        choices=ResultStatus.choices,
        default=ResultStatus.PENDING,
    )
    payload_json = models.JSONField(default=dict, blank=True)
    applied_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-applied_at", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "command_id"],
                name="uniq_sale_command_receipt_per_shop",
            )
        ]
        indexes = [
            models.Index(fields=["shop", "applied_at"]),
            models.Index(fields=["shop", "result_status"]),
        ]

    def __str__(self) -> str:
        return f"{self.shop.name}:{self.command_id}"
