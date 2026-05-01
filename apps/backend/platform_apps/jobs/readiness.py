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
    MigrationLaunchCheckpointDecision,
    ReconciliationStatus,
)
from platform_apps.jobs.models import (
    MigrationControlEvent,
    MigrationDomainControl,
    MigrationJobRun,
    MigrationLaunchCheckpointEvent,
    MigrationShopCheckpointEvent,
)


PHASE3_PILOT_DOMAINS = {
    MigrationDomain.INVENTORY,
    MigrationDomain.CUSTOMERS,
}

PHASE5_REQUIRED_DOMAINS = {
    MigrationDomain.INVENTORY,
    MigrationDomain.CUSTOMERS,
    MigrationDomain.CUSTOMER_LEDGER,
    MigrationDomain.EXPENSES,
    MigrationDomain.ATTENDANCE,
    MigrationDomain.SALES,
    MigrationDomain.PAYMENTS,
    MigrationDomain.STOCK_LEDGER,
    MigrationDomain.REPORTING,
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


def build_shop_pilot_scorecards(controls: list[MigrationDomainControl]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}

    for control in controls:
        signoff = build_pilot_signoff(control)
        shop_key = str(control.shop_id)
        bucket = grouped.setdefault(
            shop_key,
            {
                "shop": shop_key,
                "shop_name": control.shop.name,
                "shop_slug": control.shop.slug,
                "domains": [],
            },
        )
        bucket["domains"].append(signoff)

    scorecards: list[dict[str, Any]] = []
    for bucket in grouped.values():
        domains = sorted(bucket["domains"], key=lambda row: row["domain"])
        seen_domains = {row["domain"] for row in domains}
        missing_domains = sorted(PHASE3_PILOT_DOMAINS - seen_domains)
        statuses = [row["signoff_status"] for row in domains]

        if missing_domains:
            overall_status = "blocked"
            summary = (
                "This shop is missing one or more pilot domain controls, so it cannot receive a full Phase 3 signoff yet."
            )
            recommended_action = (
                "Create the missing pilot domain controls and run pilot prep before considering promotion."
            )
        elif "rollback_recommended" in statuses:
            overall_status = "rollback_recommended"
            summary = (
                "At least one pilot domain is showing rollback-level drift. The shop should not advance until that domain is stabilized."
            )
            recommended_action = (
                "Rollback the affected domain, clear reconciliation issues, and rerun verification."
            )
        elif "blocked" in statuses:
            overall_status = "blocked"
            summary = (
                "At least one pilot domain is still blocked by compare drift, open critical issues, or missing prep work."
            )
            recommended_action = (
                "Clear blockers on all pilot domains before attempting shop-level cutover progress."
            )
        elif all(status == "production_safe" for status in statuses):
            overall_status = "production_safe"
            summary = (
                "All pilot domains are PostgreSQL-primary and currently verifying cleanly. This shop has passed the Phase 3 pilot checkpoint."
            )
            recommended_action = (
                "Keep monitoring this shop and prepare the next rollout set if the posture remains stable."
            )
        elif any(status == "monitoring" for status in statuses):
            overall_status = "monitoring"
            summary = (
                "The shop has pilot domains in motion, but it still needs more verification time before a final go/no-go decision."
            )
            recommended_action = (
                "Keep verifying pilot domains, watch reconciliation, and avoid broader rollout until the monitoring posture clears."
            )
        elif any(status == "ready_for_cutover" for status in statuses):
            overall_status = "ready_for_cutover"
            summary = (
                "All required pilot domains are clean enough to proceed with the next planned PostgreSQL cutover action."
            )
            recommended_action = (
                "Execute the staged promotion plan for the remaining ready pilot domains during the pilot window."
            )
        else:
            overall_status = "blocked"
            summary = "This shop does not yet have a stable pilot posture."
            recommended_action = "Review each pilot domain and bring it back to a known-good checkpoint."

        scorecards.append(
            {
                "shop": bucket["shop"],
                "shop_name": bucket["shop_name"],
                "shop_slug": bucket["shop_slug"],
                "overall_status": overall_status,
                "recommended_action": recommended_action,
                "summary": summary,
                "missing_domains": missing_domains,
                "production_safe_domains": sum(1 for status in statuses if status == "production_safe"),
                "ready_for_cutover_domains": sum(1 for status in statuses if status == "ready_for_cutover"),
                "monitoring_domains": sum(1 for status in statuses if status == "monitoring"),
                "blocked_domains": sum(1 for status in statuses if status == "blocked"),
                "rollback_recommended_domains": sum(
                    1 for status in statuses if status == "rollback_recommended"
                ),
                "domains": domains,
            }
        )

    return sorted(scorecards, key=lambda row: row["shop_name"].lower())


def build_phase3_program_readiness(
    controls: list[MigrationDomainControl],
    checkpoint_events: list[MigrationShopCheckpointEvent],
) -> dict[str, Any]:
    scorecards = build_shop_pilot_scorecards(controls)
    latest_checkpoint_by_shop: dict[str, MigrationShopCheckpointEvent] = {}
    for event in checkpoint_events:
        latest_checkpoint_by_shop.setdefault(str(event.shop_id), event)

    shops: list[dict[str, Any]] = []
    approved_for_cutover_count = 0
    hold_for_monitoring_count = 0
    rollback_escalated_count = 0
    shops_without_checkpoint = 0

    for scorecard in scorecards:
        latest_checkpoint = latest_checkpoint_by_shop.get(scorecard["shop"])
        latest_decision = latest_checkpoint.decision if latest_checkpoint else None
        if latest_decision == "approved_for_cutover":
            approved_for_cutover_count += 1
        elif latest_decision == "hold_for_monitoring":
            hold_for_monitoring_count += 1
        elif latest_decision == "rollback_escalated":
            rollback_escalated_count += 1
        else:
            shops_without_checkpoint += 1

        shops.append(
            {
                "shop": scorecard["shop"],
                "shop_name": scorecard["shop_name"],
                "shop_slug": scorecard["shop_slug"],
                "overall_status": scorecard["overall_status"],
                "recommended_action": scorecard["recommended_action"],
                "summary": scorecard["summary"],
                "latest_checkpoint_decision": latest_decision,
                "latest_checkpoint_overall_status": (
                    latest_checkpoint.overall_status_snapshot if latest_checkpoint else None
                ),
                "latest_checkpoint_at": latest_checkpoint.occurred_at if latest_checkpoint else None,
            }
        )

    pilot_shop_count = len(scorecards)
    production_safe_shop_count = sum(1 for row in scorecards if row["overall_status"] == "production_safe")
    ready_for_cutover_shop_count = sum(1 for row in scorecards if row["overall_status"] == "ready_for_cutover")
    monitoring_shop_count = sum(1 for row in scorecards if row["overall_status"] == "monitoring")
    blocked_shop_count = sum(1 for row in scorecards if row["overall_status"] == "blocked")
    rollback_recommended_shop_count = sum(
        1 for row in scorecards if row["overall_status"] == "rollback_recommended"
    )

    if pilot_shop_count == 0:
        overall_status = "blocked"
        recommended_action = (
            "No pilot shops are registered yet. Create inventory and customer pilot controls before Phase 3 exit review."
        )
        summary = "Phase 3 cannot exit because no pilot shops are registered."
    elif rollback_recommended_shop_count > 0 or rollback_escalated_count > 0:
        overall_status = "rollback_recommended"
        recommended_action = (
            "Do not exit Phase 3. Roll back or stabilize the affected pilot shops before considering broader rollout."
        )
        summary = (
            f"{rollback_recommended_shop_count} shop scorecards and {rollback_escalated_count} checkpoint decisions are signaling rollback pressure."
        )
    elif blocked_shop_count > 0:
        overall_status = "blocked"
        recommended_action = (
            "Clear blocked pilot domains, rerun prep and compare, and avoid phase exit until every pilot shop reaches a stable checkpoint."
        )
        summary = (
            f"{blocked_shop_count} of {pilot_shop_count} pilot shops are still blocked by missing prep work, drift, or unresolved checkpoint gaps."
        )
    elif monitoring_shop_count > 0 or hold_for_monitoring_count > 0 or shops_without_checkpoint > 0:
        overall_status = "monitoring"
        recommended_action = (
            "Keep Phase 3 in monitoring. Continue verification and record explicit shop checkpoint decisions before signing off the phase."
        )
        summary = (
            f"{monitoring_shop_count} pilot shops are still in monitoring, {hold_for_monitoring_count} are on explicit hold, and {shops_without_checkpoint} are missing a checkpoint decision."
        )
    elif (
        pilot_shop_count > 0
        and approved_for_cutover_count == pilot_shop_count
        and ready_for_cutover_shop_count + production_safe_shop_count == pilot_shop_count
    ):
        overall_status = "ready_for_phase_exit"
        recommended_action = (
            "Phase 3 exit gate is clean. Record the final pilot signoff and prepare the next phase rollout plan."
        )
        summary = (
            f"All {pilot_shop_count} pilot shops have approved checkpoints and are currently classified as ready_for_cutover or production_safe."
        )
    else:
        overall_status = "monitoring"
        recommended_action = (
            "Keep observing pilot shops until their scorecards and checkpoint decisions converge on an unambiguous phase-exit posture."
        )
        summary = (
            f"Pilot shops are active, but the checkpoint posture is not yet strong enough to declare a Phase 3 exit."
        )

    return {
        "phase": "phase_3",
        "overall_status": overall_status,
        "pilot_shop_count": pilot_shop_count,
        "approved_for_cutover_count": approved_for_cutover_count,
        "hold_for_monitoring_count": hold_for_monitoring_count,
        "rollback_escalated_count": rollback_escalated_count,
        "shops_without_checkpoint": shops_without_checkpoint,
        "production_safe_shop_count": production_safe_shop_count,
        "ready_for_cutover_shop_count": ready_for_cutover_shop_count,
        "monitoring_shop_count": monitoring_shop_count,
        "blocked_shop_count": blocked_shop_count,
        "rollback_recommended_shop_count": rollback_recommended_shop_count,
        "recommended_action": recommended_action,
        "summary": summary,
        "shops": sorted(shops, key=lambda row: row["shop_name"].lower()),
    }


def build_phase5_shop_retirement_scorecards(
    controls: list[MigrationDomainControl],
) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}

    for control in controls:
        if control.domain not in PHASE5_REQUIRED_DOMAINS:
            continue
        shop_key = str(control.shop_id)
        bucket = grouped.setdefault(
            shop_key,
            {
                "shop": shop_key,
                "shop_name": control.shop.name,
                "shop_slug": control.shop.slug,
                "controls": [],
            },
        )
        bucket["controls"].append(control)

    scorecards: list[dict[str, Any]] = []
    for bucket in grouped.values():
        controls_for_shop = sorted(bucket["controls"], key=lambda item: item.domain)
        by_domain = {control.domain: control for control in controls_for_shop}
        missing_domains = sorted(PHASE5_REQUIRED_DOMAINS - set(by_domain))
        open_events = MigrationReconciliationEvent.objects.filter(
            shop_id=bucket["shop"],
            domain__in=tuple(PHASE5_REQUIRED_DOMAINS),
            status__in=[ReconciliationStatus.OPEN, ReconciliationStatus.ACKNOWLEDGED],
        )
        open_critical_events = open_events.filter(severity="critical").count()
        open_total_events = open_events.count()

        postgres_primary_domains = 0
        firebase_primary_domains = 0
        active_bridge_domains = 0
        compare_only_domains = 0
        blocked_domains = 0
        domain_snapshots: list[dict[str, Any]] = []

        for domain in sorted(PHASE5_REQUIRED_DOMAINS):
            control = by_domain.get(domain)
            if control is None:
                blocked_domains += 1
                domain_snapshots.append(
                    {
                        "domain": domain,
                        "present": False,
                        "write_master": None,
                        "bridge_mode": None,
                        "cutover_status": None,
                    }
                )
                continue

            if (
                control.write_master == "postgres"
                and control.cutover_status == MigrationCutoverStatus.POSTGRES_PRIMARY
            ):
                postgres_primary_domains += 1
            else:
                blocked_domains += 1

            if control.write_master == "firebase":
                firebase_primary_domains += 1
            if control.bridge_mode in {
                MigrationBridgeMode.FIREBASE_TO_POSTGRES,
                MigrationBridgeMode.POSTGRES_TO_FIREBASE,
            }:
                active_bridge_domains += 1
            elif control.bridge_mode == MigrationBridgeMode.COMPARE_ONLY:
                compare_only_domains += 1

            domain_snapshots.append(
                {
                    "domain": domain,
                    "present": True,
                    "write_master": control.write_master,
                    "bridge_mode": control.bridge_mode,
                    "cutover_status": control.cutover_status,
                }
            )

        if open_critical_events > 0:
            overall_status = "rollback_recommended"
            summary = (
                "Critical reconciliation pressure still exists on required Phase 5 domains."
            )
            recommended_action = (
                "Do not retire legacy paths. Resolve critical reconciliation issues or fall back to the Phase 4 cutover posture."
            )
        elif missing_domains or firebase_primary_domains > 0 or blocked_domains > 0:
            overall_status = "blocked"
            summary = (
                "One or more required domains are missing controls or have not fully reached PostgreSQL-primary ownership yet."
            )
            recommended_action = (
                "Finish cutover for all required domains before considering Firebase retirement."
            )
        elif active_bridge_domains > 0 or compare_only_domains > 0 or open_total_events > 0:
            overall_status = "monitoring"
            summary = (
                "Core domains are on PostgreSQL, but bridge traffic or reconciliation pressure still means retirement should stay under hardening watch."
            )
            recommended_action = (
                "Keep bridge/watch posture active, clear open issues, and only approve launch once the legacy dependency surface is quiet."
            )
        else:
            overall_status = "ready_for_launch"
            summary = (
                "All required domains are PostgreSQL-primary with no open reconciliation pressure or active bridge dependency."
            )
            recommended_action = (
                "This shop is clean enough for final launch signoff and legacy retirement review."
            )

        scorecards.append(
            {
                "shop": bucket["shop"],
                "shop_name": bucket["shop_name"],
                "shop_slug": bucket["shop_slug"],
                "overall_status": overall_status,
                "recommended_action": recommended_action,
                "summary": summary,
                "missing_domains": missing_domains,
                "postgres_primary_domains": postgres_primary_domains,
                "firebase_primary_domains": firebase_primary_domains,
                "active_bridge_domains": active_bridge_domains,
                "compare_only_domains": compare_only_domains,
                "blocked_domains": blocked_domains,
                "open_events": open_total_events,
                "open_critical_events": open_critical_events,
                "domains": domain_snapshots,
            }
        )

    return sorted(scorecards, key=lambda row: row["shop_name"].lower())


def build_phase5_retirement_readiness(
    controls: list[MigrationDomainControl],
    launch_events: list[MigrationLaunchCheckpointEvent],
) -> dict[str, Any]:
    scorecards = build_phase5_shop_retirement_scorecards(controls)
    latest_launch_event = launch_events[0] if launch_events else None

    shop_count = len(scorecards)
    ready_for_launch_shop_count = sum(
        1 for row in scorecards if row["overall_status"] == "ready_for_launch"
    )
    monitoring_shop_count = sum(
        1 for row in scorecards if row["overall_status"] == "monitoring"
    )
    blocked_shop_count = sum(1 for row in scorecards if row["overall_status"] == "blocked")
    rollback_recommended_shop_count = sum(
        1 for row in scorecards if row["overall_status"] == "rollback_recommended"
    )

    if shop_count == 0:
        overall_status = "blocked"
        recommended_action = (
            "No Phase 5 retirement scorecards exist yet. Promote the required domains before evaluating launch readiness."
        )
        summary = "Phase 5 cannot start because no required-domain scorecards exist."
    elif rollback_recommended_shop_count > 0:
        overall_status = "rollback_recommended"
        recommended_action = (
            "Keep the platform in Phase 4 posture and resolve rollback-level drift before any retirement signoff."
        )
        summary = (
            f"{rollback_recommended_shop_count} shops are signaling rollback-level reconciliation pressure."
        )
    elif blocked_shop_count > 0:
        overall_status = "blocked"
        recommended_action = (
            "Finish cutover on all required domains and remove Firebase-primary ownership before launch signoff."
        )
        summary = (
            f"{blocked_shop_count} of {shop_count} shops still have blocked retirement scorecards."
        )
    elif monitoring_shop_count > 0:
        overall_status = "monitoring"
        recommended_action = (
            "Keep Phase 5 in hardening. Clear remaining bridge/watch pressure and reconcile open issues before launch approval."
        )
        summary = (
            f"{monitoring_shop_count} of {shop_count} shops are still under retirement monitoring."
        )
    elif (
        latest_launch_event
        and latest_launch_event.decision == MigrationLaunchCheckpointDecision.APPROVED_FOR_LAUNCH
        and ready_for_launch_shop_count == shop_count
    ):
        overall_status = "retirement_complete"
        recommended_action = (
            "Legacy retirement has been signed off. Keep archive/quarantine policy in place and operate on the new platform as steady state."
        )
        summary = (
            "All required shops are launch-ready and the latest launch checkpoint approved the platform for steady-state operation."
        )
    else:
        overall_status = "ready_for_launch"
        recommended_action = (
            "Record the final launch checkpoint, quarantine remaining legacy dependencies, and move the platform into steady-state operations."
        )
        summary = (
            f"All {shop_count} shops are ready for launch from a code/config posture. Final business signoff is the last gate."
        )

    return {
        "phase": "phase_5",
        "overall_status": overall_status,
        "shop_count": shop_count,
        "ready_for_launch_shop_count": ready_for_launch_shop_count,
        "monitoring_shop_count": monitoring_shop_count,
        "blocked_shop_count": blocked_shop_count,
        "rollback_recommended_shop_count": rollback_recommended_shop_count,
        "latest_launch_decision": latest_launch_event.decision if latest_launch_event else None,
        "latest_launch_status_snapshot": (
            latest_launch_event.overall_status_snapshot if latest_launch_event else None
        ),
        "latest_launch_at": latest_launch_event.occurred_at if latest_launch_event else None,
        "recommended_action": recommended_action,
        "summary": summary,
        "shops": scorecards,
    }
