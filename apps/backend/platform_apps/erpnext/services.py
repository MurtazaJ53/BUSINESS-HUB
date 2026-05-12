from __future__ import annotations

import json
import ssl
from dataclasses import dataclass
from typing import Any
from urllib import error, parse, request

from django.conf import settings
from django.utils import timezone

from platform_apps.customers.models import Customer
from platform_apps.erpnext.models import ERPNextDocumentLink, ERPNextShopBinding, ERPNextSyncCursor
from platform_apps.inventory.models import InventoryItem
from platform_apps.payments.models import SalePayment
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

    @staticmethod
    def environment_meta(*, binding: ERPNextShopBinding | None = None) -> dict[str, Any]:
        base_url = (binding.site_url_override if binding and binding.site_url_override else settings.ERPNEXT_BASE_URL).strip()
        has_token = bool(settings.ERPNEXT_API_KEY and settings.ERPNEXT_API_SECRET)
        return {
            "configured": bool(base_url and has_token),
            "base_url": base_url,
            "site_name": settings.ERPNEXT_SITE_NAME,
            "verify_ssl": settings.ERPNEXT_VERIFY_SSL,
            "timeout_seconds": settings.ERPNEXT_TIMEOUT_SECONDS,
            "has_api_key": bool(settings.ERPNEXT_API_KEY),
            "has_api_secret": bool(settings.ERPNEXT_API_SECRET),
        }

    def build_client(self, *, binding: ERPNextShopBinding | None = None) -> ERPNextClient:
        meta = self.environment_meta(binding=binding)
        if not meta["configured"]:
            raise ERPNextConfigurationError(
                "ERPNext is not fully configured. Set ERPNEXT_BASE_URL, ERPNEXT_API_KEY, and ERPNEXT_API_SECRET."
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
