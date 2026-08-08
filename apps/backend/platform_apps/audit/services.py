from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal
import uuid

from django.utils import timezone

from platform_apps.audit.models import WorkspaceAuditEvent


def normalize_audit_value(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): normalize_audit_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [normalize_audit_value(item) for item in value]
    return value


def create_workspace_audit_event(
    *,
    shop,
    actor_user=None,
    actor_role: str = "",
    category: str,
    event_type: str,
    entity_type: str,
    entity_id: str = "",
    entity_label: str = "",
    summary: str,
    source_surface: str = "",
    before=None,
    after=None,
    metadata=None,
    occurred_at=None,
):
    return WorkspaceAuditEvent.objects.create(
        shop=shop,
        actor_user=actor_user,
        actor_role=actor_role,
        category=category,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=str(entity_id or ""),
        entity_label=entity_label or "",
        summary=summary,
        source_surface=source_surface or "",
        before_json=normalize_audit_value(before or {}),
        after_json=normalize_audit_value(after or {}),
        metadata_json=normalize_audit_value(metadata or {}),
        occurred_at=occurred_at or timezone.now(),
    )


def snapshot_membership(membership) -> dict[str, object]:
    return {
        "membership_id": membership.id,
        "member_name": membership.user.full_name or membership.user.email or membership.email,
        "member_email": membership.user.email or membership.email,
        "role": membership.role,
        "status": membership.status,
    }


def snapshot_inventory_item(item) -> dict[str, object]:
    private = getattr(item, "private", None)
    return {
        "item_id": item.id,
        "name": item.name,
        "sku": item.sku,
        "category": item.category,
        "status": item.status,
        "tombstone": item.tombstone,
        "sell_price": item.sell_price,
        "stock_on_hand": getattr(item, "stock_on_hand", None),
        "cost_price": getattr(private, "cost_price", None) if private and not private.tombstone else None,
        "supplier_id": getattr(private, "supplier_id", None) if private and not private.tombstone else None,
        "last_purchase_date": getattr(private, "last_purchase_date", None)
        if private and not private.tombstone
        else None,
    }


def snapshot_customer(customer) -> dict[str, object]:
    return {
        "customer_id": customer.id,
        "name": customer.name,
        "phone": customer.phone,
        "email": customer.email,
        "status": customer.status,
        "tombstone": customer.tombstone,
        "balance": customer.balance,
        "total_spent": customer.total_spent,
    }


def snapshot_customer_ledger_entry(entry) -> dict[str, object]:
    return {
        "entry_id": entry.id,
        "customer_id": entry.customer_id,
        "event_type": entry.event_type,
        "amount_delta": entry.amount_delta,
        "total_spent_delta": entry.total_spent_delta,
        "note": entry.note,
        "occurred_at": entry.occurred_at,
    }


def snapshot_sale(sale) -> dict[str, object]:
    return {
        "sale_id": sale.id,
        "receipt_number": sale.receipt_number,
        "customer_id": sale.customer_id,
        "customer_name": sale.customer_name_snapshot,
        "total_amount": sale.total_amount,
        "amount_received": sale.amount_received,
        "amount_due": sale.amount_due,
        "payment_mode": sale.payment_mode,
        "status": sale.status,
        "sale_date": sale.sale_date,
    }


def snapshot_payment(payment) -> dict[str, object]:
    return {
        "payment_id": payment.id,
        "sale_id": payment.sale_id,
        "payment_method": payment.payment_method,
        "amount": payment.amount,
        "reference_code": payment.reference_code,
        "note": payment.note,
        "occurred_at": payment.occurred_at,
    }
