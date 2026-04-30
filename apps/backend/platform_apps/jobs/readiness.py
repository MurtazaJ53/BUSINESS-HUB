from __future__ import annotations

from typing import Any

from platform_apps.audit.models import MigrationReconciliationEvent
from platform_apps.common.migration import (
    MigrationBridgeMode,
    MigrationCutoverStatus,
    MigrationDomain,
    MigrationJobStatus,
    MigrationJobType,
    ReconciliationStatus,
)
from platform_apps.jobs.models import MigrationDomainControl, MigrationJobRun


PHASE3_PILOT_DOMAINS = {
    MigrationDomain.INVENTORY,
    MigrationDomain.CUSTOMERS,
}


def build_pilot_readiness(control: MigrationDomainControl) -> dict[str, Any]:
    latest_compare = (
        MigrationJobRun.objects.filter(
            shop=control.shop,
            domain=control.domain,
            job_type=MigrationJobType.SHADOW_COMPARE,
        )
        .order_by("-created_at")
        .first()
    )
    open_events = MigrationReconciliationEvent.objects.filter(
        shop=control.shop,
        domain=control.domain,
        status__in=[ReconciliationStatus.OPEN, ReconciliationStatus.ACKNOWLEDGED],
    )

    blocking_reasons: list[str] = []
    warnings: list[str] = []

    if control.domain not in PHASE3_PILOT_DOMAINS:
        blocking_reasons.append("Phase 3 pilot automation is only implemented for inventory and customers right now.")
    if not control.is_enabled:
        blocking_reasons.append("Domain control is disabled.")
    if not control.shadow_reads_enabled:
        blocking_reasons.append("Shadow reads are not enabled for this domain.")
    if control.bridge_mode == MigrationBridgeMode.DISABLED:
        blocking_reasons.append("Bridge mode is disabled, so pilot replay safety is not active.")
    if control.last_backfill_at is None:
        blocking_reasons.append("No successful backfill has been recorded yet.")
    if latest_compare is None:
        blocking_reasons.append("No shadow compare has been run yet.")
    elif latest_compare.status != MigrationJobStatus.SUCCEEDED:
        blocking_reasons.append("The latest shadow compare did not succeed.")
    elif latest_compare.mismatch_count > 0:
        blocking_reasons.append("The latest shadow compare still reports mismatches.")

    open_critical_events = open_events.filter(severity="critical").count()
    if open_critical_events:
        blocking_reasons.append("Critical reconciliation events are still open.")

    open_stale_epoch_events = open_events.filter(issue_code="stale_bridge_epoch").count()
    if open_stale_epoch_events:
        blocking_reasons.append("Stale bridge epoch events are still open.")

    if control.cutover_status == MigrationCutoverStatus.POSTGRES_PRIMARY:
        warnings.append("Domain is already marked as PostgreSQL primary.")

    ready_for_pilot = not blocking_reasons
    recommended_next_status = (
        MigrationCutoverStatus.READY
        if ready_for_pilot and control.cutover_status in {MigrationCutoverStatus.LEGACY, MigrationCutoverStatus.PILOT}
        else control.cutover_status
    )

    return {
        "control_id": str(control.id),
        "shop": str(control.shop_id),
        "shop_name": control.shop.name,
        "shop_slug": control.shop.slug,
        "domain": control.domain,
        "cutover_status": control.cutover_status,
        "write_master": control.write_master,
        "bridge_mode": control.bridge_mode,
        "current_epoch": control.current_epoch,
        "shadow_reads_enabled": control.shadow_reads_enabled,
        "last_backfill_at": control.last_backfill_at,
        "last_shadow_verified_at": control.last_shadow_verified_at,
        "latest_compare_status": latest_compare.status if latest_compare else None,
        "latest_compare_at": latest_compare.finished_at if latest_compare else None,
        "latest_compare_mismatches": latest_compare.mismatch_count if latest_compare else 0,
        "latest_compare_trace_id": latest_compare.trace_id if latest_compare else "",
        "open_events": open_events.count(),
        "open_critical_events": open_critical_events,
        "open_stale_epoch_events": open_stale_epoch_events,
        "ready_for_pilot": ready_for_pilot,
        "recommended_next_status": recommended_next_status,
        "blocking_reasons": blocking_reasons,
        "warnings": warnings,
    }
