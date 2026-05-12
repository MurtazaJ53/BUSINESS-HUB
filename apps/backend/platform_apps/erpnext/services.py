from __future__ import annotations

import json
import ssl
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any
from urllib import error, parse, request

from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from django.db.models import Sum
from django.db.models.functions import Coalesce

from platform_apps.erpnext.mock_client import MockERPNextClient, MockERPNextClientSettings
from platform_apps.customers.models import Customer
from platform_apps.erpnext.models import (
    ERPNextDocumentLink,
    ERPNextPurchaseMirror,
    ERPNextShopBinding,
    ERPNextSupplierMirror,
    ERPNextSyncCursor,
)
from platform_apps.inventory.models import InventoryItem
from platform_apps.inventory.models import InventoryItemPrivate
from platform_apps.inventory.models import InventoryStockLedger
from platform_apps.payments.models import SalePayment
from platform_apps.sales.models import SaleItem
from platform_apps.sales.models import Sale
from platform_apps.shops.models import Shop


class ERPNextConfigurationError(Exception):
    """Raised when the ERPNext client is missing required configuration."""


class ERPNextApiError(Exception):
    def __init__(self, *, message: str, status_code: int | None = None, payload: Any | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


@dataclass(slots=True)
class ERPNextClientSettings:
    base_url: str
    api_key: str
    api_secret: str
    site_name: str
    verify_ssl: bool
    timeout_seconds: int


class ERPNextClient:
    def __init__(self, client_settings: ERPNextClientSettings):
        self.settings = client_settings

    def _build_url(self, path: str, query: dict[str, Any] | None = None) -> str:
        normalized_path = path if path.startswith("/") else f"/{path}"
        url = f"{self.settings.base_url}{normalized_path}"
        if query:
            url = f"{url}?{parse.urlencode(query, doseq=True)}"
        return url

    def _ssl_context(self):
        if self.settings.verify_ssl:
            return ssl.create_default_context()
        return ssl._create_unverified_context()  # noqa: S323 - explicit PoC opt-out via env

    def _headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "Authorization": f"token {self.settings.api_key}:{self.settings.api_secret}",
            "Content-Type": "application/json",
            "X-Frappe-Site-Name": self.settings.site_name,
        }

    def _request(
        self,
        *,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
        query: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        http_request = request.Request(
            self._build_url(path, query=query),
            data=body,
            method=method,
            headers=self._headers(),
        )
        try:
            with request.urlopen(
                http_request,
                timeout=self.settings.timeout_seconds,
                context=self._ssl_context(),
            ) as response:
                raw_body = response.read().decode("utf-8").strip()
        except error.HTTPError as exc:
            raw_error = exc.read().decode("utf-8").strip()
            try:
                payload_json = json.loads(raw_error) if raw_error else {}
            except json.JSONDecodeError:
                payload_json = {"raw": raw_error}
            message = (
                payload_json.get("exception")
                or payload_json.get("message")
                or payload_json.get("exc")
                or raw_error
                or str(exc)
            )
            raise ERPNextApiError(message=message, status_code=exc.code, payload=payload_json) from exc
        except error.URLError as exc:
            raise ERPNextApiError(message=str(exc.reason), status_code=None, payload=None) from exc

        if not raw_body:
            return {}
        try:
            return json.loads(raw_body)
        except json.JSONDecodeError as exc:
            raise ERPNextApiError(message="ERPNext returned non-JSON output.", payload=raw_body) from exc

    def ping(self) -> dict[str, Any]:
        return self._request(method="GET", path="/api/method/ping")

    def call_method(self, method_name: str, *, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._request(method="POST" if payload else "GET", path=f"/api/method/{method_name}", payload=payload)

    def list_resource(
        self,
        *,
        doctype: str,
        filters: list[list[Any]] | None = None,
        fields: list[str] | None = None,
        limit_page_length: int = 20,
    ) -> dict[str, Any]:
        query = {
            "limit_page_length": limit_page_length,
        }
        if filters:
            query["filters"] = json.dumps(filters)
        if fields:
            query["fields"] = json.dumps(fields)
        encoded_doctype = parse.quote(doctype, safe="")
        return self._request(method="GET", path=f"/api/resource/{encoded_doctype}", query=query)

    def get_resource(self, *, doctype: str, name: str) -> dict[str, Any]:
        encoded_doctype = parse.quote(doctype, safe="")
        encoded_name = parse.quote(name, safe="")
        return self._request(method="GET", path=f"/api/resource/{encoded_doctype}/{encoded_name}")

    def create_resource(self, *, doctype: str, payload: dict[str, Any]) -> dict[str, Any]:
        encoded_doctype = parse.quote(doctype, safe="")
        return self._request(method="POST", path=f"/api/resource/{encoded_doctype}", payload=payload)


class ERPNextIntegrationService:
    DEFAULT_CURSOR_BLUEPRINT: tuple[tuple[str, str], ...] = (
        (ERPNextSyncCursor.Domain.ITEMS, ERPNextSyncCursor.Direction.PULL),
        (ERPNextSyncCursor.Domain.CUSTOMERS, ERPNextSyncCursor.Direction.PULL),
        (ERPNextSyncCursor.Domain.STOCK, ERPNextSyncCursor.Direction.PULL),
        (ERPNextSyncCursor.Domain.SUPPLIERS, ERPNextSyncCursor.Direction.PULL),
        (ERPNextSyncCursor.Domain.PURCHASES, ERPNextSyncCursor.Direction.PULL),
        (ERPNextSyncCursor.Domain.SALES, ERPNextSyncCursor.Direction.PUSH),
        (ERPNextSyncCursor.Domain.PAYMENTS, ERPNextSyncCursor.Direction.PUSH),
    )

    DEFAULT_MODE_OF_PAYMENT_MAP = {
        SalePayment.PaymentMethod.CASH: "Cash",
        SalePayment.PaymentMethod.UPI: "UPI",
        SalePayment.PaymentMethod.BANK: "Bank",
        SalePayment.PaymentMethod.CARD: "Card",
        SalePayment.PaymentMethod.CREDIT: "Credit",
        SalePayment.PaymentMethod.OTHER: "Other",
    }

    @staticmethod
    def environment_meta(*, binding: ERPNextShopBinding | None = None) -> dict[str, Any]:
        base_url = (binding.site_url_override if binding and binding.site_url_override else settings.ERPNEXT_BASE_URL).strip()
        is_mock_mode = settings.ERPNEXT_MOCK_MODE or base_url.startswith("mock://")
        if is_mock_mode and not base_url:
            base_url = "mock://erpnext"
        has_token = bool(settings.ERPNEXT_API_KEY and settings.ERPNEXT_API_SECRET) or is_mock_mode
        return {
            "configured": bool((base_url and has_token) or is_mock_mode),
            "base_url": base_url,
            "site_name": settings.ERPNEXT_SITE_NAME,
            "verify_ssl": settings.ERPNEXT_VERIFY_SSL,
            "timeout_seconds": settings.ERPNEXT_TIMEOUT_SECONDS,
            "has_api_key": bool(settings.ERPNEXT_API_KEY),
            "has_api_secret": bool(settings.ERPNEXT_API_SECRET),
            "is_mock_mode": is_mock_mode,
            "mock_state_path": settings.ERPNEXT_MOCK_STATE_PATH,
        }

    def build_client(self, *, binding: ERPNextShopBinding | None = None) -> ERPNextClient | MockERPNextClient:
        meta = self.environment_meta(binding=binding)
        if not meta["configured"]:
            raise ERPNextConfigurationError(
                "ERPNext is not fully configured. Set ERPNEXT_BASE_URL, ERPNEXT_API_KEY, and ERPNEXT_API_SECRET."
            )
        if meta["is_mock_mode"]:
            return MockERPNextClient(
                MockERPNextClientSettings(
                    base_url=meta["base_url"] or "mock://erpnext",
                    site_name=meta["site_name"] or "business-hub-mock",
                    state_path=Path(settings.ERPNEXT_MOCK_STATE_PATH),
                )
            )
        return ERPNextClient(
            ERPNextClientSettings(
                base_url=meta["base_url"].rstrip("/"),
                api_key=settings.ERPNEXT_API_KEY,
                api_secret=settings.ERPNEXT_API_SECRET,
                site_name=settings.ERPNEXT_SITE_NAME,
                verify_ssl=settings.ERPNEXT_VERIFY_SSL,
                timeout_seconds=settings.ERPNEXT_TIMEOUT_SECONDS,
            )
        )

    def health_check(self, *, binding: ERPNextShopBinding | None = None) -> dict[str, Any]:
        meta = self.environment_meta(binding=binding)
        if not meta["configured"]:
            return {
                "status": ERPNextShopBinding.HealthStatus.MISCONFIGURED,
                "configured": False,
                "base_url": meta["base_url"],
                "site_name": meta["site_name"],
                "reachable": False,
                "authenticated": False,
                "error": "ERPNext environment variables are incomplete.",
            }

        client = self.build_client(binding=binding)
        try:
            ping_payload = client.ping()
            user_payload = client.call_method("frappe.auth.get_logged_user")
        except ERPNextApiError as exc:
            return {
                "status": ERPNextShopBinding.HealthStatus.ERROR,
                "configured": True,
                "base_url": meta["base_url"],
                "site_name": meta["site_name"],
                "reachable": False,
                "authenticated": False,
                "error": str(exc),
                "status_code": exc.status_code,
                "payload": exc.payload,
            }

        return {
            "status": ERPNextShopBinding.HealthStatus.OK,
            "configured": True,
            "base_url": client.settings.base_url,
            "site_name": client.settings.site_name,
            "reachable": True,
            "authenticated": bool(user_payload.get("message")),
            "logged_user": user_payload.get("message"),
            "ping": ping_payload.get("message") if isinstance(ping_payload, dict) else ping_payload,
        }

    def apply_health_payload(self, *, binding: ERPNextShopBinding, payload: dict[str, Any]) -> ERPNextShopBinding:
        binding.last_verified_at = timezone.now()
        binding.last_health_status = payload.get("status", ERPNextShopBinding.HealthStatus.UNKNOWN)
        binding.last_error_message = payload.get("error", "")
        binding.last_health_payload_json = payload
        binding.save(
            update_fields=[
                "last_verified_at",
                "last_health_status",
                "last_error_message",
                "last_health_payload_json",
                "updated_at",
            ]
        )
        return binding

    def ensure_default_cursors(self, *, shop: Shop) -> list[ERPNextSyncCursor]:
        cursors: list[ERPNextSyncCursor] = []
        for domain, direction in self.DEFAULT_CURSOR_BLUEPRINT:
            cursor, _ = ERPNextSyncCursor.objects.get_or_create(
                shop=shop,
                domain=domain,
                direction=direction,
                defaults={"status": ERPNextSyncCursor.Status.IDLE},
            )
            cursors.append(cursor)
        return cursors

    def _require_binding(self, *, shop: Shop) -> ERPNextShopBinding:
        binding = ERPNextShopBinding.objects.filter(shop=shop).first()
        if binding is None:
            raise ERPNextConfigurationError("No ERPNext binding exists for this shop yet.")
        if not binding.is_enabled:
            raise ERPNextConfigurationError("ERPNext binding exists but is disabled for this shop.")
        return binding

    def _begin_cursor_run(self, *, cursor: ERPNextSyncCursor):
        cursor.status = ERPNextSyncCursor.Status.RUNNING
        cursor.last_started_at = timezone.now()
        cursor.last_error_message = ""
        cursor.save(update_fields=["status", "last_started_at", "last_error_message", "updated_at"])

    def _finish_cursor_run(
        self,
        *,
        cursor: ERPNextSyncCursor,
        status: str,
        result_count: int,
        error_message: str = "",
        remote_modified_at=None,
        remote_cursor: str = "",
    ):
        cursor.status = status
        cursor.last_finished_at = timezone.now()
        cursor.last_result_count = result_count
        cursor.last_error_message = error_message
        if remote_modified_at is not None:
            cursor.last_remote_modified_at = remote_modified_at
        if remote_cursor:
            cursor.last_remote_cursor = remote_cursor
        cursor.save(
            update_fields=[
                "status",
                "last_finished_at",
                "last_result_count",
                "last_error_message",
                "last_remote_modified_at",
                "last_remote_cursor",
                "updated_at",
            ]
        )

    def _get_cursor(self, *, shop: Shop, domain: str, direction: str) -> ERPNextSyncCursor:
        self.ensure_default_cursors(shop=shop)
        return ERPNextSyncCursor.objects.get(shop=shop, domain=domain, direction=direction)

    def _parse_remote_timestamp(self, value: str | None):
        if not value:
            return None
        parsed = parse_datetime(value)
        if parsed is None:
            return None
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed

    def _link_document(
        self,
        *,
        shop: Shop,
        local_domain: str,
        local_object_id: str,
        remote_doctype: str,
        remote_name: str,
        direction: str,
        metadata_json: dict[str, Any] | None = None,
    ) -> ERPNextDocumentLink:
        link, _ = ERPNextDocumentLink.objects.update_or_create(
            shop=shop,
            local_domain=local_domain,
            local_object_id=local_object_id,
            remote_doctype=remote_doctype,
            defaults={
                "remote_name": remote_name,
                "direction": direction,
                "sync_status": ERPNextDocumentLink.SyncStatus.LINKED,
                "last_synced_at": timezone.now(),
                "last_error_message": "",
                "metadata_json": metadata_json or {},
            },
        )
        return link

    def _mark_failed_link(
        self,
        *,
        shop: Shop,
        local_domain: str,
        local_object_id: str,
        remote_doctype: str,
        direction: str,
        remote_name: str,
        error_message: str,
        metadata_json: dict[str, Any] | None = None,
    ) -> ERPNextDocumentLink:
        link, _ = ERPNextDocumentLink.objects.update_or_create(
            shop=shop,
            local_domain=local_domain,
            local_object_id=local_object_id,
            remote_doctype=remote_doctype,
            defaults={
                "remote_name": remote_name,
                "direction": direction,
                "sync_status": ERPNextDocumentLink.SyncStatus.FAILED,
                "last_synced_at": timezone.now(),
                "last_error_message": error_message,
                "metadata_json": metadata_json or {},
            },
        )
        return link

    def _erpnext_walk_in_customer(self, *, binding: ERPNextShopBinding) -> str:
        return str(binding.metadata_json.get("walk_in_customer_name", "")).strip()

    def _payment_account_for_method(self, *, binding: ERPNextShopBinding, payment_method: str) -> str:
        payment_account_map = binding.metadata_json.get("payment_account_map") or {}
        if isinstance(payment_account_map, dict):
            mapped = str(payment_account_map.get(payment_method, "")).strip()
            if mapped:
                return mapped
        return str(binding.metadata_json.get("default_payment_account", "")).strip()

    def _mode_of_payment_for_method(self, *, binding: ERPNextShopBinding, payment_method: str) -> str:
        mode_map = binding.metadata_json.get("mode_of_payment_map") or {}
        if isinstance(mode_map, dict):
            mapped = str(mode_map.get(payment_method, "")).strip()
            if mapped:
                return mapped
        return self.DEFAULT_MODE_OF_PAYMENT_MAP.get(payment_method, payment_method.title())

    def sync_items(self, *, shop: Shop, limit: int = 100) -> dict[str, Any]:
        binding = self._require_binding(shop=shop)
        if not binding.item_sync_enabled:
            raise ERPNextConfigurationError("Item sync is disabled for this shop binding.")
        cursor = self._get_cursor(shop=shop, domain=ERPNextSyncCursor.Domain.ITEMS, direction=ERPNextSyncCursor.Direction.PULL)
        client = self.build_client(binding=binding)
        self._begin_cursor_run(cursor=cursor)

        filters: list[list[Any]] = []
        if cursor.last_remote_modified_at:
            filters.append(["Item", "modified", ">", cursor.last_remote_modified_at.isoformat(sep=" ")])

        try:
            response = client.list_resource(
                doctype="Item",
                filters=filters or None,
                fields=[
                    "name",
                    "item_code",
                    "item_name",
                    "item_group",
                    "description",
                    "standard_rate",
                    "disabled",
                    "stock_uom",
                    "default_warehouse",
                    "modified",
                ],
                limit_page_length=limit,
            )
            rows = response.get("data", [])
            imported = 0
            latest_modified_at = cursor.last_remote_modified_at
            latest_remote_name = cursor.last_remote_cursor

            for row in rows:
                remote_name = str(row.get("name", "")).strip()
                if not remote_name:
                    continue
                modified_at = self._parse_remote_timestamp(row.get("modified"))
                if modified_at and (latest_modified_at is None or modified_at > latest_modified_at):
                    latest_modified_at = modified_at
                    latest_remote_name = remote_name

                defaults = {
                    "name": row.get("item_name") or remote_name,
                    "sku": row.get("item_code") or remote_name,
                    "barcode": "",
                    "category": row.get("item_group") or "",
                    "description": row.get("description") or "",
                    "sell_price": Decimal(str(row.get("standard_rate") or "0")),
                    "status": InventoryItem.Status.ARCHIVED if row.get("disabled") else InventoryItem.Status.ACTIVE,
                    "tombstone": False,
                    "source_meta_json": row,
                    "source_system": "erpnext",
                    "source_id": remote_name,
                    "source_shop_id": binding.company,
                    "source_path": f"Item/{remote_name}",
                    "migrated_at": timezone.now(),
                }
                item, created = InventoryItem.objects.get_or_create(
                    shop=shop,
                    source_system="erpnext",
                    source_id=remote_name,
                    defaults=defaults,
                )
                if not created:
                    for field, value in defaults.items():
                        setattr(item, field, value)
                    item.save()

                InventoryItemPrivate.objects.get_or_create(item=item)
                self._link_document(
                    shop=shop,
                    local_domain=ERPNextDocumentLink.LocalDomain.ITEM,
                    local_object_id=str(item.id),
                    remote_doctype="Item",
                    remote_name=remote_name,
                    direction=ERPNextDocumentLink.Direction.PULL,
                    metadata_json=row,
                )
                imported += 1

            self._finish_cursor_run(
                cursor=cursor,
                status=ERPNextSyncCursor.Status.SUCCEEDED,
                result_count=imported,
                remote_modified_at=latest_modified_at,
                remote_cursor=latest_remote_name or "",
            )
            return {
                "domain": ERPNextSyncCursor.Domain.ITEMS,
                "direction": ERPNextSyncCursor.Direction.PULL,
                "imported_count": imported,
                "cursor": cursor.last_remote_cursor,
            }
        except Exception as exc:
            self._finish_cursor_run(
                cursor=cursor,
                status=ERPNextSyncCursor.Status.FAILED,
                result_count=0,
                error_message=str(exc),
            )
            raise

    def sync_customers(self, *, shop: Shop, limit: int = 100) -> dict[str, Any]:
        binding = self._require_binding(shop=shop)
        if not binding.customer_sync_enabled:
            raise ERPNextConfigurationError("Customer sync is disabled for this shop binding.")
        cursor = self._get_cursor(shop=shop, domain=ERPNextSyncCursor.Domain.CUSTOMERS, direction=ERPNextSyncCursor.Direction.PULL)
        client = self.build_client(binding=binding)
        self._begin_cursor_run(cursor=cursor)

        filters: list[list[Any]] = []
        if cursor.last_remote_modified_at:
            filters.append(["Customer", "modified", ">", cursor.last_remote_modified_at.isoformat(sep=" ")])

        try:
            response = client.list_resource(
                doctype="Customer",
                filters=filters or None,
                fields=[
                    "name",
                    "customer_name",
                    "mobile_no",
                    "email_id",
                    "customer_group",
                    "customer_type",
                    "disabled",
                    "modified",
                ],
                limit_page_length=limit,
            )
            rows = response.get("data", [])
            imported = 0
            latest_modified_at = cursor.last_remote_modified_at
            latest_remote_name = cursor.last_remote_cursor

            for row in rows:
                remote_name = str(row.get("name", "")).strip()
                if not remote_name:
                    continue
                modified_at = self._parse_remote_timestamp(row.get("modified"))
                if modified_at and (latest_modified_at is None or modified_at > latest_modified_at):
                    latest_modified_at = modified_at
                    latest_remote_name = remote_name

                defaults = {
                    "name": row.get("customer_name") or remote_name,
                    "phone": row.get("mobile_no") or "-",
                    "email": row.get("email_id") or "",
                    "notes": "",
                    "status": Customer.Status.ARCHIVED if row.get("disabled") else Customer.Status.ACTIVE,
                    "tombstone": False,
                    "source_meta_json": row,
                    "source_system": "erpnext",
                    "source_id": remote_name,
                    "source_shop_id": binding.company,
                    "source_path": f"Customer/{remote_name}",
                    "migrated_at": timezone.now(),
                }
                customer, created = Customer.objects.get_or_create(
                    shop=shop,
                    source_system="erpnext",
                    source_id=remote_name,
                    defaults=defaults,
                )
                if not created:
                    for field, value in defaults.items():
                        setattr(customer, field, value)
                    customer.save()

                self._link_document(
                    shop=shop,
                    local_domain=ERPNextDocumentLink.LocalDomain.CUSTOMER,
                    local_object_id=str(customer.id),
                    remote_doctype="Customer",
                    remote_name=remote_name,
                    direction=ERPNextDocumentLink.Direction.PULL,
                    metadata_json=row,
                )
                imported += 1

            self._finish_cursor_run(
                cursor=cursor,
                status=ERPNextSyncCursor.Status.SUCCEEDED,
                result_count=imported,
                remote_modified_at=latest_modified_at,
                remote_cursor=latest_remote_name or "",
            )
            return {
                "domain": ERPNextSyncCursor.Domain.CUSTOMERS,
                "direction": ERPNextSyncCursor.Direction.PULL,
                "imported_count": imported,
                "cursor": cursor.last_remote_cursor,
            }
        except Exception as exc:
            self._finish_cursor_run(
                cursor=cursor,
                status=ERPNextSyncCursor.Status.FAILED,
                result_count=0,
                error_message=str(exc),
            )
            raise

    def sync_suppliers(self, *, shop: Shop, limit: int = 100) -> dict[str, Any]:
        binding = self._require_binding(shop=shop)
        if not binding.purchase_sync_enabled:
            raise ERPNextConfigurationError("Supplier sync is disabled because purchase sync is not enabled for this shop binding.")
        cursor = self._get_cursor(shop=shop, domain=ERPNextSyncCursor.Domain.SUPPLIERS, direction=ERPNextSyncCursor.Direction.PULL)
        client = self.build_client(binding=binding)
        self._begin_cursor_run(cursor=cursor)

        filters: list[list[Any]] = []
        if binding.supplier_group:
            filters.append(["Supplier", "supplier_group", "=", binding.supplier_group])
        if cursor.last_remote_modified_at:
            filters.append(["Supplier", "modified", ">", cursor.last_remote_modified_at.isoformat(sep=" ")])

        try:
            response = client.list_resource(
                doctype="Supplier",
                filters=filters or None,
                fields=[
                    "name",
                    "supplier_name",
                    "supplier_group",
                    "supplier_type",
                    "mobile_no",
                    "email_id",
                    "disabled",
                    "modified",
                ],
                limit_page_length=limit,
            )
            rows = response.get("data", [])
            imported = 0
            latest_modified_at = cursor.last_remote_modified_at
            latest_remote_name = cursor.last_remote_cursor

            for row in rows:
                remote_name = str(row.get("name", "")).strip()
                if not remote_name:
                    continue
                modified_at = self._parse_remote_timestamp(row.get("modified"))
                if modified_at and (latest_modified_at is None or modified_at > latest_modified_at):
                    latest_modified_at = modified_at
                    latest_remote_name = remote_name

                supplier, created = ERPNextSupplierMirror.objects.get_or_create(
                    shop=shop,
                    remote_name=remote_name,
                    defaults={
                        "supplier_name": row.get("supplier_name") or remote_name,
                        "supplier_group": row.get("supplier_group") or "",
                        "supplier_type": row.get("supplier_type") or "",
                        "phone": row.get("mobile_no") or "",
                        "email": row.get("email_id") or "",
                        "status": ERPNextSupplierMirror.Status.ARCHIVED if row.get("disabled") else ERPNextSupplierMirror.Status.ACTIVE,
                        "last_remote_modified_at": modified_at,
                        "last_synced_at": timezone.now(),
                        "metadata_json": row,
                    },
                )
                if not created:
                    supplier.supplier_name = row.get("supplier_name") or remote_name
                    supplier.supplier_group = row.get("supplier_group") or ""
                    supplier.supplier_type = row.get("supplier_type") or ""
                    supplier.phone = row.get("mobile_no") or ""
                    supplier.email = row.get("email_id") or ""
                    supplier.status = ERPNextSupplierMirror.Status.ARCHIVED if row.get("disabled") else ERPNextSupplierMirror.Status.ACTIVE
                    supplier.last_remote_modified_at = modified_at
                    supplier.last_synced_at = timezone.now()
                    supplier.metadata_json = row
                    supplier.save()

                self._link_document(
                    shop=shop,
                    local_domain=ERPNextDocumentLink.LocalDomain.SUPPLIER,
                    local_object_id=str(supplier.id),
                    remote_doctype="Supplier",
                    remote_name=remote_name,
                    direction=ERPNextDocumentLink.Direction.PULL,
                    metadata_json=row,
                )
                imported += 1

            self._finish_cursor_run(
                cursor=cursor,
                status=ERPNextSyncCursor.Status.SUCCEEDED,
                result_count=imported,
                remote_modified_at=latest_modified_at,
                remote_cursor=latest_remote_name or "",
            )
            return {
                "domain": ERPNextSyncCursor.Domain.SUPPLIERS,
                "direction": ERPNextSyncCursor.Direction.PULL,
                "imported_count": imported,
                "cursor": cursor.last_remote_cursor,
            }
        except Exception as exc:
            self._finish_cursor_run(
                cursor=cursor,
                status=ERPNextSyncCursor.Status.FAILED,
                result_count=0,
                error_message=str(exc),
            )
            raise

    def sync_stock(self, *, shop: Shop, limit: int = 200) -> dict[str, Any]:
        binding = self._require_binding(shop=shop)
        if not binding.stock_sync_enabled:
            raise ERPNextConfigurationError("Stock sync is disabled for this shop binding.")
        cursor = self._get_cursor(shop=shop, domain=ERPNextSyncCursor.Domain.STOCK, direction=ERPNextSyncCursor.Direction.PULL)
        client = self.build_client(binding=binding)
        self._begin_cursor_run(cursor=cursor)

        filters: list[list[Any]] = []
        if binding.warehouse:
            filters.append(["Bin", "warehouse", "=", binding.warehouse])
        if cursor.last_remote_modified_at:
            filters.append(["Bin", "modified", ">", cursor.last_remote_modified_at.isoformat(sep=" ")])

        try:
            response = client.list_resource(
                doctype="Bin",
                filters=filters or None,
                fields=["name", "item_code", "warehouse", "actual_qty", "modified"],
                limit_page_length=limit,
            )
            rows = response.get("data", [])
            reconciled = 0
            skipped = 0
            latest_modified_at = cursor.last_remote_modified_at
            latest_remote_name = cursor.last_remote_cursor

            for row in rows:
                remote_name = str(row.get("name", "")).strip()
                item_code = str(row.get("item_code", "")).strip()
                if not item_code:
                    continue
                modified_at = self._parse_remote_timestamp(row.get("modified"))
                if modified_at and (latest_modified_at is None or modified_at > latest_modified_at):
                    latest_modified_at = modified_at
                    latest_remote_name = remote_name

                item = InventoryItem.objects.filter(
                    shop=shop,
                    source_system="erpnext",
                    source_id=item_code,
                    tombstone=False,
                ).first()
                if item is None:
                    skipped += 1
                    continue
                local_stock = int(
                    item.ledger_entries.aggregate(total=Coalesce(Sum("quantity_delta"), 0)).get("total") or 0
                )
                remote_stock = int(Decimal(str(row.get("actual_qty") or "0")))
                quantity_delta = remote_stock - local_stock
                if quantity_delta != 0:
                    InventoryStockLedger.objects.create(
                        shop=shop,
                        item=item,
                        actor_user=None,
                        event_type=InventoryStockLedger.EventType.SYNC,
                        quantity_delta=quantity_delta,
                        unit_price=item.sell_price,
                        note=f"ERPNext stock sync from {row.get('warehouse') or binding.warehouse or 'warehouse'}",
                        occurred_at=timezone.now(),
                        source_system="erpnext",
                        source_id=remote_name or item_code,
                        source_shop_id=binding.company,
                        source_path=f"Bin/{remote_name or item_code}",
                    )
                item.source_meta_json = {**item.source_meta_json, "last_bin_sync": row}
                item.save(update_fields=["source_meta_json", "updated_at"])
                reconciled += 1

            self._finish_cursor_run(
                cursor=cursor,
                status=ERPNextSyncCursor.Status.SUCCEEDED,
                result_count=reconciled,
                remote_modified_at=latest_modified_at,
                remote_cursor=latest_remote_name or "",
            )
            return {
                "domain": ERPNextSyncCursor.Domain.STOCK,
                "direction": ERPNextSyncCursor.Direction.PULL,
                "reconciled_count": reconciled,
                "skipped_count": skipped,
                "cursor": cursor.last_remote_cursor,
            }
        except Exception as exc:
            self._finish_cursor_run(
                cursor=cursor,
                status=ERPNextSyncCursor.Status.FAILED,
                result_count=0,
                error_message=str(exc),
            )
            raise

    def sync_purchases(self, *, shop: Shop, limit: int = 100) -> dict[str, Any]:
        binding = self._require_binding(shop=shop)
        if not binding.purchase_sync_enabled:
            raise ERPNextConfigurationError("Purchase sync is disabled for this shop binding.")
        cursor = self._get_cursor(shop=shop, domain=ERPNextSyncCursor.Domain.PURCHASES, direction=ERPNextSyncCursor.Direction.PULL)
        client = self.build_client(binding=binding)
        self._begin_cursor_run(cursor=cursor)

        filters: list[list[Any]] = []
        if cursor.last_remote_modified_at:
            filters.append(["Purchase Receipt", "modified", ">", cursor.last_remote_modified_at.isoformat(sep=" ")])
        if binding.warehouse:
            filters.append(["Purchase Receipt", "set_warehouse", "=", binding.warehouse])

        try:
            response = client.list_resource(
                doctype="Purchase Receipt",
                filters=filters or None,
                fields=[
                    "name",
                    "supplier",
                    "posting_date",
                    "grand_total",
                    "status",
                    "docstatus",
                    "currency",
                    "set_warehouse",
                    "modified",
                ],
                limit_page_length=limit,
            )
            rows = response.get("data", [])
            imported = 0
            latest_modified_at = cursor.last_remote_modified_at
            latest_remote_name = cursor.last_remote_cursor

            for row in rows:
                remote_name = str(row.get("name", "")).strip()
                if not remote_name:
                    continue
                detail_response = client.get_resource(doctype="Purchase Receipt", name=remote_name)
                detail = detail_response.get("data") or {}
                modified_at = self._parse_remote_timestamp(row.get("modified") or detail.get("modified"))
                if modified_at and (latest_modified_at is None or modified_at > latest_modified_at):
                    latest_modified_at = modified_at
                    latest_remote_name = remote_name

                supplier_remote_name = str(detail.get("supplier") or row.get("supplier") or "").strip()
                supplier = None
                if supplier_remote_name:
                    supplier = ERPNextSupplierMirror.objects.filter(shop=shop, remote_name=supplier_remote_name).first()

                items = detail.get("items") or []
                purchase, created = ERPNextPurchaseMirror.objects.get_or_create(
                    shop=shop,
                    remote_doctype="Purchase Receipt",
                    remote_name=remote_name,
                    defaults={
                        "supplier": supplier,
                        "supplier_remote_name": supplier_remote_name,
                        "posting_date": detail.get("posting_date") or row.get("posting_date"),
                        "warehouse": detail.get("set_warehouse") or row.get("set_warehouse") or "",
                        "currency_code": detail.get("currency") or row.get("currency") or binding.currency_code,
                        "grand_total": Decimal(str(detail.get("grand_total") or row.get("grand_total") or "0")),
                        "status": self._map_purchase_status(detail.get("docstatus", row.get("docstatus")), detail.get("status") or row.get("status")),
                        "docstatus": int(detail.get("docstatus") or row.get("docstatus") or 0),
                        "item_count": len(items),
                        "items_json": items,
                        "metadata_json": detail,
                        "last_remote_modified_at": modified_at,
                        "last_synced_at": timezone.now(),
                    },
                )
                if not created:
                    purchase.supplier = supplier
                    purchase.supplier_remote_name = supplier_remote_name
                    purchase.posting_date = detail.get("posting_date") or row.get("posting_date")
                    purchase.warehouse = detail.get("set_warehouse") or row.get("set_warehouse") or ""
                    purchase.currency_code = detail.get("currency") or row.get("currency") or binding.currency_code
                    purchase.grand_total = Decimal(str(detail.get("grand_total") or row.get("grand_total") or "0"))
                    purchase.status = self._map_purchase_status(detail.get("docstatus", row.get("docstatus")), detail.get("status") or row.get("status"))
                    purchase.docstatus = int(detail.get("docstatus") or row.get("docstatus") or 0)
                    purchase.item_count = len(items)
                    purchase.items_json = items
                    purchase.metadata_json = detail
                    purchase.last_remote_modified_at = modified_at
                    purchase.last_synced_at = timezone.now()
                    purchase.save()

                for purchase_item in items:
                    item_code = str(purchase_item.get("item_code", "")).strip()
                    if not item_code:
                        continue
                    inventory_item = InventoryItem.objects.filter(
                        shop=shop,
                        source_system="erpnext",
                        source_id=item_code,
                        tombstone=False,
                    ).select_related("private").first()
                    if inventory_item is None:
                        continue
                    private, _ = InventoryItemPrivate.objects.get_or_create(item=inventory_item)
                    if supplier_remote_name:
                        private.supplier_id = supplier_remote_name
                    if purchase.posting_date:
                        private.last_purchase_date = purchase.posting_date
                    if purchase_item.get("rate") is not None:
                        private.cost_price = Decimal(str(purchase_item.get("rate") or "0"))
                    private.save()

                self._link_document(
                    shop=shop,
                    local_domain=ERPNextDocumentLink.LocalDomain.PURCHASE,
                    local_object_id=str(purchase.id),
                    remote_doctype="Purchase Receipt",
                    remote_name=remote_name,
                    direction=ERPNextDocumentLink.Direction.PULL,
                    metadata_json={"posting_date": str(purchase.posting_date), "supplier": supplier_remote_name},
                )
                imported += 1

            self._finish_cursor_run(
                cursor=cursor,
                status=ERPNextSyncCursor.Status.SUCCEEDED,
                result_count=imported,
                remote_modified_at=latest_modified_at,
                remote_cursor=latest_remote_name or "",
            )
            return {
                "domain": ERPNextSyncCursor.Domain.PURCHASES,
                "direction": ERPNextSyncCursor.Direction.PULL,
                "imported_count": imported,
                "cursor": cursor.last_remote_cursor,
            }
        except Exception as exc:
            self._finish_cursor_run(
                cursor=cursor,
                status=ERPNextSyncCursor.Status.FAILED,
                result_count=0,
                error_message=str(exc),
            )
            raise

    def _map_purchase_status(self, docstatus: Any, status_value: Any) -> str:
        if int(docstatus or 0) == 2:
            return ERPNextPurchaseMirror.Status.CANCELLED
        if int(docstatus or 0) == 1:
            return ERPNextPurchaseMirror.Status.SUBMITTED
        if int(docstatus or 0) == 0:
            return ERPNextPurchaseMirror.Status.DRAFT
        return ERPNextPurchaseMirror.Status.UNKNOWN

    def _resolve_sale_customer_remote_name(self, *, binding: ERPNextShopBinding, sale: Sale) -> str:
        if sale.customer_id and sale.customer and sale.customer.source_system == "erpnext" and sale.customer.source_id:
            return sale.customer.source_id
        walk_in_customer = self._erpnext_walk_in_customer(binding=binding)
        if walk_in_customer:
            return walk_in_customer
        raise ERPNextConfigurationError(
            f"Sale {sale.receipt_number or sale.id} has no ERPNext customer mapping and no walk-in customer configured."
        )

    def _resolve_sale_item_payloads(self, *, binding: ERPNextShopBinding, sale: Sale) -> list[dict[str, Any]]:
        payloads: list[dict[str, Any]] = []
        sale_items = SaleItem.objects.select_related("inventory_item").filter(sale=sale).order_by("created_at")
        for item in sale_items:
            if item.inventory_item_id is None or item.inventory_item.source_system != "erpnext" or not item.inventory_item.source_id:
                raise ERPNextConfigurationError(
                    f"Sale {sale.receipt_number or sale.id} contains item {item.name_snapshot} without an ERPNext item mapping."
                )
            payloads.append(
                {
                    "item_code": item.inventory_item.source_id,
                    "item_name": item.name_snapshot,
                    "qty": item.quantity,
                    "rate": str(item.unit_price),
                    "warehouse": binding.warehouse or item.inventory_item.source_meta_json.get("default_warehouse") or "",
                }
            )
        return payloads

    def push_sales(self, *, shop: Shop, limit: int = 25) -> dict[str, Any]:
        binding = self._require_binding(shop=shop)
        if not binding.sales_posting_enabled:
            raise ERPNextConfigurationError("Sales posting is disabled for this shop binding.")
        cursor = self._get_cursor(shop=shop, domain=ERPNextSyncCursor.Domain.SALES, direction=ERPNextSyncCursor.Direction.PUSH)
        client = self.build_client(binding=binding)
        self._begin_cursor_run(cursor=cursor)

        sales = (
            Sale.objects.filter(shop=shop, tombstone=False, status=Sale.Status.COMPLETED)
            .exclude(source_system="erpnext")
            .select_related("customer", "actor_user")
            .order_by("sale_date", "created_at")[:limit]
        )

        created_count = 0
        failures: list[dict[str, Any]] = []
        latest_remote_name = cursor.last_remote_cursor

        for sale in sales:
            if ERPNextDocumentLink.objects.filter(
                shop=shop,
                local_domain=ERPNextDocumentLink.LocalDomain.SALE,
                local_object_id=str(sale.id),
                remote_doctype="Sales Invoice",
                sync_status=ERPNextDocumentLink.SyncStatus.LINKED,
            ).exists():
                continue

            try:
                payload = {
                    "customer": self._resolve_sale_customer_remote_name(binding=binding, sale=sale),
                    "company": binding.company,
                    "currency": binding.currency_code,
                    "posting_date": sale.sale_date.isoformat(),
                    "due_date": sale.sale_date.isoformat(),
                    "selling_price_list": binding.selling_price_list,
                    "set_warehouse": binding.warehouse,
                    "update_stock": 1 if binding.stock_sync_enabled else 0,
                    "is_pos": 1,
                    "items": self._resolve_sale_item_payloads(binding=binding, sale=sale),
                    "remarks": sale.note or sale.footer_note or f"Business Hub sale {sale.receipt_number}",
                }
                optional_receivable = str(binding.metadata_json.get("receivable_account", "")).strip()
                if optional_receivable:
                    payload["debit_to"] = optional_receivable
                remote_response = client.create_resource(doctype="Sales Invoice", payload=payload)
                remote_doc = remote_response.get("data") or {}
                remote_name = str(remote_doc.get("name", "")).strip()
                if not remote_name:
                    raise ERPNextApiError(message="ERPNext did not return a Sales Invoice name.", payload=remote_response)

                self._link_document(
                    shop=shop,
                    local_domain=ERPNextDocumentLink.LocalDomain.SALE,
                    local_object_id=str(sale.id),
                    remote_doctype="Sales Invoice",
                    remote_name=remote_name,
                    direction=ERPNextDocumentLink.Direction.PUSH,
                    metadata_json={"request": payload, "response": remote_doc},
                )
                latest_remote_name = remote_name
                created_count += 1
            except Exception as exc:
                failures.append(
                    {
                        "sale_id": str(sale.id),
                        "receipt_number": sale.receipt_number,
                        "error": str(exc),
                    }
                )
                self._mark_failed_link(
                    shop=shop,
                    local_domain=ERPNextDocumentLink.LocalDomain.SALE,
                    local_object_id=str(sale.id),
                    remote_doctype="Sales Invoice",
                    direction=ERPNextDocumentLink.Direction.PUSH,
                    remote_name=sale.receipt_number or str(sale.id),
                    error_message=str(exc),
                    metadata_json={"receipt_number": sale.receipt_number},
                )

        self._finish_cursor_run(
            cursor=cursor,
            status=ERPNextSyncCursor.Status.FAILED if failures else ERPNextSyncCursor.Status.SUCCEEDED,
            result_count=created_count,
            error_message=failures[0]["error"] if failures else "",
            remote_cursor=latest_remote_name or "",
        )
        return {
            "domain": ERPNextSyncCursor.Domain.SALES,
            "direction": ERPNextSyncCursor.Direction.PUSH,
            "pushed_count": created_count,
            "failed_count": len(failures),
            "failures": failures,
        }

    def push_payments(self, *, shop: Shop, limit: int = 25) -> dict[str, Any]:
        binding = self._require_binding(shop=shop)
        if not binding.payment_posting_enabled:
            raise ERPNextConfigurationError("Payment posting is disabled for this shop binding.")
        cursor = self._get_cursor(shop=shop, domain=ERPNextSyncCursor.Domain.PAYMENTS, direction=ERPNextSyncCursor.Direction.PUSH)
        client = self.build_client(binding=binding)
        self._begin_cursor_run(cursor=cursor)

        payments = (
            SalePayment.objects.filter(shop=shop, sale__tombstone=False)
            .exclude(source_system="erpnext")
            .select_related("sale__customer", "actor_user")
            .order_by("occurred_at", "created_at")[:limit]
        )

        pushed_count = 0
        failures: list[dict[str, Any]] = []
        latest_remote_name = cursor.last_remote_cursor

        for payment in payments:
            if ERPNextDocumentLink.objects.filter(
                shop=shop,
                local_domain=ERPNextDocumentLink.LocalDomain.PAYMENT,
                local_object_id=str(payment.id),
                remote_doctype="Payment Entry",
                sync_status=ERPNextDocumentLink.SyncStatus.LINKED,
            ).exists():
                continue

            invoice_link = ERPNextDocumentLink.objects.filter(
                shop=shop,
                local_domain=ERPNextDocumentLink.LocalDomain.SALE,
                local_object_id=str(payment.sale_id),
                remote_doctype="Sales Invoice",
                sync_status=ERPNextDocumentLink.SyncStatus.LINKED,
            ).first()

            try:
                if invoice_link is None:
                    raise ERPNextConfigurationError(
                        f"Payment {payment.id} cannot be pushed before its sale is linked to an ERPNext Sales Invoice."
                    )
                paid_to = self._payment_account_for_method(binding=binding, payment_method=payment.payment_method)
                if not paid_to:
                    raise ERPNextConfigurationError(
                        f"No ERPNext payment account is configured for payment method {payment.payment_method}."
                    )
                payload = {
                    "payment_type": "Receive",
                    "party_type": "Customer",
                    "party": self._resolve_sale_customer_remote_name(binding=binding, sale=payment.sale),
                    "company": binding.company,
                    "posting_date": payment.occurred_at.date().isoformat(),
                    "mode_of_payment": self._mode_of_payment_for_method(binding=binding, payment_method=payment.payment_method),
                    "paid_to": paid_to,
                    "paid_amount": str(payment.amount),
                    "received_amount": str(payment.amount),
                    "reference_no": payment.reference_code or payment.sale.receipt_number,
                    "reference_date": payment.occurred_at.date().isoformat(),
                    "remarks": payment.note or f"Business Hub payment for {payment.sale.receipt_number}",
                    "references": [
                        {
                            "reference_doctype": "Sales Invoice",
                            "reference_name": invoice_link.remote_name,
                            "allocated_amount": str(payment.amount),
                        }
                    ],
                }
                remote_response = client.create_resource(doctype="Payment Entry", payload=payload)
                remote_doc = remote_response.get("data") or {}
                remote_name = str(remote_doc.get("name", "")).strip()
                if not remote_name:
                    raise ERPNextApiError(message="ERPNext did not return a Payment Entry name.", payload=remote_response)

                self._link_document(
                    shop=shop,
                    local_domain=ERPNextDocumentLink.LocalDomain.PAYMENT,
                    local_object_id=str(payment.id),
                    remote_doctype="Payment Entry",
                    remote_name=remote_name,
                    direction=ERPNextDocumentLink.Direction.PUSH,
                    metadata_json={"request": payload, "response": remote_doc},
                )
                latest_remote_name = remote_name
                pushed_count += 1
            except Exception as exc:
                failures.append(
                    {
                        "payment_id": str(payment.id),
                        "sale_id": str(payment.sale_id),
                        "error": str(exc),
                    }
                )
                self._mark_failed_link(
                    shop=shop,
                    local_domain=ERPNextDocumentLink.LocalDomain.PAYMENT,
                    local_object_id=str(payment.id),
                    remote_doctype="Payment Entry",
                    direction=ERPNextDocumentLink.Direction.PUSH,
                    remote_name=payment.reference_code or payment.sale.receipt_number,
                    error_message=str(exc),
                    metadata_json={"sale_id": str(payment.sale_id)},
                )

        self._finish_cursor_run(
            cursor=cursor,
            status=ERPNextSyncCursor.Status.FAILED if failures else ERPNextSyncCursor.Status.SUCCEEDED,
            result_count=pushed_count,
            error_message=failures[0]["error"] if failures else "",
            remote_cursor=latest_remote_name or "",
        )
        return {
            "domain": ERPNextSyncCursor.Domain.PAYMENTS,
            "direction": ERPNextSyncCursor.Direction.PUSH,
            "pushed_count": pushed_count,
            "failed_count": len(failures),
            "failures": failures,
        }

    def run_cycle(
        self,
        *,
        shop: Shop,
        limit: int = 100,
        verify_connection: bool = True,
        sync_items: bool = True,
        sync_customers: bool = True,
        sync_stock: bool = True,
        sync_suppliers: bool = True,
        sync_purchases: bool = True,
        push_sales: bool = True,
        push_payments: bool = True,
    ) -> dict[str, Any]:
        binding = self._require_binding(shop=shop)
        steps: list[dict[str, Any]] = []
        overall_status = "ok"

        if verify_connection:
            health_payload = self.health_check(binding=binding)
            self.apply_health_payload(binding=binding, payload=health_payload)
            step_payload = {
                "step": "verify_connection",
                "status": health_payload.get("status"),
                "reachable": health_payload.get("reachable", False),
                "authenticated": health_payload.get("authenticated", False),
            }
            steps.append(step_payload)
            if health_payload.get("status") != ERPNextShopBinding.HealthStatus.OK:
                return {
                    "shop_id": str(shop.id),
                    "overall_status": "blocked",
                    "steps": steps,
                    "detail": health_payload.get("error", "ERPNext health verification failed."),
                }

        action_plan = [
            ("sync_items", sync_items, self.sync_items),
            ("sync_customers", sync_customers, self.sync_customers),
            ("sync_stock", sync_stock, self.sync_stock),
            ("sync_suppliers", sync_suppliers, self.sync_suppliers),
            ("sync_purchases", sync_purchases, self.sync_purchases),
            ("push_sales", push_sales, self.push_sales),
            ("push_payments", push_payments, self.push_payments),
        ]

        for step_name, enabled, handler in action_plan:
            if not enabled:
                steps.append({"step": step_name, "status": "skipped"})
                continue
            try:
                result = handler(shop=shop, limit=limit)
                steps.append({"step": step_name, "status": "ok", "result": result})
            except Exception as exc:
                overall_status = "partial" if any(step["status"] == "ok" for step in steps) else "failed"
                steps.append({"step": step_name, "status": "failed", "detail": str(exc)})
                break

        return {
            "shop_id": str(shop.id),
            "overall_status": overall_status,
            "steps": steps,
            "poc_summary": self.build_poc_summary(shop=shop),
        }

    def build_poc_summary(self, *, shop: Shop) -> dict[str, Any]:
        self.ensure_default_cursors(shop=shop)
        binding = ERPNextShopBinding.objects.filter(shop=shop).first()
        cursor_rows = ERPNextSyncCursor.objects.filter(shop=shop).order_by("domain", "direction")
        document_links = ERPNextDocumentLink.objects.filter(shop=shop)

        return {
            "shop_id": str(shop.id),
            "shop_slug": shop.slug,
            "binding": {
                "present": binding is not None,
                "enabled": binding.is_enabled if binding else False,
                "environment": binding.environment if binding else ERPNextShopBinding.Environment.SANDBOX,
                "company": binding.company if binding else "",
                "warehouse": binding.warehouse if binding else "",
                "health_status": binding.last_health_status if binding else ERPNextShopBinding.HealthStatus.UNKNOWN,
                "last_verified_at": binding.last_verified_at if binding else None,
            },
            "local_counts": {
                "inventory_items": InventoryItem.objects.filter(shop=shop, tombstone=False).count(),
                "customers": Customer.objects.filter(shop=shop, tombstone=False).count(),
                "sales": Sale.objects.filter(shop=shop, tombstone=False).count(),
                "payments": SalePayment.objects.filter(shop=shop, sale__tombstone=False).count(),
                "erpnext_suppliers": ERPNextSupplierMirror.objects.filter(shop=shop).count(),
                "erpnext_purchases": ERPNextPurchaseMirror.objects.filter(shop=shop).count(),
            },
            "cursor_status": {
                "total": cursor_rows.count(),
                "idle": cursor_rows.filter(status=ERPNextSyncCursor.Status.IDLE).count(),
                "running": cursor_rows.filter(status=ERPNextSyncCursor.Status.RUNNING).count(),
                "failed": cursor_rows.filter(status=ERPNextSyncCursor.Status.FAILED).count(),
                "succeeded": cursor_rows.filter(status=ERPNextSyncCursor.Status.SUCCEEDED).count(),
            },
            "document_links": {
                "total": document_links.count(),
                "linked": document_links.filter(sync_status=ERPNextDocumentLink.SyncStatus.LINKED).count(),
                "pending": document_links.filter(sync_status=ERPNextDocumentLink.SyncStatus.PENDING).count(),
                "failed": document_links.filter(sync_status=ERPNextDocumentLink.SyncStatus.FAILED).count(),
            },
            "recommendation": (
                "Verify ERPNext connectivity, bind the shop company/warehouse, then run item/customer sync first."
            ),
        }
