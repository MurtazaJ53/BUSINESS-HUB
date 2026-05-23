from __future__ import annotations

from decimal import Decimal

from django.db import models

from platform_apps.common.models import UUIDStampedModel
from platform_apps.inventory.models import InventoryItem
from platform_apps.shops.models import Shop


class ShopDashboardSnapshot(UUIDStampedModel):
    shop = models.OneToOneField(Shop, on_delete=models.CASCADE, related_name="dashboard_snapshot")
    inventory_items_count = models.PositiveIntegerField(default=0)
    active_inventory_items_count = models.PositiveIntegerField(default=0)
    category_count = models.PositiveIntegerField(default=0)
    low_stock_items_count = models.PositiveIntegerField(default=0)
    out_of_stock_items_count = models.PositiveIntegerField(default=0)
    projected_sell_value = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    customer_count = models.PositiveIntegerField(default=0)
    active_credit_customers_count = models.PositiveIntegerField(default=0)
    total_outstanding_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_lifetime_spend = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    sales_count = models.PositiveIntegerField(default=0)
    gross_revenue = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    outstanding_revenue = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    payment_count = models.PositiveIntegerField(default=0)
    total_collected = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    credit_payment_count = models.PositiveIntegerField(default=0)
    digital_payment_count = models.PositiveIntegerField(default=0)
    last_sale_at = models.DateTimeField(blank=True, null=True)
    refreshed_at = models.DateTimeField()
    metadata_json = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["refreshed_at"]),
        ]

    def __str__(self) -> str:
        return f"DashboardSnapshot<{self.shop.name}>"


class ShopLowStockSnapshot(UUIDStampedModel):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="low_stock_snapshots")
    dashboard_snapshot = models.ForeignKey(
        ShopDashboardSnapshot,
        on_delete=models.CASCADE,
        related_name="low_stock_preview",
    )
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.SET_NULL,
        related_name="low_stock_snapshots",
        blank=True,
        null=True,
    )
    item_name = models.CharField(max_length=255)
    sku = models.CharField(max_length=128, blank=True)
    category = models.CharField(max_length=120, blank=True)
    stock_on_hand = models.IntegerField(default=0)
    sell_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    severity_rank = models.PositiveIntegerField(default=0)
    refreshed_at = models.DateTimeField()

    class Meta:
        ordering = ["severity_rank", "stock_on_hand", "item_name"]
        indexes = [
            models.Index(fields=["shop", "severity_rank"]),
            models.Index(fields=["dashboard_snapshot", "severity_rank"]),
        ]

    def __str__(self) -> str:
        return f"LowStock<{self.item_name}>"


class ShopPulseSignal(UUIDStampedModel):
    class SignalKind(models.TextChoices):
        TASK = "task", "Task"
        ANOMALY = "anomaly", "Anomaly"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        ACKNOWLEDGED = "acknowledged", "Acknowledged"
        RESOLVED = "resolved", "Resolved"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="pulse_signals")
    signal_kind = models.CharField(max_length=16, choices=SignalKind.choices)
    code = models.CharField(max_length=64)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    signal_level = models.CharField(max_length=16, blank=True)
    signal_rank = models.PositiveIntegerField(default=0)
    tone = models.CharField(max_length=16, blank=True)
    title = models.CharField(max_length=255)
    body = models.TextField()
    route = models.CharField(max_length=128, blank=True)
    cta_label = models.CharField(max_length=64, blank=True)
    metric_value = models.CharField(max_length=64, blank=True)
    count = models.PositiveIntegerField(default=0)
    first_detected_at = models.DateTimeField()
    last_detected_at = models.DateTimeField()
    last_snapshot_refreshed_at = models.DateTimeField()
    acknowledged_at = models.DateTimeField(blank=True, null=True)
    acknowledged_by_user = models.ForeignKey(
        "users.PlatformUser",
        on_delete=models.SET_NULL,
        related_name="acknowledged_pulse_signals",
        blank=True,
        null=True,
    )
    resolved_at = models.DateTimeField(blank=True, null=True)
    resolved_by_user = models.ForeignKey(
        "users.PlatformUser",
        on_delete=models.SET_NULL,
        related_name="resolved_pulse_signals",
        blank=True,
        null=True,
    )
    resolution_note = models.TextField(blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["status", "-signal_rank", "-last_detected_at", "title"]
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "signal_kind", "code"],
                name="uniq_shop_pulse_signal",
            )
        ]
        indexes = [
            models.Index(fields=["shop", "status", "signal_kind"]),
            models.Index(fields=["shop", "last_detected_at"]),
            models.Index(fields=["shop", "signal_rank"]),
        ]

    def __str__(self) -> str:
        return f"{self.shop.name}:{self.signal_kind}:{self.code}:{self.status}"
