from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from platform_apps.audit.models import MigrationReconciliationEvent, WorkspaceAuditEvent
from platform_apps.common.migration import ReconciliationStatus


class MigrationReconciliationEventSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    resolver_name = serializers.SerializerMethodField()

    class Meta:
        model = MigrationReconciliationEvent
        fields = (
            "id",
            "shop",
            "shop_name",
            "domain",
            "severity",
            "status",
            "issue_code",
            "entity_type",
            "entity_id",
            "source_reference",
            "expected_master",
            "observed_source",
            "occurred_at",
            "mismatch_payload_json",
            "note",
            "resolver_user",
            "resolver_name",
            "resolved_at",
            "resolution_note",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "shop_name",
            "resolver_user",
            "resolver_name",
            "resolved_at",
            "created_at",
            "updated_at",
        )

    def get_resolver_name(self, obj):
        if obj.resolver_user_id and obj.resolver_user.full_name:
            return obj.resolver_user.full_name
        if obj.resolver_user_id:
            return obj.resolver_user.email
        return None

    def update(self, instance, validated_data):
        status = validated_data.get("status")
        resolver_user = self.context.get("resolver_user")

        if status in {ReconciliationStatus.RESOLVED, ReconciliationStatus.IGNORED} and instance.resolved_at is None:
            instance.resolved_at = timezone.now()
            if resolver_user is not None:
                instance.resolver_user = resolver_user
        elif status in {ReconciliationStatus.OPEN, ReconciliationStatus.ACKNOWLEDGED}:
            instance.resolved_at = None
            instance.resolver_user = None

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance


class WorkspaceAuditEventSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = WorkspaceAuditEvent
        fields = (
            "id",
            "shop",
            "shop_name",
            "actor_user",
            "actor_name",
            "actor_role",
            "category",
            "event_type",
            "entity_type",
            "entity_id",
            "entity_label",
            "summary",
            "source_surface",
            "before_json",
            "after_json",
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
