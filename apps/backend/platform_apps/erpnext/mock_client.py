from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from django.utils import timezone


DEFAULT_COMPANY = "Zarra Retail Private Limited"
DEFAULT_WAREHOUSE = "Limbdi Warehouse - ZR"


def build_demo_mock_state(*, company: str = DEFAULT_COMPANY, warehouse: str = DEFAULT_WAREHOUSE) -> dict[str, Any]:
    return {
        "site_name": "business-hub-mock",
        "logged_user": "mock-erpnext@business-hub.local",
        "resources": {
            "Item": [
                {
                    "name": "ITEM-0001",
                    "item_code": "ITEM-0001",
                    "item_name": "Cotton Shirt",
                    "item_group": "Shirts",
                    "description": "Combed cotton shop shirt",
                    "standard_rate": "749.00",
                    "disabled": 0,
                    "stock_uom": "Nos",
                    "default_warehouse": warehouse,
                    "modified": "2026-05-12 10:00:00",
                },
                {
                    "name": "ITEM-0002",
                    "item_code": "ITEM-0002",
                    "item_name": "Denim Jeans",
                    "item_group": "Bottomwear",
                    "description": "Slim fit denim jeans",
                    "standard_rate": "1299.00",
                    "disabled": 0,
                    "stock_uom": "Nos",
                    "default_warehouse": warehouse,
                    "modified": "2026-05-12 10:05:00",
                },
                {
                    "name": "ITEM-0003",
                    "item_code": "ITEM-0003",
                    "item_name": "Daily T-Shirt",
                    "item_group": "T-Shirts",
                    "description": "Crew neck daily wear t-shirt",
                    "standard_rate": "399.00",
                    "disabled": 0,
                    "stock_uom": "Nos",
                    "default_warehouse": warehouse,
                    "modified": "2026-05-12 10:07:00",
                },
            ],
            "Customer": [
                {
                    "name": "CUST-0001",
                    "customer_name": "Ayaan Retail",
                    "mobile_no": "9999999999",
                    "email_id": "ayaan@example.com",
                    "customer_group": "Retail",
                    "customer_type": "Company",
                    "disabled": 0,
                    "modified": "2026-05-12 10:10:00",
                },
                {
                    "name": "CUST-0002",
                    "customer_name": "Nidhi Fashions",
                    "mobile_no": "8888888888",
                    "email_id": "nidhi@example.com",
                    "customer_group": "Retail",
                    "customer_type": "Company",
                    "disabled": 0,
                    "modified": "2026-05-12 10:12:00",
                },
                {
                    "name": "WALKIN-0001",
                    "customer_name": "Walk In Customer",
                    "mobile_no": "",
                    "email_id": "",
                    "customer_group": "Retail",
                    "customer_type": "Individual",
                    "disabled": 0,
                    "modified": "2026-05-12 10:13:00",
                },
            ],
            "Supplier": [
                {
                    "name": "SUP-0001",
                    "supplier_name": "Metro Textiles",
                    "supplier_group": "Fabric Vendors",
                    "supplier_type": "Company",
                    "mobile_no": "7777777777",
                    "email_id": "metro@example.com",
                    "disabled": 0,
                    "modified": "2026-05-12 10:14:00",
                },
                {
                    "name": "SUP-0002",
                    "supplier_name": "Prime Apparel Source",
                    "supplier_group": "Fabric Vendors",
                    "supplier_type": "Company",
                    "mobile_no": "7666666666",
                    "email_id": "prime@example.com",
                    "disabled": 0,
                    "modified": "2026-05-12 10:15:00",
                },
            ],
            "Bin": [
                {
                    "name": "BIN-ITEM-0001",
                    "item_code": "ITEM-0001",
                    "warehouse": warehouse,
                    "actual_qty": "12",
                    "modified": "2026-05-12 10:20:00",
                },
                {
                    "name": "BIN-ITEM-0002",
                    "item_code": "ITEM-0002",
                    "warehouse": warehouse,
                    "actual_qty": "6",
                    "modified": "2026-05-12 10:22:00",
                },
                {
                    "name": "BIN-ITEM-0003",
                    "item_code": "ITEM-0003",
                    "warehouse": warehouse,
                    "actual_qty": "18",
                    "modified": "2026-05-12 10:24:00",
                },
            ],
            "Purchase Receipt": [
                {
                    "name": "PREC-0001",
                    "supplier": "SUP-0001",
                    "posting_date": "2026-05-11",
                    "grand_total": "8700.00",
                    "status": "Completed",
                    "docstatus": 1,
                    "currency": "INR",
                    "set_warehouse": warehouse,
                    "modified": "2026-05-12 10:30:00",
                    "items": [
                        {
                            "item_code": "ITEM-0001",
                            "item_name": "Cotton Shirt",
                            "qty": 10,
                            "rate": "520.00",
                        },
                        {
                            "item_code": "ITEM-0003",
                            "item_name": "Daily T-Shirt",
                            "qty": 15,
                            "rate": "280.00",
                        },
                    ],
                }
            ],
            "Purchase Order": [
                {
                    "name": "PO-0001",
                    "supplier": "SUP-0002",
                    "transaction_date": "2026-05-10",
                    "grand_total": "5400.00",
                    "status": "To Receive and Bill",
                    "docstatus": 1,
                    "currency": "INR",
                    "set_warehouse": warehouse,
                    "is_return": 0,
                    "return_against": "",
                    "modified": "2026-05-12 10:32:00",
                    "items": [
                        {
                            "item_code": "ITEM-0002",
                            "item_name": "Denim Jeans",
                            "qty": 4,
                            "rate": "950.00",
                            "warehouse": warehouse,
                        }
                    ],
                }
            ],
            "Purchase Invoice": [
                {
                    "name": "PINV-0001",
                    "supplier": "SUP-0001",
                    "posting_date": "2026-05-12",
                    "grand_total": "1450.00",
                    "status": "Paid",
                    "docstatus": 1,
                    "currency": "INR",
                    "set_warehouse": warehouse,
                    "is_return": 1,
                    "return_against": "PREC-0001",
                    "modified": "2026-05-12 10:34:00",
                    "items": [
                        {
                            "item_code": "ITEM-0001",
                            "item_name": "Cotton Shirt",
                            "qty": 2,
                            "rate": "725.00",
                            "warehouse": warehouse,
                        }
                    ],
                }
            ],
            "Sales Invoice": [],
            "Payment Entry": [
                {
                    "name": "SUPPAY-0001",
                    "party_type": "Supplier",
                    "party": "SUP-0001",
                    "posting_date": "2026-05-12",
                    "payment_type": "Pay",
                    "mode_of_payment": "Bank",
                    "reference_no": "NEFT-0001",
                    "paid_amount": "1450.00",
                    "received_amount": "1450.00",
                    "docstatus": 1,
                    "status": "Submitted",
                    "paid_from_account_currency": "INR",
                    "paid_to_account_currency": "INR",
                    "modified": "2026-05-12 10:36:00",
                }
            ],
        },
        "sequences": {
            "Sales Invoice": 1,
            "Payment Entry": 1,
        },
        "meta": {
            "company": company,
            "warehouse": warehouse,
        },
    }


def write_mock_state(path: str | Path, state: dict[str, Any] | None = None) -> Path:
    state_path = Path(path)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    payload = state if state is not None else build_demo_mock_state()
    state_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return state_path


@dataclass(slots=True)
class MockERPNextClientSettings:
    base_url: str
    site_name: str
    state_path: Path


class MockERPNextClient:
    def __init__(self, client_settings: MockERPNextClientSettings):
        self.settings = client_settings
        self._ensure_state()

    def _ensure_state(self) -> None:
        if not self.settings.state_path.exists():
            write_mock_state(self.settings.state_path)

    def _load_state(self) -> dict[str, Any]:
        if not self.settings.state_path.exists():
            write_mock_state(self.settings.state_path)
        return json.loads(self.settings.state_path.read_text(encoding="utf-8"))

    def _save_state(self, payload: dict[str, Any]) -> None:
        self.settings.state_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def _resource_rows(self, *, state: dict[str, Any], doctype: str) -> list[dict[str, Any]]:
        resources = state.setdefault("resources", {})
        rows = resources.setdefault(doctype, [])
        return rows

    def _matches_filter(self, row: dict[str, Any], filter_row: list[Any]) -> bool:
        if len(filter_row) != 4:
            return True
        _, field_name, operator, expected = filter_row
        actual = row.get(field_name)
        actual_value = "" if actual is None else str(actual)
        expected_value = "" if expected is None else str(expected)
        if operator == "=":
            return actual_value == expected_value
        if operator == ">":
            return actual_value > expected_value
        if operator == ">=":
            return actual_value >= expected_value
        if operator == "<":
            return actual_value < expected_value
        if operator == "<=":
            return actual_value <= expected_value
        return True

    def _apply_filters(self, rows: list[dict[str, Any]], filters: list[list[Any]] | None) -> list[dict[str, Any]]:
        if not filters:
            return rows
        result = rows
        for filter_row in filters:
            result = [row for row in result if self._matches_filter(row, filter_row)]
        return result

    def ping(self) -> dict[str, Any]:
        return {"message": "pong"}

    def call_method(self, method_name: str, *, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        if method_name == "frappe.auth.get_logged_user":
            state = self._load_state()
            return {"message": state.get("logged_user", "mock-erpnext@business-hub.local")}
        return {"message": "ok", "method": method_name, "payload": payload or {}}

    def list_resource(
        self,
        *,
        doctype: str,
        filters: list[list[Any]] | None = None,
        fields: list[str] | None = None,
        limit_page_length: int = 20,
    ) -> dict[str, Any]:
        state = self._load_state()
        rows = deepcopy(self._resource_rows(state=state, doctype=doctype))
        rows = self._apply_filters(rows, filters)
        rows = rows[:limit_page_length]
        if fields:
            rows = [{field_name: row.get(field_name) for field_name in fields} for row in rows]
        return {"data": rows}

    def get_resource(self, *, doctype: str, name: str) -> dict[str, Any]:
        state = self._load_state()
        rows = self._resource_rows(state=state, doctype=doctype)
        row = next((deepcopy(candidate) for candidate in rows if str(candidate.get("name", "")).strip() == name), None)
        return {"data": row or {}}

    def create_resource(self, *, doctype: str, payload: dict[str, Any]) -> dict[str, Any]:
        state = self._load_state()
        sequences = state.setdefault("sequences", {})
        next_number = int(sequences.get(doctype, 1))
        prefix_map = {
            "Sales Invoice": "SINV-MOCK-",
            "Payment Entry": "PAY-MOCK-",
        }
        prefix = prefix_map.get(doctype, f"{doctype.upper().replace(' ', '-')}-")
        remote_name = f"{prefix}{next_number:04d}"
        sequences[doctype] = next_number + 1

        now_value = timezone.now().strftime("%Y-%m-%d %H:%M:%S")
        document = {
            "doctype": doctype,
            "name": remote_name,
            "modified": now_value,
            **payload,
        }
        self._resource_rows(state=state, doctype=doctype).append(document)
        self._save_state(state)
        return {"data": document}
