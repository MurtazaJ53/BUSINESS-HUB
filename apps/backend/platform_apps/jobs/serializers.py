from __future__ import annotations

from rest_framework import serializers

from platform_apps.jobs.models import (
    MigrationBridgeReceipt,
    MigrationControlEvent,
    MigrationDomainControl,
    MigrationGoLiveCheckpointEvent,
    MigrationLaunchCheckpointEvent,
    MigrationPhaseCheckpointEvent,
    MigrationJobRun,
    MigrationShopCheckpointEvent,
)


class MigrationDomainControlSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    shop_slug = serializers.CharField(source="shop.slug", read_only=True)

    class Meta:
        model = MigrationDomainControl
        fields = (
            "id",
            "shop",
            "shop_name",
            "shop_slug",
            "domain",
            "write_master",
            "bridge_mode",
            "cutover_status",
            "current_epoch",
            "shadow_reads_enabled",
            "is_enabled",
            "last_backfill_at",
            "last_shadow_verified_at",
            "metadata_json",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "shop_name", "shop_slug", "created_at", "updated_at")


class MigrationJobRunSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = MigrationJobRun
        fields = (
            "id",
            "shop",
            "shop_name",
            "domain",
            "job_type",
            "status",
            "actor_user",
            "actor_name",
            "trace_id",
            "rows_scanned",
            "rows_written",
            "rows_skipped",
            "mismatch_count",
            "error_message",
            "payload_json",
            "started_at",
            "finished_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "shop_name", "actor_name", "created_at", "updated_at")

    def get_actor_name(self, obj):
        if obj.actor_user_id and obj.actor_user.full_name:
            return obj.actor_user.full_name
        if obj.actor_user_id:
            return obj.actor_user.email
        return None


class MigrationBridgeReceiptSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source="shop.name", read_only=True)

    class Meta:
        model = MigrationBridgeReceipt
        fields = (
            "id",
            "shop",
            "shop_name",
            "domain",
            "origin_system",
            "origin_event_id",
            "command_type",
            "entity_type",
            "entity_id",
            "base_domain_epoch",
            "payload_json",
            "applied_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "shop_name",
            "origin_system",
            "origin_event_id",
            "command_type",
            "entity_type",
            "entity_id",
            "base_domain_epoch",
            "payload_json",
            "applied_at",
            "created_at",
            "updated_at",
        )


class MigrationControlEventSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = MigrationControlEvent
        fields = (
            "id",
            "control",
            "shop",
            "shop_name",
            "domain",
            "event_type",
            "actor_user",
            "actor_name",
            "result",
            "from_cutover_status",
            "to_cutover_status",
            "from_write_master",
            "to_write_master",
            "summary",
            "metadata_json",
            "occurred_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_actor_name(self, obj):
        if obj.actor_user_id and obj.actor_user.full_name:
            return obj.actor_user.full_name
        if obj.actor_user_id:
            return obj.actor_user.email
        return None


class MigrationShopCheckpointEventSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    shop_slug = serializers.CharField(source="shop.slug", read_only=True)
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = MigrationShopCheckpointEvent
        fields = (
            "id",
            "shop",
            "shop_name",
            "shop_slug",
            "actor_user",
            "actor_name",
            "decision",
            "overall_status_snapshot",
            "summary",
            "recommended_action_snapshot",
            "metadata_json",
            "occurred_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_actor_name(self, obj):
        if obj.actor_user_id and obj.actor_user.full_name:
            return obj.actor_user.full_name
        if obj.actor_user_id:
            return obj.actor_user.email
        return None


class MigrationPhaseCheckpointEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = MigrationPhaseCheckpointEvent
        fields = (
            "id",
            "phase",
            "actor_user",
            "actor_name",
            "decision",
            "overall_status_snapshot",
            "summary",
            "recommended_action_snapshot",
            "metadata_json",
            "occurred_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_actor_name(self, obj):
        if obj.actor_user_id and obj.actor_user.full_name:
            return obj.actor_user.full_name
        if obj.actor_user_id:
            return obj.actor_user.email
        return None


class MigrationLaunchCheckpointEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = MigrationLaunchCheckpointEvent
        fields = (
            "id",
            "phase",
            "actor_user",
            "actor_name",
            "decision",
            "overall_status_snapshot",
            "summary",
            "recommended_action_snapshot",
            "metadata_json",
            "occurred_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_actor_name(self, obj):
        if obj.actor_user_id and obj.actor_user.full_name:
            return obj.actor_user.full_name
        if obj.actor_user_id:
            return obj.actor_user.email
        return None


class MigrationGoLiveCheckpointEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = MigrationGoLiveCheckpointEvent
        fields = (
            "id",
            "phase",
            "actor_user",
            "actor_name",
            "decision",
            "overall_status_snapshot",
            "summary",
            "recommended_action_snapshot",
            "metadata_json",
            "occurred_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_actor_name(self, obj):
        if obj.actor_user_id and obj.actor_user.full_name:
            return obj.actor_user.full_name
        if obj.actor_user_id:
            return obj.actor_user.email
        return None


class MigrationShadowSummarySerializer(serializers.Serializer):
    shop = serializers.UUIDField()
    shop_name = serializers.CharField()
    shop_slug = serializers.CharField()
    domain = serializers.CharField()
    write_master = serializers.CharField()
    bridge_mode = serializers.CharField()
    current_epoch = serializers.IntegerField()
    last_shadow_verified_at = serializers.DateTimeField(allow_null=True)
    latest_compare_status = serializers.CharField(allow_null=True)
    latest_compare_at = serializers.DateTimeField(allow_null=True)
    latest_compare_mismatches = serializers.IntegerField()
    latest_compare_trace_id = serializers.CharField(allow_blank=True, allow_null=True)
    open_events = serializers.IntegerField()
    open_critical_events = serializers.IntegerField()
    open_stale_epoch_events = serializers.IntegerField()


class MigrationPilotReadinessSerializer(serializers.Serializer):
    control_id = serializers.UUIDField()
    shop = serializers.UUIDField()
    shop_name = serializers.CharField()
    shop_slug = serializers.CharField()
    domain = serializers.CharField()
    cutover_status = serializers.CharField()
    write_master = serializers.CharField()
    bridge_mode = serializers.CharField()
    current_epoch = serializers.IntegerField()
    shadow_reads_enabled = serializers.BooleanField()
    last_backfill_at = serializers.DateTimeField(allow_null=True)
    last_shadow_verified_at = serializers.DateTimeField(allow_null=True)
    latest_compare_status = serializers.CharField(allow_null=True)
    latest_compare_at = serializers.DateTimeField(allow_null=True)
    latest_compare_mismatches = serializers.IntegerField()
    latest_compare_trace_id = serializers.CharField(allow_blank=True, allow_null=True)
    open_events = serializers.IntegerField()
    open_critical_events = serializers.IntegerField()
    open_stale_epoch_events = serializers.IntegerField()
    ready_for_pilot = serializers.BooleanField()
    recommended_next_status = serializers.CharField()
    blocking_reasons = serializers.ListField(child=serializers.CharField())
    warnings = serializers.ListField(child=serializers.CharField())


class MigrationPilotSignoffSerializer(serializers.Serializer):
    control_id = serializers.UUIDField()
    shop = serializers.UUIDField()
    shop_name = serializers.CharField()
    shop_slug = serializers.CharField()
    domain = serializers.CharField()
    cutover_status = serializers.CharField()
    write_master = serializers.CharField()
    current_epoch = serializers.IntegerField()
    signoff_status = serializers.ChoiceField(
        choices=[
            "blocked",
            "ready_for_cutover",
            "monitoring",
            "production_safe",
            "rollback_recommended",
        ]
    )
    latest_verify_result = serializers.CharField(allow_null=True)
    latest_verified_at = serializers.DateTimeField(allow_null=True)
    latest_compare_status = serializers.CharField(allow_null=True)
    latest_compare_mismatches = serializers.IntegerField()
    open_critical_events = serializers.IntegerField()
    open_stale_epoch_events = serializers.IntegerField()
    ready_for_pilot = serializers.BooleanField()
    summary = serializers.CharField()
    recommended_action = serializers.CharField()
    blocking_reasons = serializers.ListField(child=serializers.CharField())
    warnings = serializers.ListField(child=serializers.CharField())


class MigrationPilotShopScorecardSerializer(serializers.Serializer):
    shop = serializers.UUIDField()
    shop_name = serializers.CharField()
    shop_slug = serializers.CharField()
    overall_status = serializers.ChoiceField(
        choices=[
            "blocked",
            "ready_for_cutover",
            "monitoring",
            "production_safe",
            "rollback_recommended",
        ]
    )
    recommended_action = serializers.CharField()
    summary = serializers.CharField()
    missing_domains = serializers.ListField(child=serializers.CharField())
    production_safe_domains = serializers.IntegerField()
    ready_for_cutover_domains = serializers.IntegerField()
    monitoring_domains = serializers.IntegerField()
    blocked_domains = serializers.IntegerField()
    rollback_recommended_domains = serializers.IntegerField()
    domains = MigrationPilotSignoffSerializer(many=True)


class MigrationPhaseReadinessShopSerializer(serializers.Serializer):
    shop = serializers.UUIDField()
    shop_name = serializers.CharField()
    shop_slug = serializers.CharField()
    overall_status = serializers.ChoiceField(
        choices=[
            "blocked",
            "ready_for_cutover",
            "monitoring",
            "production_safe",
            "rollback_recommended",
        ]
    )
    recommended_action = serializers.CharField()
    summary = serializers.CharField()
    latest_checkpoint_decision = serializers.ChoiceField(
        choices=[
            "approved_for_cutover",
            "hold_for_monitoring",
            "rollback_escalated",
        ],
        allow_null=True,
    )
    latest_checkpoint_overall_status = serializers.CharField(allow_null=True)
    latest_checkpoint_at = serializers.DateTimeField(allow_null=True)


class MigrationPhaseReadinessSerializer(serializers.Serializer):
    phase = serializers.CharField()
    overall_status = serializers.ChoiceField(
        choices=[
            "blocked",
            "monitoring",
            "ready_for_phase_exit",
            "rollback_recommended",
        ]
    )
    pilot_shop_count = serializers.IntegerField()
    approved_for_cutover_count = serializers.IntegerField()
    hold_for_monitoring_count = serializers.IntegerField()
    rollback_escalated_count = serializers.IntegerField()
    shops_without_checkpoint = serializers.IntegerField()
    production_safe_shop_count = serializers.IntegerField()
    ready_for_cutover_shop_count = serializers.IntegerField()
    monitoring_shop_count = serializers.IntegerField()
    blocked_shop_count = serializers.IntegerField()
    rollback_recommended_shop_count = serializers.IntegerField()
    recommended_action = serializers.CharField()
    summary = serializers.CharField()
    shops = MigrationPhaseReadinessShopSerializer(many=True)


class MigrationRetirementDomainSnapshotSerializer(serializers.Serializer):
    domain = serializers.CharField()
    present = serializers.BooleanField()
    write_master = serializers.CharField(allow_null=True)
    bridge_mode = serializers.CharField(allow_null=True)
    cutover_status = serializers.CharField(allow_null=True)


class MigrationRetirementShopScorecardSerializer(serializers.Serializer):
    shop = serializers.UUIDField()
    shop_name = serializers.CharField()
    shop_slug = serializers.CharField()
    overall_status = serializers.ChoiceField(
        choices=[
            "blocked",
            "monitoring",
            "ready_for_launch",
            "rollback_recommended",
        ]
    )
    recommended_action = serializers.CharField()
    summary = serializers.CharField()
    missing_domains = serializers.ListField(child=serializers.CharField())
    postgres_primary_domains = serializers.IntegerField()
    firebase_primary_domains = serializers.IntegerField()
    active_bridge_domains = serializers.IntegerField()
    compare_only_domains = serializers.IntegerField()
    blocked_domains = serializers.IntegerField()
    open_events = serializers.IntegerField()
    open_critical_events = serializers.IntegerField()
    domains = MigrationRetirementDomainSnapshotSerializer(many=True)


class MigrationRetirementReadinessSerializer(serializers.Serializer):
    phase = serializers.CharField()
    overall_status = serializers.ChoiceField(
        choices=[
            "blocked",
            "monitoring",
            "ready_for_launch",
            "retirement_complete",
            "rollback_recommended",
        ]
    )
    shop_count = serializers.IntegerField()
    ready_for_launch_shop_count = serializers.IntegerField()
    monitoring_shop_count = serializers.IntegerField()
    blocked_shop_count = serializers.IntegerField()
    rollback_recommended_shop_count = serializers.IntegerField()
    latest_launch_decision = serializers.ChoiceField(
        choices=[
            "approved_for_launch",
            "hold_for_hardening",
            "rollback_to_phase4",
        ],
        allow_null=True,
    )
    latest_launch_status_snapshot = serializers.CharField(allow_null=True)
    latest_launch_at = serializers.DateTimeField(allow_null=True)
    recommended_action = serializers.CharField()
    summary = serializers.CharField()
    shops = MigrationRetirementShopScorecardSerializer(many=True)


class MigrationGoLiveReadinessSerializer(serializers.Serializer):
    phase = serializers.CharField()
    overall_status = serializers.ChoiceField(
        choices=[
            "blocked",
            "ready_for_go_live",
            "hypercare_active",
            "steady_state",
            "rollback_recommended",
        ]
    )
    shop_count = serializers.IntegerField()
    ready_for_launch_shop_count = serializers.IntegerField()
    monitoring_shop_count = serializers.IntegerField()
    blocked_shop_count = serializers.IntegerField()
    rollback_recommended_shop_count = serializers.IntegerField()
    latest_launch_decision = serializers.ChoiceField(
        choices=[
            "approved_for_launch",
            "hold_for_hardening",
            "rollback_to_phase4",
        ],
        allow_null=True,
    )
    latest_launch_status_snapshot = serializers.CharField(allow_null=True)
    latest_launch_at = serializers.DateTimeField(allow_null=True)
    latest_go_live_decision = serializers.ChoiceField(
        choices=[
            "execute_go_live",
            "remain_in_hypercare",
            "handoff_to_steady_state",
            "rollback_launch",
        ],
        allow_null=True,
    )
    latest_go_live_status_snapshot = serializers.CharField(allow_null=True)
    latest_go_live_at = serializers.DateTimeField(allow_null=True)
    recommended_action = serializers.CharField()
    summary = serializers.CharField()
    shops = MigrationRetirementShopScorecardSerializer(many=True)


class MigrationPilotPreparationResultSerializer(serializers.Serializer):
    control_id = serializers.UUIDField()
    shop = serializers.UUIDField()
    shop_name = serializers.CharField()
    domain = serializers.CharField()
    jobs = MigrationJobRunSerializer(many=True)
    readiness = MigrationPilotReadinessSerializer()


class MigrationPilotVerificationResultSerializer(serializers.Serializer):
    control_id = serializers.UUIDField()
    shop = serializers.UUIDField()
    shop_name = serializers.CharField()
    domain = serializers.CharField()
    verification_job = MigrationJobRunSerializer()
    cutover_status = serializers.CharField()
    write_master = serializers.CharField()
    latest_compare_status = serializers.CharField(allow_null=True)
    latest_compare_mismatches = serializers.IntegerField()
    open_critical_events = serializers.IntegerField()
    open_stale_epoch_events = serializers.IntegerField()
    healthy = serializers.BooleanField()
    requires_rollback = serializers.BooleanField()
    operational_verdict = serializers.ChoiceField(
        choices=["production_safe", "monitoring", "rollback_recommended"]
    )
    summary = serializers.CharField()
