from django.contrib import admin

from platform_apps.audit.models import MigrationReconciliationEvent, WorkspaceAuditEvent


@admin.register(MigrationReconciliationEvent)
class MigrationReconciliationEventAdmin(admin.ModelAdmin):
    list_display = (
        "domain",
        "issue_code",
        "severity",
        "status",
        "shop",
        "occurred_at",
        "resolved_at",
    )
    list_filter = ("domain", "severity", "status")
    search_fields = ("issue_code", "entity_id", "source_reference", "shop__name", "shop__slug")
    readonly_fields = ("created_at", "updated_at")


@admin.register(WorkspaceAuditEvent)
class WorkspaceAuditEventAdmin(admin.ModelAdmin):
    list_display = (
        "occurred_at",
        "shop",
        "category",
        "event_type",
        "actor_user",
        "actor_role",
        "entity_type",
        "entity_label",
    )
    list_filter = ("category", "actor_role", "event_type", "source_surface")
    search_fields = (
        "summary",
        "entity_label",
        "entity_id",
        "event_type",
        "actor_user__email",
        "shop__name",
        "shop__slug",
    )
    ordering = ("-occurred_at", "-created_at")
    readonly_fields = (
        "shop",
        "actor_user",
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

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
