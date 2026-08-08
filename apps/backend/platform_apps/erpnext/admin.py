from django.contrib import admin

from platform_apps.erpnext.models import (
    ERPNextDocumentLink,
    ERPNextPurchaseMirror,
    ERPNextShopBinding,
    ERPNextSupplierMirror,
    ERPNextSyncCursor,
)


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


@admin.register(ERPNextSupplierMirror)
class ERPNextSupplierMirrorAdmin(admin.ModelAdmin):
    list_display = ("shop", "remote_name", "supplier_name", "supplier_group", "status", "last_synced_at")
    list_filter = ("status", "supplier_group")
    search_fields = ("shop__name", "shop__slug", "remote_name", "supplier_name", "phone", "email")


@admin.register(ERPNextPurchaseMirror)
class ERPNextPurchaseMirrorAdmin(admin.ModelAdmin):
    list_display = ("shop", "remote_doctype", "remote_name", "supplier_remote_name", "posting_date", "grand_total", "status")
    list_filter = ("remote_doctype", "status", "currency_code")
    search_fields = ("shop__name", "shop__slug", "remote_name", "supplier_remote_name", "warehouse")
