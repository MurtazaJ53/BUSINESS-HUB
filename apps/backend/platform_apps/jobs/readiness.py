from __future__ import annotations

from typing import Any

from platform_apps.audit.models import MigrationReconciliationEvent
from platform_apps.common.migration import (
    MigrationBridgeMode,
    MigrationControlEventType,
    MigrationCutoverStatus,
    MigrationDomain,
    MigrationJobStatus,
    MigrationJobType,
    ReconciliationStatus,
)
from platform_apps.jobs.models import (
    MigrationControlEvent,
    MigrationDomainControl,
    MigrationJobRun,
)


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
    if ready_for_pilot and control.cutover_status in {MigrationCutoverStatus.LEGACY, MigrationCutoverStatus.PILOT}:
        recommended_next_status = MigrationCutoverStatus.READY
    elif ready_for_pilot and control.cutover_status == MigrationCutoverStatus.READY:
        recommended_next_status = MigrationCutoverStatus.POSTGRES_PRIMARY
    else:
        recommended_next_status = control.cutover_status

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


def build_pilot_signoff(control: MigrationDomainControl) -> dict[str, Any]:
    readiness = build_pilot_readiness(control)
    latest_verify = (
        MigrationControlEvent.objects.filter(
            control=control,
            event_type=MigrationControlEventType.VERIFY_PILOT,
        )
        .order_by("-occurred_at", "-created_at")
        .first()
    )

    latest_verify_result = latest_verify.result if latest_verify else ""
    latest_verify_summary = latest_verify.summary if latest_verify else ""
    latest_verify_metadata = latest_verify.metadata_json if latest_verify else {}
    latest_verify_healthy = bool(latest_verify_metadata.get("healthy")) if latest_verify else False
    latest_verify_requires_rollback = bool(latest_verify_metadata.get("requires_rollback")) if latest_verify else False

    if control.domain not in PHASE3_PILOT_DOMAINS:
        signoff_status = "blocked"
        summary = "This domain is outside the automated Phase 3 pilot set."
        recommended_action = "Keep this domain on the manual cutover path for now."
    elif control.cutover_status == MigrationCutoverStatus.POSTGRES_PRIMARY:
        if latest_verify_requires_rollback or latest_verify_result == "rollback_recommended":
            signoff_status = "rollback_recommended"
            summary = latest_verify_summary or (
                "PostgreSQL is primary, but the latest pilot verification found drift that should trigger rollback review."
            )
            recommended_action = "Rollback the pilot and triage reconciliation before retrying."
        elif latest_verify_result == "production_safe" and latest_verify_healthy:
            signoff_status = "production_safe"
            summary = latest_verify_summary or (
                "Latest pilot verification is clean. This domain can stay on PostgreSQL while operators continue monitoring."
            )
            recommended_action = "Keep monitoring drift, bridge receipts, and operator activity."
        else:
            signoff_status = "monitoring"
            summary = latest_verify_summary or (
                "PostgreSQL is already primary, but this domain still needs an unambiguous clean verification verdict."
            )
            recommended_action = "Run verify-pilot again and keep the domain under close observation."
    elif control.cutover_status == MigrationCutoverStatus.READY:
        if readiness["ready_for_pilot"] and latest_verify_result == "monitoring" and latest_verify_healthy:
            signoff_status = "ready_for_cutover"
            summary = latest_verify_summary or (
                "Ready-stage verification is clean and the domain is cleared for PostgreSQL primary promotion."
            )
            recommended_action = "Promote PostgreSQL primary during the planned pilot window."
        elif readiness["ready_for_pilot"]:
            signoff_status = "monitoring"
            summary = latest_verify_summary or (
                "This domain is ready-stage clean, but it still needs a fresh verification pass before final promotion."
            )
            recommended_action = "Run verify-pilot and confirm a clean monitoring result."
        else:
            signoff_status = "blocked"
            summary = "The domain is in the ready stage, but active blockers still prevent a safe cutover."
            recommended_action = "Clear readiness blockers and rerun the compare flow."
    elif control.cutover_status == MigrationCutoverStatus.PILOT:
        if readiness["ready_for_pilot"]:
            signoff_status = "monitoring"
            summary = "Pilot preparation is clean. The domain can move to ready once operators confirm the checkpoint board."
            recommended_action = "Promote ready, then verify the domain before primary promotion."
        else:
            signoff_status = "blocked"
            summary = "Pilot preparation is still blocked by compare drift or open reconciliation pressure."
            recommended_action = "Run pilot prep again and resolve blockers before promotion."
    else:
        signoff_status = "blocked"
        summary = "This domain is still in legacy posture and has not entered the pilot cutover sequence."
        recommended_action = "Start with pilot prep before attempting any promotion."

    return {
        "control_id": str(control.id),
        "shop": str(control.shop_id),
        "shop_name": control.shop.name,
        "shop_slug": control.shop.slug,
        "domain": control.domain,
        "cutover_status": control.cutover_status,
        "write_master": control.write_master,
        "current_epoch": control.current_epoch,
        "signoff_status": signoff_status,
        "latest_verify_result": latest_verify_result or None,
        "latest_verified_at": latest_verify.occurred_at if latest_verify else None,
        "latest_compare_status": readiness["latest_compare_status"],
        "latest_compare_mismatches": readiness["latest_compare_mismatches"],
        "open_critical_events": readiness["open_critical_events"],
        "open_stale_epoch_events": readiness["open_stale_epoch_events"],
        "ready_for_pilot": readiness["ready_for_pilot"],
        "summary": summary,
        "recommended_action": recommended_action,
        "blocking_reasons": readiness["blocking_reasons"],
        "warnings": readiness["warnings"],
    }
