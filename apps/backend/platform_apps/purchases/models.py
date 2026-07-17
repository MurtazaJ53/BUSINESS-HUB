from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from platform_apps.common.models import SourceTrackedModel
from platform_apps.inventory.models import InventoryItem
from platform_apps.shops.models import Shop


class Supplier(SourceTrackedModel):
    """A vendor the shop buys stock from. ``balance`` is money the shop *owes*
    the supplier (accounts payable): a credit purchase increases it, a payment
    to the supplier decreases it."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="suppliers")
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    gstin = models.CharField(max_length=15, blank=True)
    address = models.TextField(blank=True)
    # Accounts payable: what the shop currently owes this supplier.
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_purchased = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    tombstone = models.BooleanField(default=False)
    source_meta_json = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["shop", "name"]),
            models.Index(fields=["shop", "status"]),
            models.Index(fields=["shop", "phone"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.shop.name})"


class Purchase(SourceTrackedModel):
    """A goods-received / purchase invoice from a supplier. Creating one posts
    stock into the inventory ledger and (for the unpaid portion) into the
    supplier's payables ledger."""

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

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="purchases")
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        related_name="purchases",
        blank=True,
        null=True,
    )
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="purchases_authored",
        blank=True,
        null=True,
    )
    # The supplier's own bill / invoice number, plus a free reference.
    invoice_number = models.CharField(max_length=64, blank=True)
    reference = models.CharField(max_length=64, blank=True)
    supplier_name_snapshot = models.CharField(max_length=255, blank=True)
    subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    amount_due = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    payment_mode = models.CharField(max_length=16, choices=PaymentMode.choices, default=PaymentMode.CASH)
    note = models.TextField(blank=True)
    purchase_date = models.DateField()
    occurred_at = models.DateTimeField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.COMPLETED)
    tombstone = models.BooleanField(default=False)

    class Meta:
        ordering = ["-purchase_date", "-created_at"]
        indexes = [
            models.Index(fields=["shop", "purchase_date"]),
            models.Index(fields=["shop", "status"]),
            models.Index(fields=["supplier", "purchase_date"]),
        ]

    def __str__(self) -> str:
        return f"Purchase {self.invoice_number or self.id} ({self.shop.name})"


class PurchaseItem(SourceTrackedModel):
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name="items")
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.SET_NULL,
        related_name="purchase_items",
        blank=True,
        null=True,
    )
    name_snapshot = models.CharField(max_length=255)
    sku_snapshot = models.CharField(max_length=128, blank=True)
    # Received quantity supports fractional (by-weight) goods, mirroring sales.
    quantity = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("1"))
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    def __str__(self) -> str:
        return f"{self.name_snapshot} x{self.quantity}"


class SupplierLedgerEntry(SourceTrackedModel):
    """Accounts-payable timeline for a supplier: purchases increase what is
    owed, payments reduce it."""

    class EventType(models.TextChoices):
        OPENING_BALANCE = "opening_balance", "Opening balance"
        PURCHASE = "purchase", "Purchase"
        PAYMENT = "payment", "Payment"
        ADJUSTMENT = "adjustment", "Adjustment"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="supplier_ledger_entries")
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name="ledger_entries")
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="supplier_ledger_events",
        blank=True,
        null=True,
    )
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    # Positive increases payable (a credit purchase); negative reduces it (a payment).
    amount_delta = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    note = models.TextField(blank=True)
    occurred_at = models.DateTimeField()

    class Meta:
        ordering = ["-occurred_at", "-created_at"]
        indexes = [
            models.Index(fields=["shop", "occurred_at"]),
            models.Index(fields=["supplier", "occurred_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.supplier.name}: {self.amount_delta}"
