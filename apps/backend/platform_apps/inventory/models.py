from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from platform_apps.common.managers import TenantAwareManager
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
    # GST (India). hsn_code = Harmonized System of Nomenclature / SAC for services.
    # gst_rate is the combined percentage (e.g. 18.00); intra-state splits into
    # CGST+SGST, inter-state uses IGST — resolved at sale time from place of supply.
    hsn_code = models.CharField(max_length=16, blank=True)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    price_includes_tax = models.BooleanField(default=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    tombstone = models.BooleanField(default=False)
    source_meta_json = models.JSONField(default=dict, blank=True)
    # Product photo as a base64 data URI. Stored in the DB (not MEDIA_ROOT)
    # because the single-node Docker deploy only persists the database volume —
    # files written into the container are lost on every redeploy. Clients send
    # a downscaled/compressed copy, so rows stay small.
    image_data = models.TextField(blank=True)

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
        PURCHASE = "purchase", "Purchase"
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
    quantity_delta = models.DecimalField(max_digits=12, decimal_places=3)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    note = models.TextField(blank=True)
    occurred_at = models.DateTimeField()

    # Auto-scopes reads to the current shop when a Celery TenantTask is running;
    # a no-op in HTTP/admin/tests. Defense against a background job forgetting
    # an explicit shop filter on this aggregation-heavy ledger.
    objects = TenantAwareManager()

    class Meta:
        ordering = ["-occurred_at", "-created_at"]
        indexes = [
            models.Index(fields=["shop", "occurred_at"]),
            models.Index(fields=["item", "occurred_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.item.name}: {self.quantity_delta}"
