from __future__ import annotations

from django.db import models

from platform_apps.common.models import UUIDStampedModel
from platform_apps.shops.models import Shop


class ERPNextShopBinding(UUIDStampedModel):
    class Environment(models.TextChoices):
        SANDBOX = "sandbox", "Sandbox"
        LIVE = "live", "Live"

    class HealthStatus(models.TextChoices):
        UNKNOWN = "unknown", "Unknown"
        OK = "ok", "OK"
        DEGRADED = "degraded", "Degraded"
        ERROR = "error", "Error"
        MISCONFIGURED = "misconfigured", "Misconfigured"

    shop = models.OneToOneField(Shop, on_delete=models.CASCADE, related_name="erpnext_binding")
    is_enabled = models.BooleanField(default=False)
    environment = models.CharField(max_length=16, choices=Environment.choices, default=Environment.SANDBOX)
    site_url_override = models.URLField(blank=True)
    company = models.CharField(max_length=255, blank=True)
    warehouse = models.CharField(max_length=255, blank=True)
    selling_price_list = models.CharField(max_length=255, blank=True)
    cost_center = models.CharField(max_length=255, blank=True)
    customer_group = models.CharField(max_length=255, blank=True)
    supplier_group = models.CharField(max_length=255, blank=True)
    currency_code = models.CharField(max_length=8, default="INR")
    item_sync_enabled = models.BooleanField(default=True)
    customer_sync_enabled = models.BooleanField(default=True)
    stock_sync_enabled = models.BooleanField(default=True)
    sales_posting_enabled = models.BooleanField(default=True)
    payment_posting_enabled = models.BooleanField(default=True)
    purchase_sync_enabled = models.BooleanField(default=False)
    metadata_json = models.JSONField(default=dict, blank=True)
    last_verified_at = models.DateTimeField(blank=True, null=True)
    last_health_status = models.CharField(
        max_length=16,
        choices=HealthStatus.choices,
        default=HealthStatus.UNKNOWN,
    )
    last_error_message = models.TextField(blank=True)
    last_health_payload_json = models.JSONField(default=dict, blank=True)

    def __str__(self) -> str:
        return f"ERPNext binding<{self.shop.slug}>"


class ERPNextSyncCursor(UUIDStampedModel):
    class Domain(models.TextChoices):
        ITEMS = "items", "Items"
        CUSTOMERS = "customers", "Customers"
        STOCK = "stock", "Stock"
        SALES = "sales", "Sales"
        PAYMENTS = "payments", "Payments"
        SUPPLIERS = "suppliers", "Suppliers"
        PURCHASES = "purchases", "Purchases"

    class Direction(models.TextChoices):
        PULL = "pull", "Pull"
        PUSH = "push", "Push"

    class Status(models.TextChoices):
        IDLE = "idle", "Idle"
        RUNNING = "running", "Running"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="erpnext_sync_cursors")
    domain = models.CharField(max_length=24, choices=Domain.choices)
    direction = models.CharField(max_length=16, choices=Direction.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.IDLE)
    last_remote_modified_at = models.DateTimeField(blank=True, null=True)
    last_remote_cursor = models.CharField(max_length=255, blank=True)
    last_started_at = models.DateTimeField(blank=True, null=True)
    last_finished_at = models.DateTimeField(blank=True, null=True)
    last_result_count = models.PositiveIntegerField(default=0)
    last_error_message = models.TextField(blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "domain", "direction"],
                name="erpnext_unique_cursor_per_shop_domain_direction",
            )
        ]
        ordering = ["domain", "direction"]

    def __str__(self) -> str:
        return f"ERPNext cursor<{self.shop.slug}:{self.domain}:{self.direction}>"


class ERPNextDocumentLink(UUIDStampedModel):
    class LocalDomain(models.TextChoices):
        ITEM = "item", "Item"
        CUSTOMER = "customer", "Customer"
        SALE = "sale", "Sale"
        PAYMENT = "payment", "Payment"
        PURCHASE = "purchase", "Purchase"

    class Direction(models.TextChoices):
        PULL = "pull", "Pull"
        PUSH = "push", "Push"

    class SyncStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        LINKED = "linked", "Linked"
        FAILED = "failed", "Failed"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="erpnext_document_links")
    local_domain = models.CharField(max_length=24, choices=LocalDomain.choices)
    local_object_id = models.CharField(max_length=64)
    remote_doctype = models.CharField(max_length=120)
    remote_name = models.CharField(max_length=255)
    direction = models.CharField(max_length=16, choices=Direction.choices)
    sync_status = models.CharField(max_length=16, choices=SyncStatus.choices, default=SyncStatus.PENDING)
    last_synced_at = models.DateTimeField(blank=True, null=True)
    last_error_message = models.TextField(blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "local_domain", "local_object_id", "remote_doctype"],
                name="erpnext_unique_local_to_remote_link",
            )
        ]
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return f"ERPNext link<{self.local_domain}:{self.local_object_id}->{self.remote_doctype}:{self.remote_name}>"

