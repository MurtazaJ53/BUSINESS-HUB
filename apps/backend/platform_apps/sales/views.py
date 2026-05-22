from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.db.models import Count, Sum
from django.db.models import Prefetch
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_apps.common.migration import MigrationDomain
from platform_apps.common.migration_guards import (
    assert_domain_epoch_current,
    assert_postgres_primary_write_enabled_multi,
)
from platform_apps.payments.models import SalePayment
from platform_apps.projections.services import refresh_shop_dashboard_projection
from platform_apps.sales.models import Sale, SaleItem
from platform_apps.sales.models import SaleCommandReceipt
from platform_apps.sales.serializers import (
    SaleCommandCreateSerializer,
    SaleSerializer,
    SaleSummarySerializer,
)
from platform_apps.shops.models import ShopMembership
from platform_apps.shops.permissions import get_membership_or_403, has_feature_enabled


class ShopScopedMixin:
    minimum_role = ShopMembership.Role.VIEWER

    def get_membership(self):
        if not hasattr(self, "_membership_cache"):
            self._membership_cache = get_membership_or_403(
                self.request.user,
                self.kwargs["shop_id"],
                self.minimum_role,
            )
        return self._membership_cache


class SaleListCreateView(ShopScopedMixin, generics.ListCreateAPIView):
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        membership = self.get_membership()
        queryset = (
            Sale.objects.filter(shop=membership.shop, tombstone=False)
            .select_related("actor_user", "customer")
            .prefetch_related(
                Prefetch("items", queryset=SaleItem.objects.select_related("inventory_item").order_by("created_at")),
                Prefetch("payments", queryset=SalePayment.objects.order_by("created_at")),
            )
        )

        query = self.request.query_params.get("q", "").strip()
        date_from = self.request.query_params.get("date_from", "").strip()
        date_to = self.request.query_params.get("date_to", "").strip()
        payment_mode = self.request.query_params.get("payment_mode", "").strip()
        status_value = self.request.query_params.get("status", "").strip()
        customer_id = self.request.query_params.get("customer_id", "").strip()

        if query:
            queryset = queryset.filter(
                Q(receipt_number__icontains=query)
                | Q(customer_name_snapshot__icontains=query)
                | Q(customer_phone_snapshot__icontains=query)
            )
        if date_from:
            queryset = queryset.filter(sale_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(sale_date__lte=date_to)
        if payment_mode:
            queryset = queryset.filter(payment_mode=payment_mode)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update(
            {
                "shop": self.get_membership().shop,
                "actor": self.request.user,
            }
        )
        return context

    def perform_create(self, serializer):
        get_membership_or_403(self.request.user, self.kwargs["shop_id"], ShopMembership.Role.STAFF)
        guarded_domains = [
            MigrationDomain.SALES,
            MigrationDomain.PAYMENTS,
            MigrationDomain.STOCK_LEDGER,
        ]
        if self.request.data.get("customer_id"):
            guarded_domains.append(MigrationDomain.CUSTOMER_LEDGER)
        assert_postgres_primary_write_enabled_multi(
            shop_id=str(self.kwargs["shop_id"]),
            domains=guarded_domains,
        )
        serializer.save()


class SaleDetailView(ShopScopedMixin, generics.RetrieveAPIView):
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = "sale_id"

    def get_queryset(self):
        membership = self.get_membership()
        return (
            Sale.objects.filter(shop=membership.shop, tombstone=False)
            .select_related("actor_user", "customer")
            .prefetch_related(
                Prefetch("items", queryset=SaleItem.objects.select_related("inventory_item").order_by("created_at")),
                Prefetch("payments", queryset=SalePayment.objects.order_by("created_at")),
            )
        )


class SaleSummaryView(ShopScopedMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, shop_id):
        membership = self.get_membership()
        queryset = Sale.objects.filter(shop=membership.shop, tombstone=False)
        aggregates = queryset.aggregate(
            total_sales=Count("id"),
            gross_revenue=Coalesce(Sum("total_amount"), Decimal("0.00")),
            outstanding_revenue=Coalesce(Sum("amount_due"), Decimal("0.00")),
        )

        total_sales = aggregates["total_sales"] or 0
        gross_revenue = aggregates["gross_revenue"] or Decimal("0.00")
        payload = {
            "total_sales": total_sales,
            "gross_revenue": gross_revenue,
            "outstanding_revenue": (
                aggregates["outstanding_revenue"] or Decimal("0.00")
                if has_feature_enabled(membership, "finance_summary")
                else None
            ),
            "average_ticket": (
                (gross_revenue / total_sales).quantize(Decimal("0.01"))
                if total_sales and has_feature_enabled(membership, "advanced_reports")
                else None
            ),
        }

        serializer = SaleSummarySerializer(payload)
        return Response(serializer.data)


def _get_sale_queryset_for_shop(*, shop_id: str):
    return (
        Sale.objects.filter(shop_id=shop_id, tombstone=False)
        .select_related("actor_user", "customer")
        .prefetch_related(
            Prefetch("items", queryset=SaleItem.objects.select_related("inventory_item").order_by("created_at")),
            Prefetch("payments", queryset=SalePayment.objects.order_by("created_at")),
        )
    )


class SaleCommandIngestionView(ShopScopedMixin, generics.GenericAPIView):
    serializer_class = SaleCommandCreateSerializer
    permission_classes = [permissions.IsAuthenticated]
    minimum_role = ShopMembership.Role.STAFF

    def post(self, request, *args, **kwargs):
        membership = self.get_membership()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raw_sale_payload = request.data.get("sale", {}) if isinstance(request.data, dict) else {}

        command_id = serializer.validated_data["command_id"]
        base_domain_epoch = serializer.validated_data["base_domain_epoch"]
        source_surface = serializer.validated_data["source_surface"] or "flutter_pos"
        sale_payload = serializer.validated_data["sale"]

        guarded_domains = [
            MigrationDomain.SALES,
            MigrationDomain.PAYMENTS,
            MigrationDomain.STOCK_LEDGER,
        ]
        if sale_payload.get("customer_id"):
            guarded_domains.append(MigrationDomain.CUSTOMER_LEDGER)

        controls = assert_postgres_primary_write_enabled_multi(
            shop_id=str(membership.shop_id),
            domains=guarded_domains,
        )
        sales_control = assert_domain_epoch_current(
            shop_id=str(membership.shop_id),
            domain=MigrationDomain.SALES,
            base_domain_epoch=base_domain_epoch,
        )

        with transaction.atomic():
            receipt, created = SaleCommandReceipt.objects.select_for_update().get_or_create(
                shop=membership.shop,
                command_id=command_id,
                defaults={
                    "actor_user": request.user,
                    "source_surface": source_surface,
                    "base_domain_epoch": base_domain_epoch,
                    "payload_json": {"sale": raw_sale_payload, "source_surface": source_surface},
                },
            )

            if not created:
                if receipt.sale_id:
                    sale = _get_sale_queryset_for_shop(shop_id=str(membership.shop_id)).get(pk=receipt.sale_id)
                    return Response(
                        {
                            "command_id": command_id,
                            "receipt_id": str(receipt.id),
                            "duplicate": True,
                            "result_status": receipt.result_status,
                            "sale": SaleSerializer(sale).data,
                        },
                        status=status.HTTP_200_OK,
                    )

                return Response(
                    {
                        "detail": "This sale command is already being processed.",
                        "command_id": command_id,
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            sale_serializer = SaleSerializer(
                data=sale_payload,
                context={
                    "shop": membership.shop,
                    "actor": request.user,
                },
            )
            sale_serializer.is_valid(raise_exception=True)

            source_meta_json = dict(sale_payload.get("source_meta_json") or {})
            source_meta_json.update(
                {
                    "command_id": command_id,
                    "source_surface": source_surface,
                }
            )

            sale = sale_serializer.save(
                source_system="postgres_command",
                source_id=command_id,
                source_shop_id=membership.shop.source_id,
                source_path=f"shops/{membership.shop.source_id or membership.shop_id}/sales/commands/{command_id}",
                domain_epoch=sales_control.current_epoch if sales_control is not None else base_domain_epoch,
                source_meta_json=source_meta_json,
            )

            receipt.actor_user = request.user
            receipt.sale = sale
            receipt.source_surface = source_surface
            receipt.base_domain_epoch = base_domain_epoch
            receipt.result_status = SaleCommandReceipt.ResultStatus.ACCEPTED
            receipt.payload_json = {
                "sale": raw_sale_payload,
                "source_surface": source_surface,
                "guarded_domains": guarded_domains,
                "resolved_epochs": {
                    domain: control.current_epoch if control is not None else None
                    for domain, control in controls.items()
                },
            }
            receipt.applied_at = timezone.now()
            receipt.save(
                update_fields=[
                    "actor_user",
                    "sale",
                    "source_surface",
                    "base_domain_epoch",
                    "result_status",
                    "payload_json",
                    "applied_at",
                    "updated_at",
                ]
            )

        refresh_shop_dashboard_projection(membership.shop)
        sale = _get_sale_queryset_for_shop(shop_id=str(membership.shop_id)).get(pk=sale.id)
        return Response(
            {
                "command_id": command_id,
                "receipt_id": str(receipt.id),
                "duplicate": False,
                "result_status": receipt.result_status,
                "sale": SaleSerializer(sale).data,
            },
            status=status.HTTP_201_CREATED,
        )
