from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from platform_apps.common.tenant_context import (
    clear_current_shop_id,
    get_current_shop_id,
    set_current_shop_id,
)
from platform_apps.common.tenant_task import TenantTask
from platform_apps.inventory.models import InventoryItem, InventoryStockLedger
from platform_apps.shops.models import Shop


class TenantIsolationTests(TestCase):
    def setUp(self):
        self.shop_a = Shop.objects.create(name="A", slug="a")
        self.shop_b = Shop.objects.create(name="B", slug="b")
        for shop in (self.shop_a, self.shop_b):
            item = InventoryItem.objects.create(shop=shop, name="Item", sell_price=Decimal("10"))
            InventoryStockLedger.objects.create(
                shop=shop, item=item,
                event_type=InventoryStockLedger.EventType.OPENING_BALANCE,
                quantity_delta=Decimal("5.000"), occurred_at=timezone.now(),
            )

    def tearDown(self):
        clear_current_shop_id()

    def test_no_context_sees_all_shops(self):
        # HTTP/admin/tests path: manager is a no-op.
        self.assertEqual(InventoryStockLedger.objects.count(), 2)

    def test_bound_shop_auto_scopes_reads(self):
        set_current_shop_id(str(self.shop_a.id))
        # Even a filter-less query is restricted to shop A.
        self.assertEqual(InventoryStockLedger.objects.count(), 1)
        self.assertEqual(InventoryStockLedger.objects.first().shop_id, self.shop_a.id)
        clear_current_shop_id()
        self.assertEqual(InventoryStockLedger.objects.count(), 2)

    def test_tenant_task_rejects_missing_shop_id(self):
        class _T(TenantTask):
            name = "t"
            def run(self, **kwargs):
                return get_current_shop_id()

        with self.assertRaises(ValueError):
            _T()()  # no shop_id kwarg -> fail fast
