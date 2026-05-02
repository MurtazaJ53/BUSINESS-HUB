from __future__ import annotations

from django.conf import settings
from django.db import models

from platform_apps.common.migration import (
    MigrationBridgeMode,
    MigrationControlEventType,
    MigrationCutoverStatus,
    MigrationDomain,
    MigrationGoLiveCheckpointDecision,
    MigrationLaunchCheckpointDecision,
    MigrationPhaseCheckpointDecision,
    MigrationJobStatus,
    MigrationJobType,
    MigrationRolloutCheckpointDecision,
    MigrationShopCheckpointDecision,
    MigrationWriteMaster,
)
from platform_apps.common.models import UUIDStampedModel
from platform_apps.shops.models import Shop


class MigrationDomainControl(UUIDStampedModel):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="migration_controls")
    domain = models.CharField(max_length=64, choices=MigrationDomain.choices)
    write_master = models.CharField(
        max_length=16,
        choices=MigrationWriteMaster.choices,
        default=MigrationWriteMaster.FIREBASE,
    )
    bridge_mode = models.CharField(
        max_length=24,
        choices=MigrationBridgeMode.choices,
        default=MigrationBridgeMode.DISABLED,
    )
    cutover_status = models.CharField(
        max_length=24,
        choices=MigrationCutoverStatus.choices,
        default=MigrationCutoverStatus.LEGACY,
    )
    current_epoch = models.PositiveIntegerField(default=1)
    shadow_reads_enabled = models.BooleanField(default=False)
    is_enabled = models.BooleanField(default=True)
    last_backfill_at = models.DateTimeField(blank=True, null=True)
    last_shadow_verified_at = models.DateTimeField(blank=True, null=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["shop__name", "domain"]
        constraints = [
            models.UniqueConstraint(fields=["shop", "domain"], name="uniq_migration_control_per_domain"),
        ]
        indexes = [
            models.Index(fields=["shop", "domain"]),
            models.Index(fields=["domain", "write_master"]),
            models.Index(fields=["domain", "bridge_mode"]),
        ]

    def __str__(self) -> str:
        return f"{self.shop.name} / {self.domain}"


class MigrationJobRun(UUIDStampedModel):
    shop = models.ForeignKey(
        Shop,
        on_delete=models.CASCADE,
        related_name="migration_job_runs",
        blank=True,
        null=True,
    )
    domain = models.CharField(max_length=64, choices=MigrationDomain.choices)
    job_type = models.CharField(max_length=32, choices=MigrationJobType.choices)
    status = models.CharField(max_length=16, choices=MigrationJobStatus.choices, default=MigrationJobStatus.QUEUED)
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="migration_job_runs",
        blank=True,
        null=True,
    )
    trace_id = models.CharField(max_length=128, blank=True)
    rows_scanned = models.PositiveIntegerField(default=0)
    rows_written = models.PositiveIntegerField(default=0)
    rows_skipped = models.PositiveIntegerField(default=0)
    mismatch_count = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)
    payload_json = models.JSONField(default=dict, blank=True)
    started_at = models.DateTimeField(blank=True, null=True)
    finished_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["domain", "job_type"]),
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["shop", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.job_type}:{self.domain}:{self.status}"


class MigrationBridgeReceipt(UUIDStampedModel):
    shop = models.ForeignKey(
        Shop,
        on_delete=models.CASCADE,
        related_name="migration_bridge_receipts",
    )
    domain = models.CharField(max_length=64, choices=MigrationDomain.choices)
    origin_system = models.CharField(max_length=32)
    origin_event_id = models.CharField(max_length=128)
    command_type = models.CharField(max_length=32, blank=True)
    entity_type = models.CharField(max_length=64, blank=True)
    entity_id = models.CharField(max_length=128, blank=True)
    base_domain_epoch = models.PositiveIntegerField(default=1)
    payload_json = models.JSONField(default=dict, blank=True)
    applied_at = models.DateTimeField()

    class Meta:
        ordering = ["-applied_at", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "domain", "origin_system", "origin_event_id"],
                name="uniq_bridge_receipt_origin_event",
            )
        ]
        indexes = [
            models.Index(fields=["shop", "domain", "applied_at"]),
            models.Index(fields=["domain", "origin_system"]),
        ]

    def __str__(self) -> str:
        return f"{self.domain}:{self.origin_system}:{self.origin_event_id}"


class MigrationControlEvent(UUIDStampedModel):
    control = models.ForeignKey(
        MigrationDomainControl,
        on_delete=models.CASCADE,
        related_name="activity_events",
    )
    shop = models.ForeignKey(
        Shop,
        on_delete=models.CASCADE,
        related_name="migration_control_events",
    )
    domain = models.CharField(max_length=64, choices=MigrationDomain.choices)
    event_type = models.CharField(max_length=32, choices=MigrationControlEventType.choices)
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="migration_control_events",
        blank=True,
        null=True,
    )
    result = models.CharField(max_length=32, blank=True)
    from_cutover_status = models.CharField(max_length=24, blank=True)
    to_cutover_status = models.CharField(max_length=24, blank=True)
    from_write_master = models.CharField(max_length=16, blank=True)
    to_write_master = models.CharField(max_length=16, blank=True)
    summary = models.TextField(blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField()

    class Meta:
        ordering = ["-occurred_at", "-created_at"]
        indexes = [
            models.Index(fields=["shop", "domain", "occurred_at"]),
            models.Index(fields=["event_type", "occurred_at"]),
            models.Index(fields=["result", "occurred_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.domain}:{self.event_type}:{self.result or 'none'}"


class MigrationShopCheckpointEvent(UUIDStampedModel):
    shop = models.ForeignKey(
        Shop,
        on_delete=models.CASCADE,
        related_name="migration_shop_checkpoint_events",
    )
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="migration_shop_checkpoint_events",
        blank=True,
        null=True,
    )
    decision = models.CharField(max_length=32, choices=MigrationShopCheckpointDecision.choices)
    overall_status_snapshot = models.CharField(max_length=32, blank=True)
    summary = models.TextField(blank=True)
    recommended_action_snapshot = models.TextField(blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField()

    class Meta:
        ordering = ["-occurred_at", "-created_at"]
        indexes = [
            models.Index(fields=["shop", "occurred_at"]),
            models.Index(fields=["decision", "occurred_at"]),
            models.Index(fields=["overall_status_snapshot", "occurred_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.shop.name}:{self.decision}"


class MigrationPhaseCheckpointEvent(UUIDStampedModel):
    phase = models.CharField(max_length=32, default="phase_3")
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="migration_phase_checkpoint_events",
        blank=True,
        null=True,
    )
    decision = models.CharField(max_length=32, choices=MigrationPhaseCheckpointDecision.choices)
    overall_status_snapshot = models.CharField(max_length=32, blank=True)
    summary = models.TextField(blank=True)
    recommended_action_snapshot = models.TextField(blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField()

    class Meta:
        ordering = ["-occurred_at", "-created_at"]
        indexes = [
            models.Index(fields=["phase", "occurred_at"]),
            models.Index(fields=["decision", "occurred_at"]),
            models.Index(fields=["overall_status_snapshot", "occurred_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.phase}:{self.decision}"


class MigrationLaunchCheckpointEvent(UUIDStampedModel):
    phase = models.CharField(max_length=32, default="phase_5")
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="migration_launch_checkpoint_events",
        blank=True,
        null=True,
    )
    decision = models.CharField(max_length=32, choices=MigrationLaunchCheckpointDecision.choices)
    overall_status_snapshot = models.CharField(max_length=32, blank=True)
    summary = models.TextField(blank=True)
    recommended_action_snapshot = models.TextField(blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField()

    class Meta:
        ordering = ["-occurred_at", "-created_at"]
        indexes = [
            models.Index(fields=["phase", "occurred_at"]),
            models.Index(fields=["decision", "occurred_at"]),
            models.Index(fields=["overall_status_snapshot", "occurred_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.phase}:{self.decision}"


class MigrationGoLiveCheckpointEvent(UUIDStampedModel):
    phase = models.CharField(max_length=32, default="phase_6")
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="migration_go_live_checkpoint_events",
        blank=True,
        null=True,
    )
    decision = models.CharField(max_length=32, choices=MigrationGoLiveCheckpointDecision.choices)
    overall_status_snapshot = models.CharField(max_length=32, blank=True)
    summary = models.TextField(blank=True)
    recommended_action_snapshot = models.TextField(blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField()

    class Meta:
        ordering = ["-occurred_at", "-created_at"]
        indexes = [
            models.Index(fields=["phase", "occurred_at"]),
            models.Index(fields=["decision", "occurred_at"]),
            models.Index(fields=["overall_status_snapshot", "occurred_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.phase}:{self.decision}"


class MigrationRolloutCheckpointEvent(UUIDStampedModel):
    phase = models.CharField(max_length=32, default="phase_7")
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="migration_rollout_checkpoint_events",
        blank=True,
        null=True,
    )
    decision = models.CharField(max_length=32, choices=MigrationRolloutCheckpointDecision.choices)
    overall_status_snapshot = models.CharField(max_length=32, blank=True)
    summary = models.TextField(blank=True)
    recommended_action_snapshot = models.TextField(blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField()

    class Meta:
        ordering = ["-occurred_at", "-created_at"]
        indexes = [
            models.Index(fields=["phase", "occurred_at"]),
            models.Index(fields=["decision", "occurred_at"]),
            models.Index(fields=["overall_status_snapshot", "occurred_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.phase}:{self.decision}"
