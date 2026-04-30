from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from platform_apps.common.models import SourceTrackedModel
from platform_apps.shops.models import Shop


class InventoryItem(SourceTrackedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"
        DRAFT = "draft", "Draft"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="inventory_items")
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=128, blank=True)
    barcode = models.CharField(max_length=128, blank=True)
    category = models.CharField(max_length=120, blank=True)
    subcategory = models.CharField(max_length=120, blank=True)
    size = models.CharField(max_length=64, blank=True)
    description = models.TextField(blank=True)
    sell_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    tombstone = models.BooleanField(default=False)
    source_meta_json = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["shop", "name"]),
            models.Index(fields=["shop", "sku"]),
            models.Index(fields=["shop", "category"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.shop.name})"


class InventoryItemPrivate(SourceTrackedModel):
    item = models.OneToOneField(InventoryItem, on_delete=models.CASCADE, related_name="private")
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    supplier_id = models.CharField(max_length=128, blank=True)
    last_purchase_date = models.DateField(blank=True, null=True)
    tombstone = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f"Private<{self.item.name}>"


class InventoryStockLedger(SourceTrackedModel):
    class EventType(models.TextChoices):
        OPENING_BALANCE = "opening_balance", "Opening balance"
        ADJUSTMENT = "adjustment", "Adjustment"
        SALE = "sale", "Sale"
        RETURN = "return", "Return"
        IMPORT = "import", "Import"
        SYNC = "sync", "Sync"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="inventory_stock_ledger")
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="ledger_entries")
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="stock_events",
        blank=True,
        null=True,
    )
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    quantity_delta = models.IntegerField()
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    note = models.TextField(blank=True)
    occurred_at = models.DateTimeField()

    class Meta:
        ordering = ["-occurred_at", "-created_at"]
        indexes = [
            models.Index(fields=["shop", "occurred_at"]),
            models.Index(fields=["item", "occurred_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.item.name}: {self.quantity_delta}"
