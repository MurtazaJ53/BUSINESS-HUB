from django.contrib import admin

from platform_apps.shops.models import Shop, ShopMembership


@admin.register(Shop)
class ShopAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "currency_code", "timezone", "is_active")
    search_fields = ("name", "slug", "legal_name", "source_id")


@admin.register(ShopMembership)
class ShopMembershipAdmin(admin.ModelAdmin):
    list_display = ("shop", "user", "role", "status", "permissions_version")
    list_filter = ("role", "status")
    search_fields = ("shop__name", "user__email", "user__full_name")
