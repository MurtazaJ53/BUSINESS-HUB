from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from platform_apps.common.migration import MigrationDomain, ReconciliationSeverity, ReconciliationStatus
from platform_apps.common.models import UUIDStampedModel
from platform_apps.shops.models import Shop


class MigrationReconciliationEvent(UUIDStampedModel):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="migration_reconciliation_events")
    domain = models.CharField(max_length=64, choices=MigrationDomain.choices)
    severity = models.CharField(
        max_length=16,
        choices=ReconciliationSeverity.choices,
        default=ReconciliationSeverity.WARNING,
    )
    status = models.CharField(
        max_length=16,
        choices=ReconciliationStatus.choices,
        default=ReconciliationStatus.OPEN,
    )
    issue_code = models.CharField(max_length=64)
    entity_type = models.CharField(max_length=64)
    entity_id = models.CharField(max_length=128, blank=True)
    source_reference = models.CharField(max_length=255, blank=True)
    expected_master = models.CharField(max_length=32, blank=True)
    observed_source = models.CharField(max_length=32, blank=True)
    occurred_at = models.DateTimeField()
    mismatch_payload_json = models.JSONField(default=dict, blank=True)
    note = models.TextField(blank=True)
    resolver_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="resolved_migration_events",
        blank=True,
        null=True,
    )
    resolved_at = models.DateTimeField(blank=True, null=True)
    resolution_note = models.TextField(blank=True)

    class Meta:
        ordering = ["-occurred_at", "-created_at"]
        indexes = [
            models.Index(fields=["shop", "domain"]),
            models.Index(fields=["status", "severity"]),
            models.Index(fields=["issue_code", "occurred_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.domain}:{self.issue_code}:{self.status}"


class WorkspaceAuditEvent(UUIDStampedModel):
    class Category(models.TextChoices):
        WORKSPACE = "workspace", "Workspace"
        INVENTORY = "inventory", "Inventory"
        CUSTOMER = "customer", "Customer"
        SALE = "sale", "Sale"
        PAYMENT = "payment", "Payment"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="audit_events")
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="workspace_audit_events",
        blank=True,
        null=True,
    )
    actor_role = models.CharField(max_length=16, blank=True)
    category = models.CharField(max_length=32, choices=Category.choices)
    event_type = models.CharField(max_length=64)
    entity_type = models.CharField(max_length=64)
    entity_id = models.CharField(max_length=128, blank=True)
    entity_label = models.CharField(max_length=255, blank=True)
    summary = models.TextField()
    source_surface = models.CharField(max_length=64, blank=True)
    before_json = models.JSONField(default=dict, blank=True)
    after_json = models.JSONField(default=dict, blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField()

    class Meta:
        ordering = ["-occurred_at", "-created_at"]
        indexes = [
            models.Index(fields=["shop", "occurred_at"]),
            models.Index(fields=["shop", "category", "occurred_at"]),
            models.Index(fields=["actor_user", "occurred_at"]),
            models.Index(fields=["event_type", "occurred_at"]),
        ]

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValidationError("Workspace audit events are append-only and cannot be modified.")
        return super().save(*args, **kwargs)

    def delete(self, using=None, keep_parents=False):
        raise ValidationError("Workspace audit events are append-only and cannot be deleted.")

    def __str__(self) -> str:
        return f"{self.shop_id}:{self.category}:{self.event_type}"
