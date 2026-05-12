from django.contrib import admin

from platform_apps.erpnext.models import ERPNextDocumentLink, ERPNextShopBinding, ERPNextSyncCursor


@admin.register(ERPNextShopBinding)
class ERPNextShopBindingAdmin(admin.ModelAdmin):
    list_display = ("shop", "is_enabled", "environment", "company", "warehouse", "last_health_status")
    list_filter = ("is_enabled", "environment", "last_health_status")
    search_fields = ("shop__name", "shop__slug", "company", "warehouse")


@admin.register(ERPNextSyncCursor)
class ERPNextSyncCursorAdmin(admin.ModelAdmin):
    list_display = ("shop", "domain", "direction", "status", "last_finished_at", "last_result_count")
    list_filter = ("domain", "direction", "status")
    search_fields = ("shop__name", "shop__slug", "domain")


@admin.register(ERPNextDocumentLink)
class ERPNextDocumentLinkAdmin(admin.ModelAdmin):
    list_display = ("shop", "local_domain", "local_object_id", "remote_doctype", "remote_name", "sync_status")
    list_filter = ("local_domain", "direction", "sync_status")
    search_fields = ("shop__name", "shop__slug", "local_object_id", "remote_name", "remote_doctype")

