from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from platform_apps.users.models import PlatformUser


@admin.register(PlatformUser)
class PlatformUserAdmin(UserAdmin):
    ordering = ("email",)
    list_display = ("email", "full_name", "is_staff", "is_platform_admin", "is_active")
    search_fields = ("email", "full_name", "firebase_uid")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("full_name", "firebase_uid", "timezone")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "is_platform_admin", "groups", "user_permissions")}),
        ("Audit", {"fields": ("last_login", "source_system", "source_id", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "full_name", "password1", "password2", "is_staff", "is_superuser"),
            },
        ),
    )
    readonly_fields = ("created_at", "updated_at", "last_login")
