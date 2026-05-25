from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from platform_apps.inventory.models import InventoryStockLedger
from platform_apps.payments.models import SalePayment
from platform_apps.projections.models import ShopDashboardSnapshot, ShopPulseSignal
from platform_apps.sales.models import Sale
from platform_apps.shops.models import Shop, ShopPlanRequest, WorkspaceAccessSession
from platform_apps.shops.session_trust import evaluate_workspace_session_trust


def build_shop_pulse_snapshot(
    shop: Shop,
    *,
    dashboard_snapshot: ShopDashboardSnapshot,
    now=None,
    signal_limit: int | None = 5,
) -> dict[str, object]:
    now = now or timezone.now()
    seven_days_ago = now - timedelta(days=7)
    stale_session_cutoff = now - timedelta(days=3)
    features = shop.enabled_features
    finance_enabled = features.get("finance_summary", False)
    advanced_reports_enabled = features.get("advanced_reports", False)

    session_summary = WorkspaceAccessSession.objects.filter(shop=shop).aggregate(
        active_count=Count("id", filter=Q(status=WorkspaceAccessSession.Status.ACTIVE)),
        revoked_count=Count("id", filter=Q(status=WorkspaceAccessSession.Status.REVOKED)),
        wipe_pending_count=Count(
            "id",
            filter=Q(wipe_requested_at__isnull=False, wipe_acknowledged_at__isnull=True),
        ),
        stale_active_count=Count(
            "id",
            filter=Q(
                status=WorkspaceAccessSession.Status.ACTIVE,
                last_seen_at__isnull=False,
                last_seen_at__lt=stale_session_cutoff,
            ),
        ),
    )
    session_queryset = list(
        WorkspaceAccessSession.objects.filter(
            shop=shop,
            status=WorkspaceAccessSession.Status.ACTIVE,
        )
        .select_related("user", "membership")
        .prefetch_related("user__passkeys")
    )
    session_trust = [evaluate_workspace_session_trust(session, now=now) for session in session_queryset]
    review_device_count = sum(
        1 for trust in session_trust if trust["trust_level"] == "review"
    )
    risky_device_count = sum(
        1 for trust in session_trust if trust["trust_level"] in {"risky", "blocked"}
    )
    open_plan_requests = ShopPlanRequest.objects.filter(
        shop=shop,
        status__in=[ShopPlanRequest.Status.OPEN, ShopPlanRequest.Status.IN_REVIEW],
    ).count()

    weekly_sales = Sale.objects.filter(
        shop=shop,
        tombstone=False,
        occurred_at__gte=seven_days_ago,
    )
    weekly_completed_sales = weekly_sales.filter(status=Sale.Status.COMPLETED)
    weekly_void_sales = weekly_sales.filter(status=Sale.Status.VOID)
    weekly_sale_count = weekly_sales.count()
    weekly_void_count = weekly_void_sales.count()

    discount_summary = weekly_completed_sales.aggregate(
        discounted_sales_count=Count("id", filter=Q(discount_amount__gt=0)),
        total_discount=Coalesce(Sum("discount_amount"), Decimal("0.00")),
        total_discounted_revenue=Coalesce(Sum("total_amount"), Decimal("0.00")),
    )

    shrinkage_summary = InventoryStockLedger.objects.filter(
        shop=shop,
        event_type=InventoryStockLedger.EventType.ADJUSTMENT,
        quantity_delta__lt=0,
        occurred_at__gte=seven_days_ago,
    ).aggregate(
        event_count=Count("id"),
        quantity_total=Coalesce(Sum("quantity_delta"), 0),
    )

    credit_payment_count = (
        SalePayment.objects.filter(
            shop=shop,
            payment_method=SalePayment.PaymentMethod.CREDIT,
            occurred_at__gte=seven_days_ago,
        ).count()
    )

    tasks: list[dict[str, object]] = []
    anomalies: list[dict[str, object]] = []

    wipe_pending_count = int(session_summary["wipe_pending_count"] or 0)
    stale_active_count = int(session_summary["stale_active_count"] or 0)
    revoked_count = int(session_summary["revoked_count"] or 0)
    low_stock_count = int(dashboard_snapshot.low_stock_items_count or 0)
    out_of_stock_count = int(dashboard_snapshot.out_of_stock_items_count or 0)
    active_credit_customers = int(dashboard_snapshot.active_credit_customers_count or 0)
    total_outstanding_balance = Decimal(
        dashboard_snapshot.total_outstanding_balance or Decimal("0.00")
    )
    discounted_sales_count = int(discount_summary["discounted_sales_count"] or 0)
    total_discount = Decimal(discount_summary["total_discount"] or Decimal("0.00"))
    discounted_revenue = Decimal(
        discount_summary["total_discounted_revenue"] or Decimal("0.00")
    )
    discount_ratio = (
        (total_discount / discounted_revenue)
        if discounted_revenue > 0
        else Decimal("0.00")
    )
    shrinkage_event_count = int(shrinkage_summary["event_count"] or 0)
    shrinkage_quantity = abs(int(shrinkage_summary["quantity_total"] or 0))
    void_ratio = Decimal("0.00")
    if weekly_sale_count > 0:
        void_ratio = Decimal(weekly_void_count) / Decimal(weekly_sale_count)

    def add_task(
        *,
        code: str,
        priority_rank: int,
        priority: str,
        tone: str,
        title: str,
        body: str,
        route: str,
        cta_label: str,
        count: int = 0,
        metadata=None,
    ):
        tasks.append(
            {
                "code": code,
                "priority": priority,
                "priority_rank": priority_rank,
                "tone": tone,
                "title": title,
                "body": body,
                "route": route,
                "cta_label": cta_label,
                "count": count,
                "metadata_json": metadata or {},
            }
        )

    def add_anomaly(
        *,
        code: str,
        severity_rank: int,
        severity: str,
        title: str,
        body: str,
        route: str,
        cta_label: str,
        metric_value: str,
        metadata=None,
    ):
        anomalies.append(
            {
                "code": code,
                "severity": severity,
                "severity_rank": severity_rank,
                "title": title,
                "body": body,
                "route": route,
                "cta_label": cta_label,
                "metric_value": metric_value,
                "metadata_json": metadata or {},
            }
        )

    if wipe_pending_count > 0:
        add_task(
            code="resolve_remote_wipes",
            priority_rank=400,
            priority="critical",
            tone="danger",
            title="Resolve remote wipe requests",
            body=f"{wipe_pending_count} device session{'s' if wipe_pending_count != 1 else ''} still need wipe follow-up or replacement access.",
            route="/sessions",
            cta_label="Open sessions",
            count=wipe_pending_count,
        )

    if out_of_stock_count > 0:
        add_task(
            code="restock_out_of_stock",
            priority_rank=320,
            priority="high",
            tone="warning",
            title="Refill out-of-stock products",
            body=f"{out_of_stock_count} product{'s are' if out_of_stock_count != 1 else ' is'} already at zero stock and should be reviewed before the next rush.",
            route="/inventory",
            cta_label="Open inventory",
            count=out_of_stock_count,
        )
    elif low_stock_count > 0:
        add_task(
            code="review_low_stock",
            priority_rank=280,
            priority="high",
            tone="warning",
            title="Review low-stock products",
            body=f"{low_stock_count} product{'s' if low_stock_count != 1 else ''} are running low and need a refill decision.",
            route="/inventory",
            cta_label="Open inventory",
            count=low_stock_count,
        )

    if active_credit_customers > 0 and total_outstanding_balance > Decimal("0.00"):
        dues_body = (
            f"{active_credit_customers} customer account{'s' if active_credit_customers != 1 else ''} still hold {total_outstanding_balance:.2f} in outstanding balance."
            if finance_enabled
            else f"{active_credit_customers} customer account{'s' if active_credit_customers != 1 else ''} still need collection follow-up."
        )
        add_task(
            code="collect_customer_dues",
            priority_rank=240,
            priority="medium",
            tone="info",
            title="Follow up on customer dues",
            body=dues_body,
            route="/customers",
            cta_label="Open customers",
            count=active_credit_customers,
            metadata={
                "total_outstanding_balance": f"{total_outstanding_balance:.2f}",
            },
        )

    if open_plan_requests > 0:
        add_task(
            code="review_plan_requests",
            priority_rank=180,
            priority="medium",
            tone="info",
            title="Review workspace plan requests",
            body=f"{open_plan_requests} upgrade request{'s are' if open_plan_requests != 1 else ' is'} still open for owner/admin follow-up.",
            route="/plan",
            cta_label="Open plan",
            count=open_plan_requests,
        )

    if dashboard_snapshot.last_sale_at is None or dashboard_snapshot.last_sale_at < now - timedelta(hours=24):
        add_task(
            code="verify_sales_flow",
            priority_rank=160,
            priority="medium",
            tone="info",
            title="Check receipt flow",
            body="Sales activity has been quiet for more than a day. Confirm the selling flow is healthy and the counter is recording receipts.",
            route="/sales",
            cta_label="Open sales",
        )

    if stale_active_count > 0 or revoked_count > 0:
        session_body = (
            f"{stale_active_count} active session{'s have' if stale_active_count != 1 else ' has'} gone quiet for more than 3 days."
            if stale_active_count > 0
            else f"{revoked_count} revoked session{'s still' if revoked_count != 1 else ' still'} appear in the workspace history."
        )

    if risky_device_count > 0 or review_device_count > 0:
        count = risky_device_count if risky_device_count > 0 else review_device_count
        priority = "high" if risky_device_count > 0 else "medium"
        rank = 300 if risky_device_count > 0 else 170
        tone = "warning" if risky_device_count > 0 else "info"
        add_task(
            code="review_device_trust",
            priority_rank=rank,
            priority=priority,
            tone=tone,
            title="Review device trust posture",
            body=(
                f"{risky_device_count} device session{'s look' if risky_device_count != 1 else ' looks'} risky or blocked and should be reviewed immediately."
                if risky_device_count > 0
                else f"{review_device_count} device session{'s need' if review_device_count != 1 else ' needs'} trust review before they become risky."
            ),
            route="/sessions",
            cta_label="Open sessions",
            count=count,
            metadata={
                "review_device_count": review_device_count,
                "risky_device_count": risky_device_count,
            },
        )
        add_task(
            code="review_session_hygiene",
            priority_rank=120,
            priority="low",
            tone="info",
            title="Clean up device access posture",
            body=session_body,
            route="/sessions",
            cta_label="Open sessions",
            count=max(stale_active_count, revoked_count),
        )

    if wipe_pending_count > 0:
        add_anomaly(
            code="pending_remote_wipe",
            severity_rank=400,
            severity="critical",
            title="Remote wipe still pending",
            body=f"{wipe_pending_count} device session{'s were' if wipe_pending_count != 1 else ' was'} marked for wipe but not yet acknowledged.",
            route="/sessions",
            cta_label="Review sessions",
            metric_value=str(wipe_pending_count),
        )

    if weekly_sale_count >= 3 and weekly_void_count >= 2 and void_ratio >= Decimal("0.15"):
        add_anomaly(
            code="high_void_rate",
            severity_rank=320 if void_ratio < Decimal("0.30") else 380,
            severity="warning" if void_ratio < Decimal("0.30") else "critical",
            title="Void activity is elevated",
            body=f"{weekly_void_count} of the last {weekly_sale_count} sales were voided in the past 7 days.",
            route="/sales",
            cta_label="Review sales",
            metric_value=f"{(void_ratio * Decimal('100')).quantize(Decimal('0.1'))}%",
            metadata={
                "void_sales_count": weekly_void_count,
                "weekly_sale_count": weekly_sale_count,
            },
        )

    if discounted_sales_count >= 3 and discount_ratio >= Decimal("0.12"):
        add_anomaly(
            code="discount_spike",
            severity_rank=260 if discount_ratio < Decimal("0.20") else 340,
            severity="warning" if discount_ratio < Decimal("0.20") else "critical",
            title="Discount activity is elevated",
            body=(
                f"{discounted_sales_count} discounted receipts were recorded this week. Discount value totals {total_discount:.2f}."
                if advanced_reports_enabled
                else f"{discounted_sales_count} discounted receipts were recorded this week."
            ),
            route="/sales",
            cta_label="Review discounts",
            metric_value=f"{(discount_ratio * Decimal('100')).quantize(Decimal('0.1'))}%",
            metadata={
                "discounted_sales_count": discounted_sales_count,
                "discount_total": f"{total_discount:.2f}",
            },
        )

    if shrinkage_event_count >= 2 and shrinkage_quantity >= 5:
        add_anomaly(
            code="inventory_shrinkage",
            severity_rank=250 if shrinkage_quantity < 10 else 330,
            severity="warning" if shrinkage_quantity < 10 else "critical",
            title="Inventory shrinkage is elevated",
            body=f"{shrinkage_event_count} negative stock adjustments removed {shrinkage_quantity} units in the last 7 days.",
            route="/inventory",
            cta_label="Review adjustments",
            metric_value=str(shrinkage_quantity),
            metadata={
                "adjustment_events": shrinkage_event_count,
                "shrinkage_quantity": shrinkage_quantity,
            },
        )

    if credit_payment_count >= 4 and active_credit_customers >= 3:
        add_anomaly(
            code="credit_pressure",
            severity_rank=180,
            severity="warning",
            title="Credit pressure is rising",
            body=(
                f"Credit-style collections are climbing across {active_credit_customers} active due accounts."
                if not finance_enabled
                else f"{active_credit_customers} active due accounts now hold {total_outstanding_balance:.2f} outstanding while credit collections remain busy."
            ),
            route="/customers",
            cta_label="Review customers",
            metric_value=str(active_credit_customers),
        )

    if stale_active_count > 0:
        add_anomaly(
            code="stale_active_sessions",
            severity_rank=140,
            severity="info",
            title="Stale device sessions found",
            body=f"{stale_active_count} session{'s have' if stale_active_count != 1 else ' has'} not checked in for more than 3 days.",
            route="/sessions",
            cta_label="Review sessions",
            metric_value=str(stale_active_count),
        )

    if risky_device_count > 0:
        add_anomaly(
            code="risky_device_posture",
            severity_rank=300,
            severity="warning" if risky_device_count < 2 else "critical",
            title="Device trust posture is degraded",
            body=f"{risky_device_count} active device session{'s carry' if risky_device_count != 1 else ' carries'} a risky or blocked trust posture.",
            route="/sessions",
            cta_label="Review devices",
            metric_value=str(risky_device_count),
            metadata={
                "review_device_count": review_device_count,
                "risky_device_count": risky_device_count,
            },
        )

    tasks.sort(key=lambda item: (-int(item["priority_rank"]), -int(item["count"] or 0), item["title"]))
    anomalies.sort(
        key=lambda item: (-int(item["severity_rank"]), item["title"])
    )

    task_slice = tasks if signal_limit is None else tasks[:signal_limit]
    anomaly_slice = anomalies if signal_limit is None else anomalies[:signal_limit]
    tasks = [
        {key: value for key, value in task.items() if key != "priority_rank"}
        for task in task_slice
    ]
    anomalies = [
        {key: value for key, value in anomaly.items() if key != "severity_rank"}
        for anomaly in anomaly_slice
    ]

    critical_anomalies = sum(
        1 for item in anomalies if item["severity"] == "critical"
    )
    warning_anomalies = sum(
        1 for item in anomalies if item["severity"] == "warning"
    )

    if critical_anomalies > 0:
        primary = anomalies[0]
        headline = {
            "title": primary["title"],
            "body": primary["body"],
            "route": primary["route"],
            "cta_label": primary["cta_label"],
            "tone": "critical",
        }
    elif tasks:
        primary = tasks[0]
        headline = {
            "title": primary["title"],
            "body": primary["body"],
            "route": primary["route"],
            "cta_label": primary["cta_label"],
            "tone": primary["tone"],
        }
    else:
        headline = {
            "title": "Store pulse looks healthy",
            "body": "No urgent stock, dues, session, or behavior anomalies need owner/admin follow-up right now.",
            "route": "/sales",
            "cta_label": "Review sales",
            "tone": "healthy",
        }

    return {
        "refreshed_at": dashboard_snapshot.refreshed_at or now,
        "headline": headline,
        "stats": {
            "open_task_count": len(tasks),
            "critical_anomaly_count": critical_anomalies,
            "warning_anomaly_count": warning_anomalies,
            "stale_session_count": stale_active_count,
            "wipe_pending_count": wipe_pending_count,
            "open_plan_request_count": open_plan_requests,
            "low_stock_count": low_stock_count,
        },
        "tasks": tasks,
        "anomalies": anomalies,
    }


def sync_shop_pulse_signals(
    shop: Shop,
    *,
    pulse_snapshot: dict[str, object],
    now=None,
) -> list[ShopPulseSignal]:
    now = now or timezone.now()
    active_signals: list[tuple[str, str]] = []
    persisted: list[ShopPulseSignal] = []

    for task in pulse_snapshot.get("tasks", []):
        task_data = dict(task)
        code = str(task_data.get("code", "")).strip()
        if not code:
            continue
        active_signals.append((ShopPulseSignal.SignalKind.TASK, code))
        signal, created = ShopPulseSignal.objects.get_or_create(
            shop=shop,
            signal_kind=ShopPulseSignal.SignalKind.TASK,
            code=code,
            defaults={
                "status": ShopPulseSignal.Status.OPEN,
                "signal_level": str(task_data.get("priority", "medium")),
                "signal_rank": _pulse_level_rank(str(task_data.get("priority", "medium"))),
                "tone": str(task_data.get("tone", "info")),
                "title": str(task_data.get("title", "")),
                "body": str(task_data.get("body", "")),
                "route": str(task_data.get("route", "")),
                "cta_label": str(task_data.get("cta_label", "")),
                "count": int(task_data.get("count", 0) or 0),
                "first_detected_at": now,
                "last_detected_at": now,
                "last_snapshot_refreshed_at": pulse_snapshot.get("refreshed_at", now),
                "metadata_json": task_data.get("metadata_json", {}),
            },
        )
        if not created:
            signal.signal_level = str(task_data.get("priority", signal.signal_level))
            signal.signal_rank = _pulse_level_rank(signal.signal_level)
            signal.tone = str(task_data.get("tone", signal.tone))
            signal.title = str(task_data.get("title", signal.title))
            signal.body = str(task_data.get("body", signal.body))
            signal.route = str(task_data.get("route", signal.route))
            signal.cta_label = str(task_data.get("cta_label", signal.cta_label))
            signal.count = int(task_data.get("count", signal.count) or 0)
            signal.last_detected_at = now
            signal.last_snapshot_refreshed_at = pulse_snapshot.get("refreshed_at", now)
            signal.metadata_json = task_data.get("metadata_json", {})
            if signal.status == ShopPulseSignal.Status.RESOLVED:
                signal.status = ShopPulseSignal.Status.OPEN
                signal.resolved_at = None
                signal.resolved_by_user = None
                signal.resolution_note = ""
                signal.acknowledged_at = None
                signal.acknowledged_by_user = None
            signal.save()
        persisted.append(signal)

    for anomaly in pulse_snapshot.get("anomalies", []):
        anomaly_data = dict(anomaly)
        code = str(anomaly_data.get("code", "")).strip()
        if not code:
            continue
        active_signals.append((ShopPulseSignal.SignalKind.ANOMALY, code))
        signal, created = ShopPulseSignal.objects.get_or_create(
            shop=shop,
            signal_kind=ShopPulseSignal.SignalKind.ANOMALY,
            code=code,
            defaults={
                "status": ShopPulseSignal.Status.OPEN,
                "signal_level": str(anomaly_data.get("severity", "warning")),
                "signal_rank": _pulse_level_rank(str(anomaly_data.get("severity", "warning"))),
                "tone": str(anomaly_data.get("severity", "warning")),
                "title": str(anomaly_data.get("title", "")),
                "body": str(anomaly_data.get("body", "")),
                "route": str(anomaly_data.get("route", "")),
                "cta_label": str(anomaly_data.get("cta_label", "")),
                "metric_value": str(anomaly_data.get("metric_value", "")),
                "first_detected_at": now,
                "last_detected_at": now,
                "last_snapshot_refreshed_at": pulse_snapshot.get("refreshed_at", now),
                "metadata_json": anomaly_data.get("metadata_json", {}),
            },
        )
        if not created:
            signal.signal_level = str(anomaly_data.get("severity", signal.signal_level))
            signal.signal_rank = _pulse_level_rank(signal.signal_level)
            signal.tone = str(anomaly_data.get("severity", signal.tone))
            signal.title = str(anomaly_data.get("title", signal.title))
            signal.body = str(anomaly_data.get("body", signal.body))
            signal.route = str(anomaly_data.get("route", signal.route))
            signal.cta_label = str(anomaly_data.get("cta_label", signal.cta_label))
            signal.metric_value = str(anomaly_data.get("metric_value", signal.metric_value))
            signal.last_detected_at = now
            signal.last_snapshot_refreshed_at = pulse_snapshot.get("refreshed_at", now)
            signal.metadata_json = anomaly_data.get("metadata_json", {})
            if signal.status == ShopPulseSignal.Status.RESOLVED:
                signal.status = ShopPulseSignal.Status.OPEN
                signal.resolved_at = None
                signal.resolved_by_user = None
                signal.resolution_note = ""
                signal.acknowledged_at = None
                signal.acknowledged_by_user = None
            signal.save()
        persisted.append(signal)

    active_signal_set = set(active_signals)
    stale_queryset = ShopPulseSignal.objects.filter(
        shop=shop,
        status__in=[ShopPulseSignal.Status.OPEN, ShopPulseSignal.Status.ACKNOWLEDGED],
    )
    for signal in stale_queryset:
        identity = (signal.signal_kind, signal.code)
        if identity in active_signal_set:
            continue
        signal.status = ShopPulseSignal.Status.RESOLVED
        signal.resolved_at = now
        signal.resolved_by_user = None
        signal.resolution_note = "Auto-resolved after the signal cleared from the latest pulse snapshot."
        signal.last_snapshot_refreshed_at = pulse_snapshot.get("refreshed_at", now)
        signal.save(
            update_fields=[
                "status",
                "resolved_at",
                "resolved_by_user",
                "resolution_note",
                "last_snapshot_refreshed_at",
                "updated_at",
            ]
        )

    return list(
        ShopPulseSignal.objects.filter(shop=shop)
        .select_related(
            "assigned_membership__user",
            "assigned_by_user",
            "acknowledged_by_user",
            "escalated_by_user",
            "resolved_by_user",
        )
        .order_by(
            "status",
            "-signal_rank",
            "-last_detected_at",
            "title",
        )
    )


def _pulse_level_rank(level: str) -> int:
    normalized = level.strip().lower()
    if normalized == "critical":
        return 400
    if normalized == "danger":
        return 380
    if normalized == "high":
        return 320
    if normalized == "warning":
        return 260
    if normalized == "medium":
        return 200
    if normalized == "low":
        return 120
    return 80
