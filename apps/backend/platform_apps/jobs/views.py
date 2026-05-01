from __future__ import annotations

from django.utils import timezone
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_apps.audit.models import MigrationReconciliationEvent
from platform_apps.common.migration import (
    MigrationBridgeMode,
    MigrationControlEventType,
    MigrationCutoverStatus,
    MigrationLaunchCheckpointDecision,
    MigrationPhaseCheckpointDecision,
    MigrationJobStatus,
    MigrationJobType,
    MigrationShopCheckpointDecision,
    MigrationWriteMaster,
)
from platform_apps.common.permissions import IsPlatformAdminUser
from platform_apps.jobs.models import (
    MigrationBridgeReceipt,
    MigrationControlEvent,
    MigrationDomainControl,
    MigrationLaunchCheckpointEvent,
    MigrationPhaseCheckpointEvent,
    MigrationJobRun,
    MigrationShopCheckpointEvent,
)
from platform_apps.jobs.readiness import (
    PHASE3_PILOT_DOMAINS,
    PHASE5_REQUIRED_DOMAINS,
    build_phase5_retirement_readiness,
    build_phase3_program_readiness,
    build_pilot_readiness,
    build_pilot_signoff,
    build_shop_pilot_scorecards,
)
from platform_apps.jobs.serializers import (
    MigrationBridgeReceiptSerializer,
    MigrationControlEventSerializer,
    MigrationDomainControlSerializer,
    MigrationJobRunSerializer,
    MigrationLaunchCheckpointEventSerializer,
    MigrationPhaseCheckpointEventSerializer,
    MigrationPhaseReadinessSerializer,
    MigrationPilotPreparationResultSerializer,
    MigrationPilotReadinessSerializer,
    MigrationPilotSignoffSerializer,
    MigrationPilotShopScorecardSerializer,
    MigrationPilotVerificationResultSerializer,
    MigrationRetirementReadinessSerializer,
    MigrationShopCheckpointEventSerializer,
    MigrationShadowSummarySerializer,
)
from platform_apps.jobs.services import execute_migration_job


def record_control_event(
    *,
    control: MigrationDomainControl,
    event_type: str,
    actor_user,
    result: str,
    summary: str,
    from_cutover_status: str = "",
    to_cutover_status: str = "",
    from_write_master: str = "",
    to_write_master: str = "",
    metadata_json: dict | None = None,
) -> MigrationControlEvent:
    return MigrationControlEvent.objects.create(
        control=control,
        shop=control.shop,
        domain=control.domain,
        event_type=event_type,
        actor_user=actor_user,
        result=result,
        from_cutover_status=from_cutover_status,
        to_cutover_status=to_cutover_status,
        from_write_master=from_write_master,
        to_write_master=to_write_master,
        summary=summary,
        metadata_json=metadata_json or {},
        occurred_at=timezone.now(),
    )


class MigrationDomainControlListCreateView(generics.ListCreateAPIView):
    serializer_class = MigrationDomainControlSerializer
    permission_classes = [IsPlatformAdminUser]
    pagination_class = None

    def get_queryset(self):
        queryset = MigrationDomainControl.objects.select_related("shop").order_by("shop__name", "domain")
        domain = self.request.query_params.get("domain", "").strip()
        shop_id = self.request.query_params.get("shop_id", "").strip()
        write_master = self.request.query_params.get("write_master", "").strip()
        bridge_mode = self.request.query_params.get("bridge_mode", "").strip()

        if domain:
            queryset = queryset.filter(domain=domain)
        if shop_id:
            queryset = queryset.filter(shop_id=shop_id)
        if write_master:
            queryset = queryset.filter(write_master=write_master)
        if bridge_mode:
            queryset = queryset.filter(bridge_mode=bridge_mode)
        return queryset


class MigrationDomainControlDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = MigrationDomainControlSerializer
    permission_classes = [IsPlatformAdminUser]
    lookup_url_kwarg = "control_id"

    def get_queryset(self):
        return MigrationDomainControl.objects.select_related("shop")


class MigrationJobRunListCreateView(generics.ListCreateAPIView):
    serializer_class = MigrationJobRunSerializer
    permission_classes = [IsPlatformAdminUser]
    pagination_class = None

    def get_queryset(self):
        queryset = MigrationJobRun.objects.select_related("shop", "actor_user")
        domain = self.request.query_params.get("domain", "").strip()
        shop_id = self.request.query_params.get("shop_id", "").strip()
        job_type = self.request.query_params.get("job_type", "").strip()
        status = self.request.query_params.get("status", "").strip()

        if domain:
            queryset = queryset.filter(domain=domain)
        if shop_id:
            queryset = queryset.filter(shop_id=shop_id)
        if job_type:
            queryset = queryset.filter(job_type=job_type)
        if status:
            queryset = queryset.filter(status=status)
        return queryset

    def perform_create(self, serializer):
        job_run = serializer.save(actor_user=self.request.user, status=MigrationJobStatus.QUEUED)
        if self.request.query_params.get("run_inline", "").strip().lower() in {"1", "true", "yes"}:
            serializer.instance = execute_migration_job(str(job_run.id))


class MigrationJobRunDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = MigrationJobRunSerializer
    permission_classes = [IsPlatformAdminUser]
    lookup_url_kwarg = "job_id"

    def get_queryset(self):
        return MigrationJobRun.objects.select_related("shop", "actor_user")


class MigrationBridgeReceiptListView(generics.ListAPIView):
    serializer_class = MigrationBridgeReceiptSerializer
    permission_classes = [IsPlatformAdminUser]
    pagination_class = None

    def get_queryset(self):
        queryset = MigrationBridgeReceipt.objects.select_related("shop")
        domain = self.request.query_params.get("domain", "").strip()
        shop_id = self.request.query_params.get("shop_id", "").strip()
        origin_system = self.request.query_params.get("origin_system", "").strip()
        entity_type = self.request.query_params.get("entity_type", "").strip()

        if domain:
            queryset = queryset.filter(domain=domain)
        if shop_id:
            queryset = queryset.filter(shop_id=shop_id)
        if origin_system:
            queryset = queryset.filter(origin_system=origin_system)
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        return queryset


class MigrationControlEventListView(generics.ListAPIView):
    serializer_class = MigrationControlEventSerializer
    permission_classes = [IsPlatformAdminUser]
    pagination_class = None

    def get_queryset(self):
        queryset = MigrationControlEvent.objects.select_related(
            "shop", "control", "actor_user"
        )
        domain = self.request.query_params.get("domain", "").strip()
        shop_id = self.request.query_params.get("shop_id", "").strip()
        event_type = self.request.query_params.get("event_type", "").strip()
        result = self.request.query_params.get("result", "").strip()

        if domain:
            queryset = queryset.filter(domain=domain)
        if shop_id:
            queryset = queryset.filter(shop_id=shop_id)
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        if result:
            queryset = queryset.filter(result=result)
        return queryset


class MigrationShopCheckpointEventListCreateView(generics.ListCreateAPIView):
    serializer_class = MigrationShopCheckpointEventSerializer
    permission_classes = [IsPlatformAdminUser]
    pagination_class = None

    def get_queryset(self):
        queryset = MigrationShopCheckpointEvent.objects.select_related("shop", "actor_user")
        shop_id = self.request.query_params.get("shop_id", "").strip()
        decision = self.request.query_params.get("decision", "").strip()

        if shop_id:
            queryset = queryset.filter(shop_id=shop_id)
        if decision:
            queryset = queryset.filter(decision=decision)
        return queryset

    def create(self, request, *args, **kwargs):
        shop_id = str(request.data.get("shop") or "").strip()
        decision = str(request.data.get("decision") or "").strip()
        note = str(request.data.get("note") or "").strip()

        if not shop_id or not decision:
            return Response({"detail": "shop and decision are required."}, status=400)

        if decision not in MigrationShopCheckpointDecision.values:
            return Response({"detail": "Unknown checkpoint decision."}, status=400)

        controls = list(
            MigrationDomainControl.objects.select_related("shop")
            .filter(shop_id=shop_id, domain__in=tuple(PHASE3_PILOT_DOMAINS))
            .order_by("shop__name", "domain")
        )
        if not controls:
            return Response({"detail": "No pilot domain controls exist for this shop."}, status=409)

        scorecards = build_shop_pilot_scorecards(controls)
        if not scorecards:
            return Response({"detail": "Unable to build a pilot scorecard for this shop."}, status=409)

        scorecard = scorecards[0]
        event = MigrationShopCheckpointEvent.objects.create(
            shop=controls[0].shop,
            actor_user=request.user,
            decision=decision,
            overall_status_snapshot=scorecard["overall_status"],
            summary=scorecard["summary"],
            recommended_action_snapshot=scorecard["recommended_action"],
            metadata_json={
                "note": note,
                "missing_domains": scorecard["missing_domains"],
                "production_safe_domains": scorecard["production_safe_domains"],
                "ready_for_cutover_domains": scorecard["ready_for_cutover_domains"],
                "monitoring_domains": scorecard["monitoring_domains"],
                "blocked_domains": scorecard["blocked_domains"],
                "rollback_recommended_domains": scorecard["rollback_recommended_domains"],
                "domains": [
                    {
                        "domain": row["domain"],
                        "signoff_status": row["signoff_status"],
                        "cutover_status": row["cutover_status"],
                        "write_master": row["write_master"],
                    }
                    for row in scorecard["domains"]
                ],
            },
            occurred_at=timezone.now(),
        )
        serializer = self.get_serializer(event)
        return Response(serializer.data, status=201)


class MigrationPhaseCheckpointEventListCreateView(generics.ListCreateAPIView):
    serializer_class = MigrationPhaseCheckpointEventSerializer
    permission_classes = [IsPlatformAdminUser]
    pagination_class = None

    def get_queryset(self):
        queryset = MigrationPhaseCheckpointEvent.objects.select_related("actor_user")
        phase = self.request.query_params.get("phase", "").strip()
        decision = self.request.query_params.get("decision", "").strip()

        if phase:
            queryset = queryset.filter(phase=phase)
        if decision:
            queryset = queryset.filter(decision=decision)
        return queryset

    def create(self, request, *args, **kwargs):
        phase = str(request.data.get("phase") or "phase_3").strip() or "phase_3"
        decision = str(request.data.get("decision") or "").strip()
        note = str(request.data.get("note") or "").strip()

        if not decision:
            return Response({"detail": "decision is required."}, status=400)

        if decision not in MigrationPhaseCheckpointDecision.values:
            return Response({"detail": "Unknown phase checkpoint decision."}, status=400)

        controls = list(
            MigrationDomainControl.objects.select_related("shop")
            .filter(domain__in=tuple(PHASE3_PILOT_DOMAINS))
            .order_by("shop__name", "domain")
        )
        checkpoint_events = list(
            MigrationShopCheckpointEvent.objects.select_related("shop", "actor_user").order_by(
                "shop_id", "-occurred_at", "-created_at"
            )
        )
        phase_readiness = build_phase3_program_readiness(controls, checkpoint_events)
        if phase_readiness["pilot_shop_count"] == 0:
            return Response(
                {"detail": "No pilot shops exist for this phase yet."},
                status=409,
            )
        if (
            decision == MigrationPhaseCheckpointDecision.APPROVED_FOR_NEXT_PHASE
            and phase_readiness["overall_status"] != "ready_for_phase_exit"
        ):
            return Response(
                {
                    "detail": "Phase 3 is not yet ready for next-phase approval.",
                    "overall_status": phase_readiness["overall_status"],
                    "recommended_action": phase_readiness["recommended_action"],
                },
                status=409,
            )

        event = MigrationPhaseCheckpointEvent.objects.create(
            phase=phase,
            actor_user=request.user,
            decision=decision,
            overall_status_snapshot=phase_readiness["overall_status"],
            summary=phase_readiness["summary"],
            recommended_action_snapshot=phase_readiness["recommended_action"],
            metadata_json={
                "note": note,
                "pilot_shop_count": phase_readiness["pilot_shop_count"],
                "approved_for_cutover_count": phase_readiness["approved_for_cutover_count"],
                "hold_for_monitoring_count": phase_readiness["hold_for_monitoring_count"],
                "rollback_escalated_count": phase_readiness["rollback_escalated_count"],
                "shops_without_checkpoint": phase_readiness["shops_without_checkpoint"],
                "production_safe_shop_count": phase_readiness["production_safe_shop_count"],
                "ready_for_cutover_shop_count": phase_readiness["ready_for_cutover_shop_count"],
                "monitoring_shop_count": phase_readiness["monitoring_shop_count"],
                "blocked_shop_count": phase_readiness["blocked_shop_count"],
                "rollback_recommended_shop_count": phase_readiness["rollback_recommended_shop_count"],
                "shops": [
                    {
                        **shop_snapshot,
                        "latest_checkpoint_at": (
                            shop_snapshot["latest_checkpoint_at"].isoformat()
                            if shop_snapshot.get("latest_checkpoint_at")
                            else None
                        ),
                    }
                    for shop_snapshot in phase_readiness["shops"]
                ],
            },
            occurred_at=timezone.now(),
        )
        serializer = self.get_serializer(event)
        return Response(serializer.data, status=201)


class MigrationLaunchCheckpointEventListCreateView(generics.ListCreateAPIView):
    serializer_class = MigrationLaunchCheckpointEventSerializer
    permission_classes = [IsPlatformAdminUser]
    pagination_class = None

    def get_queryset(self):
        queryset = MigrationLaunchCheckpointEvent.objects.select_related("actor_user")
        phase = self.request.query_params.get("phase", "").strip()
        decision = self.request.query_params.get("decision", "").strip()

        if phase:
            queryset = queryset.filter(phase=phase)
        if decision:
            queryset = queryset.filter(decision=decision)
        return queryset

    def create(self, request, *args, **kwargs):
        phase = str(request.data.get("phase") or "phase_5").strip() or "phase_5"
        decision = str(request.data.get("decision") or "").strip()
        note = str(request.data.get("note") or "").strip()

        if not decision:
            return Response({"detail": "decision is required."}, status=400)

        if decision not in MigrationLaunchCheckpointDecision.values:
            return Response({"detail": "Unknown launch checkpoint decision."}, status=400)

        controls = list(
            MigrationDomainControl.objects.select_related("shop")
            .filter(domain__in=tuple(PHASE5_REQUIRED_DOMAINS))
            .order_by("shop__name", "domain")
        )
        launch_events = list(
            MigrationLaunchCheckpointEvent.objects.select_related("actor_user").order_by(
                "-occurred_at", "-created_at"
            )
        )
        retirement_readiness = build_phase5_retirement_readiness(controls, launch_events)

        if (
            decision == MigrationLaunchCheckpointDecision.APPROVED_FOR_LAUNCH
            and retirement_readiness["overall_status"] != "ready_for_launch"
        ):
            return Response(
                {
                    "detail": "Phase 5 is not yet ready for final launch approval.",
                    "overall_status": retirement_readiness["overall_status"],
                    "recommended_action": retirement_readiness["recommended_action"],
                },
                status=409,
            )

        event = MigrationLaunchCheckpointEvent.objects.create(
            phase=phase,
            actor_user=request.user,
            decision=decision,
            overall_status_snapshot=retirement_readiness["overall_status"],
            summary=retirement_readiness["summary"],
            recommended_action_snapshot=retirement_readiness["recommended_action"],
            metadata_json={
                "note": note,
                "shop_count": retirement_readiness["shop_count"],
                "ready_for_launch_shop_count": retirement_readiness["ready_for_launch_shop_count"],
                "monitoring_shop_count": retirement_readiness["monitoring_shop_count"],
                "blocked_shop_count": retirement_readiness["blocked_shop_count"],
                "rollback_recommended_shop_count": retirement_readiness["rollback_recommended_shop_count"],
                "shops": [
                    {
                        "shop": shop_snapshot["shop"],
                        "shop_name": shop_snapshot["shop_name"],
                        "overall_status": shop_snapshot["overall_status"],
                        "missing_domains": shop_snapshot["missing_domains"],
                        "firebase_primary_domains": shop_snapshot["firebase_primary_domains"],
                        "active_bridge_domains": shop_snapshot["active_bridge_domains"],
                        "open_critical_events": shop_snapshot["open_critical_events"],
                    }
                    for shop_snapshot in retirement_readiness["shops"]
                ],
            },
            occurred_at=timezone.now(),
        )
        serializer = self.get_serializer(event)
        return Response(serializer.data, status=201)


class MigrationShadowSummaryListView(APIView):
    permission_classes = [IsPlatformAdminUser]

    def get(self, request):
        controls = MigrationDomainControl.objects.select_related("shop").order_by("shop__name", "domain")
        domain = request.query_params.get("domain", "").strip()
        shop_id = request.query_params.get("shop_id", "").strip()

        if domain:
            controls = controls.filter(domain=domain)
        if shop_id:
            controls = controls.filter(shop_id=shop_id)

        summaries = []
        for control in controls:
            latest_compare = (
                MigrationJobRun.objects.filter(
                    shop=control.shop,
                    domain=control.domain,
                    job_type="shadow_compare",
                )
                .order_by("-created_at")
                .first()
            )
            open_events = MigrationReconciliationEvent.objects.filter(
                shop=control.shop,
                domain=control.domain,
                status__in=["open", "acknowledged"],
            )
            summaries.append(
                {
                    "shop": control.shop_id,
                    "shop_name": control.shop.name,
                    "shop_slug": control.shop.slug,
                    "domain": control.domain,
                    "write_master": control.write_master,
                    "bridge_mode": control.bridge_mode,
                    "current_epoch": control.current_epoch,
                    "last_shadow_verified_at": control.last_shadow_verified_at,
                    "latest_compare_status": latest_compare.status if latest_compare else None,
                    "latest_compare_at": latest_compare.finished_at if latest_compare else None,
                    "latest_compare_mismatches": latest_compare.mismatch_count if latest_compare else 0,
                    "latest_compare_trace_id": latest_compare.trace_id if latest_compare else "",
                    "open_events": open_events.count(),
                    "open_critical_events": open_events.filter(severity="critical").count(),
                    "open_stale_epoch_events": open_events.filter(issue_code="stale_bridge_epoch").count(),
                }
            )

        serializer = MigrationShadowSummarySerializer(summaries, many=True)
        return Response(serializer.data)


class MigrationPilotReadinessListView(APIView):
    permission_classes = [IsPlatformAdminUser]

    def get(self, request):
        controls = MigrationDomainControl.objects.select_related("shop").order_by("shop__name", "domain")
        domain = request.query_params.get("domain", "").strip()
        shop_id = request.query_params.get("shop_id", "").strip()

        if domain:
            controls = controls.filter(domain=domain)
        if shop_id:
            controls = controls.filter(shop_id=shop_id)

        payload = [build_pilot_readiness(control) for control in controls]
        serializer = MigrationPilotReadinessSerializer(payload, many=True)
        return Response(serializer.data)


class MigrationPilotSignoffListView(APIView):
    permission_classes = [IsPlatformAdminUser]

    def get(self, request):
        controls = (
            MigrationDomainControl.objects.select_related("shop")
            .filter(domain__in=tuple(PHASE3_PILOT_DOMAINS))
            .order_by("shop__name", "domain")
        )
        domain = request.query_params.get("domain", "").strip()
        shop_id = request.query_params.get("shop_id", "").strip()

        if domain:
            controls = controls.filter(domain=domain)
        if shop_id:
            controls = controls.filter(shop_id=shop_id)

        payload = [build_pilot_signoff(control) for control in controls]
        serializer = MigrationPilotSignoffSerializer(payload, many=True)
        return Response(serializer.data)


class MigrationPilotShopScorecardListView(APIView):
    permission_classes = [IsPlatformAdminUser]

    def get(self, request):
        controls = (
            MigrationDomainControl.objects.select_related("shop")
            .filter(domain__in=tuple(PHASE3_PILOT_DOMAINS))
            .order_by("shop__name", "domain")
        )
        shop_id = request.query_params.get("shop_id", "").strip()

        if shop_id:
            controls = controls.filter(shop_id=shop_id)

        payload = build_shop_pilot_scorecards(list(controls))
        serializer = MigrationPilotShopScorecardSerializer(payload, many=True)
        return Response(serializer.data)


class MigrationPhaseReadinessView(APIView):
    permission_classes = [IsPlatformAdminUser]

    def get(self, request):
        controls = list(
            MigrationDomainControl.objects.select_related("shop")
            .filter(domain__in=tuple(PHASE3_PILOT_DOMAINS))
            .order_by("shop__name", "domain")
        )
        shop_id = request.query_params.get("shop_id", "").strip()
        if shop_id:
            controls = [control for control in controls if str(control.shop_id) == shop_id]

        checkpoint_events_queryset = MigrationShopCheckpointEvent.objects.select_related(
            "shop", "actor_user"
        ).order_by("shop_id", "-occurred_at", "-created_at")
        if shop_id:
            checkpoint_events_queryset = checkpoint_events_queryset.filter(shop_id=shop_id)
        checkpoint_events = list(checkpoint_events_queryset)

        payload = build_phase3_program_readiness(controls, checkpoint_events)
        serializer = MigrationPhaseReadinessSerializer(payload)
        return Response(serializer.data)


class MigrationRetirementReadinessView(APIView):
    permission_classes = [IsPlatformAdminUser]

    def get(self, request):
        controls = list(
            MigrationDomainControl.objects.select_related("shop")
            .filter(domain__in=tuple(PHASE5_REQUIRED_DOMAINS))
            .order_by("shop__name", "domain")
        )
        shop_id = request.query_params.get("shop_id", "").strip()
        if shop_id:
            controls = [control for control in controls if str(control.shop_id) == shop_id]

        launch_events_queryset = MigrationLaunchCheckpointEvent.objects.select_related(
            "actor_user"
        ).order_by("-occurred_at", "-created_at")
        launch_events = list(launch_events_queryset)

        payload = build_phase5_retirement_readiness(controls, launch_events)
        serializer = MigrationRetirementReadinessSerializer(payload)
        return Response(serializer.data)


class MigrationPilotPromoteReadyView(APIView):
    permission_classes = [IsPlatformAdminUser]

    def post(self, request, control_id):
        control = MigrationDomainControl.objects.select_related("shop").filter(pk=control_id).first()
        if control is None:
            return Response({"detail": "Migration control not found."}, status=404)

        readiness = build_pilot_readiness(control)
        if not readiness["ready_for_pilot"]:
            record_control_event(
                control=control,
                event_type=MigrationControlEventType.PROMOTE_READY,
                actor_user=request.user,
                result="blocked",
                summary="Promote-ready attempt was blocked because the domain did not clear the pilot gate.",
                from_cutover_status=control.cutover_status,
                to_cutover_status=control.cutover_status,
                from_write_master=control.write_master,
                to_write_master=control.write_master,
                metadata_json={"blocking_reasons": readiness["blocking_reasons"]},
            )
            serializer = MigrationPilotReadinessSerializer(readiness)
            return Response(serializer.data, status=409)

        from_cutover_status = control.cutover_status
        control.cutover_status = MigrationCutoverStatus.READY
        control.save(update_fields=["cutover_status", "updated_at"])
        record_control_event(
            control=control,
            event_type=MigrationControlEventType.PROMOTE_READY,
            actor_user=request.user,
            result="succeeded",
            summary="Domain was promoted to ready after clearing the pilot gate.",
            from_cutover_status=from_cutover_status,
            to_cutover_status=control.cutover_status,
            from_write_master=control.write_master,
            to_write_master=control.write_master,
        )

        payload = build_pilot_readiness(control)
        serializer = MigrationPilotReadinessSerializer(payload)
        return Response(serializer.data, status=200)


class MigrationPilotPrepareView(APIView):
    permission_classes = [IsPlatformAdminUser]

    def post(self, request, control_id):
        control = MigrationDomainControl.objects.select_related("shop").filter(pk=control_id).first()
        if control is None:
            return Response({"detail": "Migration control not found."}, status=404)

        if control.domain not in {"inventory", "customers"}:
            return Response(
                {"detail": "Pilot preparation is only implemented for inventory and customers right now."},
                status=409,
            )

        payloads = request.data.get("payloads") if isinstance(request.data, dict) else None
        if not isinstance(payloads, dict):
            payloads = {}

        run_inline = request.query_params.get("run_inline", "").strip().lower() in {"1", "true", "yes"}
        created_jobs: list[MigrationJobRun] = []

        for job_type in (MigrationJobType.BACKFILL, MigrationJobType.SHADOW_COMPARE):
            job_run = MigrationJobRun.objects.create(
                shop=control.shop,
                domain=control.domain,
                job_type=job_type,
                actor_user=request.user,
                status=MigrationJobStatus.QUEUED,
                payload_json=payloads.get(job_type, {}) if isinstance(payloads.get(job_type), dict) else {},
            )
            if run_inline:
                job_run = execute_migration_job(str(job_run.id))
            created_jobs.append(job_run)

        control.refresh_from_db()
        readiness = build_pilot_readiness(control)
        record_control_event(
            control=control,
            event_type=MigrationControlEventType.PREPARE_PILOT,
            actor_user=request.user,
            result="succeeded" if readiness["ready_for_pilot"] else "monitoring",
            summary="Pilot preparation ran backfill and compare jobs for the selected domain.",
            from_cutover_status=control.cutover_status,
            to_cutover_status=control.cutover_status,
            from_write_master=control.write_master,
            to_write_master=control.write_master,
            metadata_json={
                "jobs_created": len(created_jobs),
                "ready_for_pilot": readiness["ready_for_pilot"],
                "blocking_reasons": readiness["blocking_reasons"],
            },
        )
        payload = {
            "control_id": str(control.id),
            "shop": str(control.shop_id),
            "shop_name": control.shop.name,
            "domain": control.domain,
            "jobs": created_jobs,
            "readiness": readiness,
        }
        serializer = MigrationPilotPreparationResultSerializer(payload)
        return Response(serializer.data, status=200)


class MigrationPilotPromotePrimaryView(APIView):
    permission_classes = [IsPlatformAdminUser]

    def post(self, request, control_id):
        control = MigrationDomainControl.objects.select_related("shop").filter(pk=control_id).first()
        if control is None:
            return Response({"detail": "Migration control not found."}, status=404)

        readiness = build_pilot_readiness(control)
        if not readiness["ready_for_pilot"]:
            record_control_event(
                control=control,
                event_type=MigrationControlEventType.PROMOTE_PRIMARY,
                actor_user=request.user,
                result="blocked",
                summary="Promote-primary attempt was blocked because the domain did not clear the pilot gate.",
                from_cutover_status=control.cutover_status,
                to_cutover_status=control.cutover_status,
                from_write_master=control.write_master,
                to_write_master=control.write_master,
                metadata_json={"blocking_reasons": readiness["blocking_reasons"]},
            )
            serializer = MigrationPilotReadinessSerializer(readiness)
            return Response(serializer.data, status=409)

        from_cutover_status = control.cutover_status
        from_write_master = control.write_master
        control.write_master = MigrationWriteMaster.POSTGRES
        control.cutover_status = MigrationCutoverStatus.POSTGRES_PRIMARY
        control.current_epoch += 1
        control.shadow_reads_enabled = True
        control.save(
            update_fields=[
                "write_master",
                "cutover_status",
                "current_epoch",
                "shadow_reads_enabled",
                "updated_at",
            ]
        )
        record_control_event(
            control=control,
            event_type=MigrationControlEventType.PROMOTE_PRIMARY,
            actor_user=request.user,
            result="succeeded",
            summary="Domain was promoted to PostgreSQL primary write ownership.",
            from_cutover_status=from_cutover_status,
            to_cutover_status=control.cutover_status,
            from_write_master=from_write_master,
            to_write_master=control.write_master,
            metadata_json={"new_epoch": control.current_epoch},
        )

        payload = build_pilot_readiness(control)
        serializer = MigrationPilotReadinessSerializer(payload)
        return Response(serializer.data, status=200)


class MigrationPilotVerifyView(APIView):
    permission_classes = [IsPlatformAdminUser]

    def post(self, request, control_id):
        control = MigrationDomainControl.objects.select_related("shop").filter(pk=control_id).first()
        if control is None:
            return Response({"detail": "Migration control not found."}, status=404)

        if control.domain not in {"inventory", "customers"}:
            return Response(
                {"detail": "Pilot verification is only implemented for inventory and customers right now."},
                status=409,
            )

        payloads = request.data.get("payloads") if isinstance(request.data, dict) else None
        if not isinstance(payloads, dict):
            payloads = {}

        run_inline = request.query_params.get("run_inline", "").strip().lower() in {"1", "true", "yes"}
        job_run = MigrationJobRun.objects.create(
            shop=control.shop,
            domain=control.domain,
            job_type=MigrationJobType.SHADOW_COMPARE,
            actor_user=request.user,
            status=MigrationJobStatus.QUEUED,
            payload_json=payloads.get(MigrationJobType.SHADOW_COMPARE, {})
            if isinstance(payloads.get(MigrationJobType.SHADOW_COMPARE), dict)
            else {},
        )
        if run_inline:
            job_run = execute_migration_job(str(job_run.id))

        control.refresh_from_db()
        readiness = build_pilot_readiness(control)
        latest_compare_status = job_run.status
        latest_compare_mismatches = job_run.mismatch_count
        open_critical_events = readiness["open_critical_events"]
        open_stale_epoch_events = readiness["open_stale_epoch_events"]
        healthy = (
            latest_compare_status == MigrationJobStatus.SUCCEEDED
            and latest_compare_mismatches == 0
            and open_critical_events == 0
            and open_stale_epoch_events == 0
        )
        requires_rollback = (
            control.cutover_status == MigrationCutoverStatus.POSTGRES_PRIMARY
            and not healthy
        )

        if healthy:
            summary = "Latest pilot verification is clean. No mismatches or critical drift detected."
        elif requires_rollback:
            summary = "Pilot verification found drift after PostgreSQL promotion. Rollback should be considered immediately."
        else:
            summary = "Pilot verification still shows blockers. Keep the domain in pilot posture until compare health is clean."

        if requires_rollback:
            operational_verdict = "rollback_recommended"
        elif control.cutover_status == MigrationCutoverStatus.POSTGRES_PRIMARY and healthy:
            operational_verdict = "production_safe"
        else:
            operational_verdict = "monitoring"

        record_control_event(
            control=control,
            event_type=MigrationControlEventType.VERIFY_PILOT,
            actor_user=request.user,
            result=operational_verdict,
            summary=summary,
            from_cutover_status=control.cutover_status,
            to_cutover_status=control.cutover_status,
            from_write_master=control.write_master,
            to_write_master=control.write_master,
            metadata_json={
                "healthy": healthy,
                "requires_rollback": requires_rollback,
                "mismatch_count": latest_compare_mismatches,
                "critical_events": open_critical_events,
                "stale_epoch_events": open_stale_epoch_events,
            },
        )

        payload = {
            "control_id": str(control.id),
            "shop": str(control.shop_id),
            "shop_name": control.shop.name,
            "domain": control.domain,
            "verification_job": job_run,
            "cutover_status": control.cutover_status,
            "write_master": control.write_master,
            "latest_compare_status": latest_compare_status,
            "latest_compare_mismatches": latest_compare_mismatches,
            "open_critical_events": open_critical_events,
            "open_stale_epoch_events": open_stale_epoch_events,
            "healthy": healthy,
            "requires_rollback": requires_rollback,
            "operational_verdict": operational_verdict,
            "summary": summary,
        }
        serializer = MigrationPilotVerificationResultSerializer(payload)
        return Response(serializer.data, status=200)


class MigrationPilotRollbackView(APIView):
    permission_classes = [IsPlatformAdminUser]

    def post(self, request, control_id):
        control = MigrationDomainControl.objects.select_related("shop").filter(pk=control_id).first()
        if control is None:
            return Response({"detail": "Migration control not found."}, status=404)

        from_cutover_status = control.cutover_status
        from_write_master = control.write_master
        control.write_master = MigrationWriteMaster.FIREBASE
        control.cutover_status = MigrationCutoverStatus.PILOT
        control.bridge_mode = MigrationBridgeMode.COMPARE_ONLY
        control.shadow_reads_enabled = True
        control.current_epoch += 1
        control.save(
            update_fields=[
                "write_master",
                "cutover_status",
                "bridge_mode",
                "shadow_reads_enabled",
                "current_epoch",
                "updated_at",
            ]
        )
        record_control_event(
            control=control,
            event_type=MigrationControlEventType.ROLLBACK,
            actor_user=request.user,
            result="succeeded",
            summary="Domain was rolled back to Firebase ownership and compare-only bridge mode.",
            from_cutover_status=from_cutover_status,
            to_cutover_status=control.cutover_status,
            from_write_master=from_write_master,
            to_write_master=control.write_master,
            metadata_json={"new_epoch": control.current_epoch},
        )

        payload = build_pilot_readiness(control)
        serializer = MigrationPilotReadinessSerializer(payload)
        return Response(serializer.data, status=200)
