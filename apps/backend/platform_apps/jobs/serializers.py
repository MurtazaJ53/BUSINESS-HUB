from __future__ import annotations

from rest_framework import serializers

from platform_apps.jobs.models import MigrationDomainControl, MigrationJobRun


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
