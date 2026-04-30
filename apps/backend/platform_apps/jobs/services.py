from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.utils import timezone
from firebase_admin import firestore

from platform_apps.audit.models import MigrationReconciliationEvent
from platform_apps.common.migration import (
    MigrationDomain,
    MigrationJobStatus,
    MigrationJobType,
    MigrationWriteMaster,
    ReconciliationSeverity,
    ReconciliationStatus,
)
from platform_apps.customers.models import Customer
from platform_apps.inventory.models import InventoryItem
from platform_apps.jobs.models import MigrationDomainControl, MigrationJobRun
from platform_apps.projections.services import refresh_shop_dashboard_projection
from platform_apps.users.authentication import get_firebase_app


@dataclass
class InventorySnapshotRow:
    source_id: str
    name: str
    sku: str
    barcode: str
    category: str
    subcategory: str
    size: str
    description: str
    sell_price: Decimal
    status: str
    tombstone: bool
    source_meta_json: dict[str, Any]


@dataclass
class CustomerSnapshotRow:
    source_id: str
    name: str
    phone: str
    email: str
    total_spent: Decimal
    balance: Decimal
    notes: str
    status: str
    tombstone: bool
    source_meta_json: dict[str, Any]


class MigrationExecutionError(Exception):
    pass


COMPARE_MANAGED_ISSUE_CODES = {
    "missing_in_postgres",
    "field_drift",
    "missing_in_firebase",
}


def _normalize_decimal(value: Any) -> Decimal:
    if value in (None, ""):
        return Decimal("0.00")
    return Decimal(str(value))


def _to_json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _to_json_safe(inner_value) for key, inner_value in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_json_safe(inner_value) for inner_value in value]
    return value


def _normalize_inventory_row(payload: dict[str, Any]) -> InventorySnapshotRow:
    source_id = str(payload.get("id") or payload.get("source_id") or "").strip()
    if not source_id:
        raise MigrationExecutionError("Inventory snapshot row is missing an id/source_id.")

    status = str(payload.get("status") or InventoryItem.Status.ACTIVE).lower()
    if status not in InventoryItem.Status.values:
        status = InventoryItem.Status.ACTIVE

    return InventorySnapshotRow(
        source_id=source_id,
        name=str(payload.get("name") or "").strip(),
        sku=str(payload.get("sku") or "").strip(),
        barcode=str(payload.get("barcode") or "").strip(),
        category=str(payload.get("category") or "").strip(),
        subcategory=str(payload.get("subcategory") or "").strip(),
        size=str(payload.get("size") or "").strip(),
        description=str(payload.get("description") or "").strip(),
        sell_price=_normalize_decimal(payload.get("sell_price") or payload.get("price")),
        status=status,
        tombstone=bool(payload.get("tombstone", False)),
        source_meta_json=payload.get("source_meta_json") if isinstance(payload.get("source_meta_json"), dict) else {},
    )


def _normalize_customer_row(payload: dict[str, Any]) -> CustomerSnapshotRow:
    source_id = str(payload.get("id") or payload.get("source_id") or "").strip()
    if not source_id:
        raise MigrationExecutionError("Customer snapshot row is missing an id/source_id.")

    status = str(payload.get("status") or Customer.Status.ACTIVE).lower()
    if status not in Customer.Status.values:
        status = Customer.Status.ACTIVE

    raw_phone = str(payload.get("phone") or payload.get("mobile") or "").strip()
    return CustomerSnapshotRow(
        source_id=source_id,
        name=str(payload.get("name") or "").strip(),
        phone=raw_phone or "-",
        email=str(payload.get("email") or "").strip(),
        total_spent=_normalize_decimal(payload.get("total_spent") or payload.get("totalSpent")),
        balance=_normalize_decimal(payload.get("balance") or payload.get("dueBalance")),
        notes=str(payload.get("notes") or "").strip(),
        status=status,
        tombstone=bool(payload.get("tombstone", False)),
        source_meta_json=payload.get("source_meta_json") if isinstance(payload.get("source_meta_json"), dict) else {},
    )


def _load_inventory_snapshot(job_run: MigrationJobRun) -> list[InventorySnapshotRow]:
    source_snapshot = job_run.payload_json.get("source_snapshot")
    if isinstance(source_snapshot, list):
        return [_normalize_inventory_row(row) for row in source_snapshot if isinstance(row, dict)]

    control = _get_required_control(job_run)
    shop = control.shop
    if not shop.source_id:
        raise MigrationExecutionError("Shop is missing Firebase source_id for inventory snapshot fetch.")

    app = get_firebase_app()
    if app is None:
        raise MigrationExecutionError("Firebase app is not configured for snapshot fetch.")

    db = firestore.client(app=app)
    rows = []
    inventory_docs = db.collection("shops").document(shop.source_id).collection("inventory").stream()
    for doc in inventory_docs:
        payload = doc.to_dict() or {}
        payload.setdefault("id", doc.id)
        rows.append(_normalize_inventory_row(payload))
    return rows


def _load_customer_snapshot(job_run: MigrationJobRun) -> list[CustomerSnapshotRow]:
    source_snapshot = job_run.payload_json.get("source_snapshot")
    if isinstance(source_snapshot, list):
        return [_normalize_customer_row(row) for row in source_snapshot if isinstance(row, dict)]

    control = _get_required_control(job_run)
    shop = control.shop
    if not shop.source_id:
        raise MigrationExecutionError("Shop is missing Firebase source_id for customer snapshot fetch.")

    app = get_firebase_app()
    if app is None:
        raise MigrationExecutionError("Firebase app is not configured for snapshot fetch.")

    db = firestore.client(app=app)
    rows = []
    customer_docs = db.collection("shops").document(shop.source_id).collection("customers").stream()
    for doc in customer_docs:
        payload = doc.to_dict() or {}
        payload.setdefault("id", doc.id)
        rows.append(_normalize_customer_row(payload))
    return rows


def _get_required_control(job_run: MigrationJobRun) -> MigrationDomainControl:
    if job_run.shop_id is None:
        raise MigrationExecutionError("Migration job requires a shop scope.")

    control = MigrationDomainControl.objects.filter(
        shop_id=job_run.shop_id,
        domain=job_run.domain,
        is_enabled=True,
    ).select_related("shop").first()
    if control is None:
        raise MigrationExecutionError(f"No enabled migration control found for domain {job_run.domain}.")
    return control


def _mark_job_running(job_run: MigrationJobRun) -> None:
    if not job_run.trace_id:
        job_run.trace_id = f"migration-{job_run.id}"
    job_run.status = MigrationJobStatus.RUNNING
    job_run.error_message = ""
    job_run.started_at = timezone.now()
    job_run.finished_at = None
    job_run.save(update_fields=["trace_id", "status", "error_message", "started_at", "finished_at", "updated_at"])


def _mark_job_finished(job_run: MigrationJobRun, *, status: str, error_message: str = "") -> None:
    job_run.status = status
    job_run.error_message = error_message
    job_run.finished_at = timezone.now()
    job_run.save(update_fields=["status", "error_message", "finished_at", "updated_at"])


def run_inventory_backfill(job_run: MigrationJobRun) -> MigrationJobRun:
    control = _get_required_control(job_run)
    snapshot_rows = _load_inventory_snapshot(job_run)
    _mark_job_running(job_run)
    run_started_at = timezone.now()

    rows_scanned = 0
    rows_written = 0
    rows_skipped = 0

    try:
        with transaction.atomic():
            for row in snapshot_rows:
                rows_scanned += 1
                item, created = InventoryItem.objects.get_or_create(
                    shop=control.shop,
                    source_system="firebase",
                    source_id=row.source_id,
                    defaults={
                        "name": row.name or f"Imported {row.source_id}",
                        "sku": row.sku,
                        "barcode": row.barcode,
                        "category": row.category,
                        "subcategory": row.subcategory,
                        "size": row.size,
                        "description": row.description,
                        "sell_price": row.sell_price,
                        "status": row.status,
                        "tombstone": row.tombstone,
                        "source_meta_json": row.source_meta_json,
                        "source_shop_id": control.shop.source_id,
                        "source_path": f"shops/{control.shop.source_id}/inventory/{row.source_id}",
                        "domain_epoch": control.current_epoch,
                        "migrated_at": run_started_at,
                    },
                )

                changed = created
                fields_to_update: list[str] = []
                candidate_fields = {
                    "name": row.name or item.name,
                    "sku": row.sku,
                    "barcode": row.barcode,
                    "category": row.category,
                    "subcategory": row.subcategory,
                    "size": row.size,
                    "description": row.description,
                    "sell_price": row.sell_price,
                    "status": row.status,
                    "tombstone": row.tombstone,
                    "source_meta_json": row.source_meta_json,
                    "source_shop_id": control.shop.source_id,
                    "source_path": f"shops/{control.shop.source_id}/inventory/{row.source_id}",
                    "domain_epoch": control.current_epoch,
                    "migrated_at": run_started_at,
                }

                for field, value in candidate_fields.items():
                    if getattr(item, field) != value:
                        setattr(item, field, value)
                        fields_to_update.append(field)
                        changed = True

                if changed and not created:
                    fields_to_update.append("updated_at")
                    item.save(update_fields=fields_to_update)
                    rows_written += 1
                elif created:
                    rows_written += 1
                else:
                    rows_skipped += 1

            control.last_backfill_at = timezone.now()
            control.save(update_fields=["last_backfill_at", "updated_at"])

            job_run.rows_scanned = rows_scanned
            job_run.rows_written = rows_written
            job_run.rows_skipped = rows_skipped
            job_run.mismatch_count = 0
            job_run.save(
                update_fields=[
                    "rows_scanned",
                    "rows_written",
                    "rows_skipped",
                    "mismatch_count",
                    "updated_at",
                ]
            )
    except Exception as exc:  # pragma: no cover - guarded by tests on success/failure state
        _mark_job_finished(job_run, status=MigrationJobStatus.FAILED, error_message=str(exc))
        raise

    _mark_job_finished(job_run, status=MigrationJobStatus.SUCCEEDED)
    job_run.refresh_from_db()
    return job_run


def _record_reconciliation_event(
    *,
    control: MigrationDomainControl,
    issue_code: str,
    entity_type: str,
    entity_id: str,
    note: str,
    mismatch_payload_json: dict[str, Any],
    severity: str = ReconciliationSeverity.WARNING,
    source_reference: str = "",
) -> tuple[str, str]:
    MigrationReconciliationEvent.objects.update_or_create(
        shop=control.shop,
        domain=control.domain,
        status=ReconciliationStatus.OPEN,
        issue_code=issue_code,
        entity_type=entity_type,
        entity_id=entity_id,
        defaults={
            "severity": severity,
            "source_reference": source_reference,
            "expected_master": (
                MigrationWriteMaster.POSTGRES
                if control.write_master == MigrationWriteMaster.POSTGRES
                else MigrationWriteMaster.FIREBASE
            ),
            "observed_source": "compare_snapshot",
            "occurred_at": timezone.now(),
            "mismatch_payload_json": mismatch_payload_json,
            "note": note,
            "resolution_note": "",
            "resolved_at": None,
            "resolver_user": None,
        },
    )
    return (issue_code, entity_id)


def _auto_resolve_stale_compare_events(
    *,
    control: MigrationDomainControl,
    entity_type: str,
    active_issue_keys: set[tuple[str, str]],
) -> None:
    stale_events = MigrationReconciliationEvent.objects.filter(
        shop=control.shop,
        domain=control.domain,
        observed_source="compare_snapshot",
        entity_type=entity_type,
        issue_code__in=COMPARE_MANAGED_ISSUE_CODES,
        status__in=[ReconciliationStatus.OPEN, ReconciliationStatus.ACKNOWLEDGED],
    )
    resolved_at = timezone.now()
    for event in stale_events:
        event_key = (event.issue_code, event.entity_id)
        if event_key in active_issue_keys:
            continue
        event.status = ReconciliationStatus.RESOLVED
        event.resolved_at = resolved_at
        event.resolution_note = "Auto-resolved by the latest successful shadow compare."
        event.save(update_fields=["status", "resolved_at", "resolution_note", "updated_at"])


def run_inventory_shadow_compare(job_run: MigrationJobRun) -> MigrationJobRun:
    control = _get_required_control(job_run)
    snapshot_rows = _load_inventory_snapshot(job_run)
    _mark_job_running(job_run)

    rows_scanned = 0
    mismatch_count = 0
    active_issue_keys: set[tuple[str, str]] = set()

    try:
        with transaction.atomic():
            snapshot_by_source_id = {row.source_id: row for row in snapshot_rows}
            postgres_items = {
                item.source_id: item
                for item in InventoryItem.objects.filter(
                    shop=control.shop,
                    source_system="firebase",
                )
            }

            for source_id, row in snapshot_by_source_id.items():
                rows_scanned += 1
                item = postgres_items.get(source_id)
                if item is None:
                    mismatch_count += 1
                    active_issue_keys.add(
                        _record_reconciliation_event(
                            control=control,
                            issue_code="missing_in_postgres",
                            entity_type="inventory_item",
                            entity_id=source_id,
                            note="Item exists in Firebase snapshot but not in PostgreSQL.",
                            mismatch_payload_json=_to_json_safe({"firebase": row.__dict__, "postgres": None}),
                            severity=ReconciliationSeverity.CRITICAL,
                            source_reference=f"shops/{control.shop.source_id}/inventory/{source_id}",
                        )
                    )
                    continue

                mismatches = {}
                comparisons = {
                    "name": row.name,
                    "sku": row.sku,
                    "sell_price": row.sell_price,
                    "status": row.status,
                    "tombstone": row.tombstone,
                }
                for field, firebase_value in comparisons.items():
                    postgres_value = getattr(item, field)
                    if postgres_value != firebase_value:
                        mismatches[field] = {
                            "firebase": firebase_value,
                            "postgres": postgres_value,
                        }

                if mismatches:
                    mismatch_count += 1
                    active_issue_keys.add(
                        _record_reconciliation_event(
                            control=control,
                            issue_code="field_drift",
                            entity_type="inventory_item",
                            entity_id=source_id,
                            note="Inventory item fields drifted between Firebase and PostgreSQL.",
                            mismatch_payload_json=_to_json_safe(mismatches),
                            severity=ReconciliationSeverity.WARNING,
                            source_reference=f"shops/{control.shop.source_id}/inventory/{source_id}",
                        )
                    )

            for source_id, item in postgres_items.items():
                if source_id and source_id not in snapshot_by_source_id:
                    mismatch_count += 1
                    active_issue_keys.add(
                        _record_reconciliation_event(
                            control=control,
                            issue_code="missing_in_firebase",
                            entity_type="inventory_item",
                            entity_id=source_id,
                            note="Item exists in PostgreSQL but not in Firebase snapshot.",
                            mismatch_payload_json={"postgres_id": str(item.id)},
                            severity=ReconciliationSeverity.WARNING,
                            source_reference=item.source_path,
                        )
                    )

            _auto_resolve_stale_compare_events(
                control=control,
                entity_type="inventory_item",
                active_issue_keys=active_issue_keys,
            )

            control.last_shadow_verified_at = timezone.now()
            control.save(update_fields=["last_shadow_verified_at", "updated_at"])

            job_run.rows_scanned = rows_scanned
            job_run.rows_written = 0
            job_run.rows_skipped = 0
            job_run.mismatch_count = mismatch_count
            job_run.save(
                update_fields=[
                    "rows_scanned",
                    "rows_written",
                    "rows_skipped",
                    "mismatch_count",
                    "updated_at",
                ]
            )
    except Exception as exc:  # pragma: no cover
        _mark_job_finished(job_run, status=MigrationJobStatus.FAILED, error_message=str(exc))
        raise

    _mark_job_finished(job_run, status=MigrationJobStatus.SUCCEEDED)
    job_run.refresh_from_db()
    return job_run


def run_customer_backfill(job_run: MigrationJobRun) -> MigrationJobRun:
    control = _get_required_control(job_run)
    snapshot_rows = _load_customer_snapshot(job_run)
    _mark_job_running(job_run)
    run_started_at = timezone.now()

    rows_scanned = 0
    rows_written = 0
    rows_skipped = 0

    try:
        with transaction.atomic():
            for row in snapshot_rows:
                rows_scanned += 1
                customer, created = Customer.objects.get_or_create(
                    shop=control.shop,
                    source_system="firebase",
                    source_id=row.source_id,
                    defaults={
                        "name": row.name or f"Imported {row.source_id}",
                        "phone": row.phone,
                        "email": row.email,
                        "total_spent": row.total_spent,
                        "balance": row.balance,
                        "notes": row.notes,
                        "status": row.status,
                        "tombstone": row.tombstone,
                        "source_meta_json": row.source_meta_json,
                        "source_shop_id": control.shop.source_id,
                        "source_path": f"shops/{control.shop.source_id}/customers/{row.source_id}",
                        "domain_epoch": control.current_epoch,
                        "migrated_at": run_started_at,
                    },
                )

                changed = created
                fields_to_update: list[str] = []
                candidate_fields = {
                    "name": row.name or customer.name,
                    "phone": row.phone,
                    "email": row.email,
                    "total_spent": row.total_spent,
                    "balance": row.balance,
                    "notes": row.notes,
                    "status": row.status,
                    "tombstone": row.tombstone,
                    "source_meta_json": row.source_meta_json,
                    "source_shop_id": control.shop.source_id,
                    "source_path": f"shops/{control.shop.source_id}/customers/{row.source_id}",
                    "domain_epoch": control.current_epoch,
                    "migrated_at": run_started_at,
                }

                for field, value in candidate_fields.items():
                    if getattr(customer, field) != value:
                        setattr(customer, field, value)
                        fields_to_update.append(field)
                        changed = True

                if changed and not created:
                    fields_to_update.append("updated_at")
                    customer.save(update_fields=fields_to_update)
                    rows_written += 1
                elif created:
                    rows_written += 1
                else:
                    rows_skipped += 1

            control.last_backfill_at = timezone.now()
            control.save(update_fields=["last_backfill_at", "updated_at"])

            job_run.rows_scanned = rows_scanned
            job_run.rows_written = rows_written
            job_run.rows_skipped = rows_skipped
            job_run.mismatch_count = 0
            job_run.save(
                update_fields=[
                    "rows_scanned",
                    "rows_written",
                    "rows_skipped",
                    "mismatch_count",
                    "updated_at",
                ]
            )
    except Exception as exc:  # pragma: no cover
        _mark_job_finished(job_run, status=MigrationJobStatus.FAILED, error_message=str(exc))
        raise

    _mark_job_finished(job_run, status=MigrationJobStatus.SUCCEEDED)
    job_run.refresh_from_db()
    return job_run


def run_customer_shadow_compare(job_run: MigrationJobRun) -> MigrationJobRun:
    control = _get_required_control(job_run)
    snapshot_rows = _load_customer_snapshot(job_run)
    _mark_job_running(job_run)

    rows_scanned = 0
    mismatch_count = 0
    active_issue_keys: set[tuple[str, str]] = set()

    try:
        with transaction.atomic():
            snapshot_by_source_id = {row.source_id: row for row in snapshot_rows}
            postgres_customers = {
                customer.source_id: customer
                for customer in Customer.objects.filter(
                    shop=control.shop,
                    source_system="firebase",
                )
            }

            for source_id, row in snapshot_by_source_id.items():
                rows_scanned += 1
                customer = postgres_customers.get(source_id)
                if customer is None:
                    mismatch_count += 1
                    active_issue_keys.add(
                        _record_reconciliation_event(
                            control=control,
                            issue_code="missing_in_postgres",
                            entity_type="customer",
                            entity_id=source_id,
                            note="Customer exists in Firebase snapshot but not in PostgreSQL.",
                            mismatch_payload_json=_to_json_safe({"firebase": row.__dict__, "postgres": None}),
                            severity=ReconciliationSeverity.CRITICAL,
                            source_reference=f"shops/{control.shop.source_id}/customers/{source_id}",
                        )
                    )
                    continue

                mismatches = {}
                comparisons = {
                    "name": row.name,
                    "phone": row.phone,
                    "email": row.email,
                    "total_spent": row.total_spent,
                    "balance": row.balance,
                    "status": row.status,
                    "tombstone": row.tombstone,
                }
                for field, firebase_value in comparisons.items():
                    postgres_value = getattr(customer, field)
                    if postgres_value != firebase_value:
                        mismatches[field] = {
                            "firebase": firebase_value,
                            "postgres": postgres_value,
                        }

                if mismatches:
                    mismatch_count += 1
                    active_issue_keys.add(
                        _record_reconciliation_event(
                            control=control,
                            issue_code="field_drift",
                            entity_type="customer",
                            entity_id=source_id,
                            note="Customer fields drifted between Firebase and PostgreSQL.",
                            mismatch_payload_json=_to_json_safe(mismatches),
                            severity=ReconciliationSeverity.WARNING,
                            source_reference=f"shops/{control.shop.source_id}/customers/{source_id}",
                        )
                    )

            for source_id, customer in postgres_customers.items():
                if source_id and source_id not in snapshot_by_source_id:
                    mismatch_count += 1
                    active_issue_keys.add(
                        _record_reconciliation_event(
                            control=control,
                            issue_code="missing_in_firebase",
                            entity_type="customer",
                            entity_id=source_id,
                            note="Customer exists in PostgreSQL but not in Firebase snapshot.",
                            mismatch_payload_json={"postgres_id": str(customer.id)},
                            severity=ReconciliationSeverity.WARNING,
                            source_reference=customer.source_path,
                        )
                    )

            _auto_resolve_stale_compare_events(
                control=control,
                entity_type="customer",
                active_issue_keys=active_issue_keys,
            )

            control.last_shadow_verified_at = timezone.now()
            control.save(update_fields=["last_shadow_verified_at", "updated_at"])

            job_run.rows_scanned = rows_scanned
            job_run.rows_written = 0
            job_run.rows_skipped = 0
            job_run.mismatch_count = mismatch_count
            job_run.save(
                update_fields=[
                    "rows_scanned",
                    "rows_written",
                    "rows_skipped",
                    "mismatch_count",
                    "updated_at",
                ]
            )
    except Exception as exc:  # pragma: no cover
        _mark_job_finished(job_run, status=MigrationJobStatus.FAILED, error_message=str(exc))
        raise

    _mark_job_finished(job_run, status=MigrationJobStatus.SUCCEEDED)
    job_run.refresh_from_db()
    return job_run


def run_reporting_projection_refresh(job_run: MigrationJobRun) -> MigrationJobRun:
    control = _get_required_control(job_run)
    _mark_job_running(job_run)

    try:
        snapshot = refresh_shop_dashboard_projection(control.shop)
        job_run.rows_scanned = (
            snapshot.inventory_items_count
            + snapshot.customer_count
            + snapshot.sales_count
            + snapshot.payment_count
        )
        job_run.rows_written = 1 + snapshot.low_stock_preview.count()
        job_run.rows_skipped = 0
        job_run.mismatch_count = 0
        job_run.save(
            update_fields=[
                "rows_scanned",
                "rows_written",
                "rows_skipped",
                "mismatch_count",
                "updated_at",
            ]
        )
    except Exception as exc:  # pragma: no cover
        _mark_job_finished(job_run, status=MigrationJobStatus.FAILED, error_message=str(exc))
        raise

    _mark_job_finished(job_run, status=MigrationJobStatus.SUCCEEDED)
    job_run.refresh_from_db()
    return job_run


def execute_migration_job(job_run_id: str) -> MigrationJobRun:
    job_run = MigrationJobRun.objects.select_related("shop").get(pk=job_run_id)

    if job_run.domain == MigrationDomain.INVENTORY:
        if job_run.job_type == MigrationJobType.BACKFILL:
            return run_inventory_backfill(job_run)
        if job_run.job_type == MigrationJobType.SHADOW_COMPARE:
            return run_inventory_shadow_compare(job_run)
    elif job_run.domain == MigrationDomain.CUSTOMERS:
        if job_run.job_type == MigrationJobType.BACKFILL:
            return run_customer_backfill(job_run)
        if job_run.job_type == MigrationJobType.SHADOW_COMPARE:
            return run_customer_shadow_compare(job_run)
    elif job_run.domain == MigrationDomain.REPORTING:
        if job_run.job_type == MigrationJobType.PROJECTION_REFRESH:
            return run_reporting_projection_refresh(job_run)
    else:
        raise MigrationExecutionError(f"Domain {job_run.domain} is not implemented for phase-2 execution yet.")

    raise MigrationExecutionError(f"Job type {job_run.job_type} is not implemented for phase-2 execution yet.")
