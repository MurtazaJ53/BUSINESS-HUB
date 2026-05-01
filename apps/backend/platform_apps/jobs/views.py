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
    MigrationJobStatus,
    MigrationJobType,
    MigrationWriteMaster,
)
from platform_apps.common.permissions import IsPlatformAdminUser
from platform_apps.jobs.models import (
    MigrationBridgeReceipt,
    MigrationControlEvent,
    MigrationDomainControl,
    MigrationJobRun,
)
from platform_apps.jobs.readiness import (
    PHASE3_PILOT_DOMAINS,
    build_pilot_readiness,
    build_pilot_signoff,
    build_shop_pilot_scorecards,
)
from platform_apps.jobs.serializers import (
    MigrationBridgeReceiptSerializer,
    MigrationControlEventSerializer,
    MigrationDomainControlSerializer,
    MigrationJobRunSerializer,
    MigrationPilotPreparationResultSerializer,
    MigrationPilotReadinessSerializer,
    MigrationPilotSignoffSerializer,
    MigrationPilotShopScorecardSerializer,
    MigrationPilotVerificationResultSerializer,
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
