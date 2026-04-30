from django.contrib import admin

from platform_apps.inventory.models import InventoryItem, InventoryItemPrivate, InventoryStockLedger


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ("name", "shop", "sku", "category", "sell_price", "status", "tombstone")
    list_filter = ("shop", "status", "category", "tombstone")
    search_fields = ("name", "sku", "barcode")


@admin.register(InventoryItemPrivate)
class InventoryItemPrivateAdmin(admin.ModelAdmin):
    list_display = ("item", "cost_price", "supplier_id", "last_purchase_date", "tombstone")
    search_fields = ("item__name", "item__sku", "supplier_id")


@admin.register(InventoryStockLedger)
class InventoryStockLedgerAdmin(admin.ModelAdmin):
    list_display = ("item", "shop", "event_type", "quantity_delta", "occurred_at", "actor_user")
    list_filter = ("event_type", "shop")
    search_fields = ("item__name", "item__sku", "note")
