from __future__ import annotations

from decimal import Decimal
import csv
from django.http import HttpResponse

from django.db import transaction
from django.db.models import Q
from django.db.models import Count, Sum
from django.db.models import Prefetch
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .tasks import process_sale_command_task

from platform_apps.audit.services import create_workspace_audit_event, snapshot_sale
from platform_apps.common.migration import MigrationDomain
from platform_apps.common.migration_guards import (
    assert_domain_epoch_current,
    assert_postgres_primary_write_enabled_multi,
)
from platform_apps.payments.models import SalePayment
from platform_apps.projections.services import refresh_shop_dashboard_projection
from platform_apps.sales.models import Sale, SaleItem
from platform_apps.sales.models import SaleCommandReceipt
from platform_apps.inventory.models import InventoryStockLedger
from platform_apps.customers.models import CustomerLedgerEntry
from platform_apps.sales.serializers import (
    SaleCommandCreateSerializer,
    SaleSerializer,
    SaleSummarySerializer,
    SaleGstSummarySerializer,
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
        membership = get_membership_or_403(self.request.user, self.kwargs["shop_id"], ShopMembership.Role.STAFF)
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
        sale = serializer.instance
        create_workspace_audit_event(
            shop=membership.shop,
            actor_user=self.request.user,
            actor_role=membership.role,
            category="sale",
            event_type="sale.record.created",
            entity_type="sale",
            entity_id=sale.id,
            entity_label=sale.receipt_number,
            summary=f"Created sale {sale.receipt_number}.",
            source_surface="backend_api",
            after=snapshot_sale(sale),
        )


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


class SaleVoidView(ShopScopedMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]
    minimum_role = ShopMembership.Role.STAFF

    def patch(self, request, shop_id, sale_id):
        membership = self.get_membership()
        
        guarded_domains = [MigrationDomain.SALES, MigrationDomain.STOCK_LEDGER, MigrationDomain.CUSTOMER_LEDGER]
        assert_postgres_primary_write_enabled_multi(shop_id=str(shop_id), domains=guarded_domains)

        sale = generics.get_object_or_404(
            Sale.objects.filter(shop=membership.shop, tombstone=False),
            id=sale_id,
        )

        if sale.status == Sale.Status.VOID:
            return Response({"detail": "Sale is already void."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            sale = Sale.objects.select_for_update().get(pk=sale.id)
            if sale.status == Sale.Status.VOID:
                return Response({"detail": "Sale is already void."}, status=status.HTTP_400_BAD_REQUEST)
                
            sale.status = Sale.Status.VOID
            sale.save(update_fields=["status", "updated_at"])

            occurred_at = timezone.now()

            # Reverse inventory stock ledger
            for item in sale.items.all():
                if item.inventory_item_id:
                    InventoryStockLedger.objects.create(
                        shop=membership.shop,
                        item_id=item.inventory_item_id,
                        actor_user=request.user,
                        event_type=InventoryStockLedger.EventType.RETURN,
                        quantity_delta=item.quantity if not item.is_return else -item.quantity,
                        unit_cost=item.unit_cost,
                        unit_price=item.unit_price,
                        note=f"Void Sale {sale.receipt_number}",
                        occurred_at=occurred_at,
                        source_system=sale.source_system,
                        source_id=str(sale.id),
                        source_shop_id=sale.source_shop_id,
                        source_path=f"sales/{sale.id}/void",
                        domain_epoch=sale.domain_epoch,
                    )

            # Reverse customer ledger
            if sale.customer_id:
                customer = sale.customer
                computed_due = sale.amount_due
                computed_total = sale.total_amount
                
                CustomerLedgerEntry.objects.create(
                    shop=membership.shop,
                    customer=customer,
                    actor_user=request.user,
                    event_type=CustomerLedgerEntry.EventType.PAYMENT, # Reverse sale with a payment equivalent
                    amount_delta=-computed_due,
                    total_spent_delta=-computed_total,
                    note=f"Void Sale {sale.receipt_number}",
                    occurred_at=occurred_at,
                    source_system=sale.source_system,
                    source_id=str(sale.id),
                    source_shop_id=sale.source_shop_id,
                    source_path=f"sales/{sale.id}/void",
                    domain_epoch=sale.domain_epoch,
                )
                customer.balance -= computed_due
                customer.total_spent -= computed_total
                customer.save(update_fields=["balance", "total_spent", "updated_at"])

        create_workspace_audit_event(
            shop=membership.shop,
            actor_user=request.user,
            actor_role=membership.role,
            category="sale",
            event_type="sale.voided",
            entity_type="sale",
            entity_id=sale.id,
            entity_label=sale.receipt_number,
            summary=f"Voided sale {sale.receipt_number}.",
            source_surface="backend_api",
            after=snapshot_sale(sale),
        )

        return Response(SaleSerializer(sale).data)


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


class SaleGstSummaryView(ShopScopedMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, shop_id):
        membership = self.get_membership()
        queryset = Sale.objects.filter(shop=membership.shop, tombstone=False)
        
        date_from = request.query_params.get("date_from", "").strip()
        date_to = request.query_params.get("date_to", "").strip()
        
        if date_from:
            queryset = queryset.filter(sale_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(sale_date__lte=date_to)

        aggregates = queryset.aggregate(
            total_taxable=Coalesce(Sum("taxable_amount"), Decimal("0.00")),
            total_tax=Coalesce(Sum("tax_amount"), Decimal("0.00")),
            total_cgst=Coalesce(Sum("cgst_amount"), Decimal("0.00")),
            total_sgst=Coalesce(Sum("sgst_amount"), Decimal("0.00")),
            total_igst=Coalesce(Sum("igst_amount"), Decimal("0.00")),
            total_gross=Coalesce(Sum("total_amount"), Decimal("0.00")),
        )

        # B2C small aggregation: by gst_rate
        b2c_rates = queryset.values("items__gst_rate").annotate(
            taxable_amount=Coalesce(Sum("items__taxable_amount"), Decimal("0.00")),
            tax_amount=Coalesce(Sum("items__tax_amount"), Decimal("0.00")),
            cgst_amount=Coalesce(Sum("items__cgst_amount"), Decimal("0.00")),
            sgst_amount=Coalesce(Sum("items__sgst_amount"), Decimal("0.00")),
            igst_amount=Coalesce(Sum("items__igst_amount"), Decimal("0.00")),
        ).order_by("items__gst_rate")
        
        # HSN summary: by hsn_snapshot
        hsn_summary = queryset.exclude(items__hsn_snapshot="").values("items__hsn_snapshot").annotate(
            taxable_amount=Coalesce(Sum("items__taxable_amount"), Decimal("0.00")),
            tax_amount=Coalesce(Sum("items__tax_amount"), Decimal("0.00")),
            cgst_amount=Coalesce(Sum("items__cgst_amount"), Decimal("0.00")),
            sgst_amount=Coalesce(Sum("items__sgst_amount"), Decimal("0.00")),
            igst_amount=Coalesce(Sum("items__igst_amount"), Decimal("0.00")),
        ).order_by("items__hsn_snapshot")

        payload = {
            "taxable_amount": aggregates["total_taxable"],
            "tax_amount": aggregates["total_tax"],
            "cgst_amount": aggregates["total_cgst"],
            "sgst_amount": aggregates["total_sgst"],
            "igst_amount": aggregates["total_igst"],
            "gross_amount": aggregates["total_gross"],
            "b2c_small": list(b2c_rates),
            "hsn_summary": list(hsn_summary),
        }

        serializer = SaleGstSummarySerializer(payload)
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
        assert_domain_epoch_current(
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

            # Store resolved epochs for the background task
            receipt.payload_json["resolved_epochs"] = {
                domain: control.current_epoch if control is not None else None
                for domain, control in controls.items()
            }
            receipt.save(update_fields=["payload_json"])

        # Enqueue the background task
        process_sale_command_task.delay(str(receipt.id))

        return Response(
            {
                "command_id": command_id,
                "receipt_id": str(receipt.id),
                "duplicate": False,
                "result_status": receipt.result_status,
                "message": "Sale command accepted and is processing in the background.",
            },
            status=status.HTTP_202_ACCEPTED,
        )


class GSTR1ExportView(ShopScopedMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]
    minimum_role = ShopMembership.Role.STAFF

    def get(self, request, shop_id):
        membership = self.get_membership()
        shop = membership.shop
        
        month = request.query_params.get('month')
        year = request.query_params.get('year')
        
        if not month or not year:
            return Response({"error": "month and year are required parameters"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            month = int(month)
            year = int(year)
        except ValueError:
            return Response({"error": "month and year must be integers"}, status=status.HTTP_400_BAD_REQUEST)

        sales = Sale.objects.filter(
            shop=shop, 
            tombstone=False,
            status=Sale.Status.COMPLETED,
            sale_date__year=year,
            sale_date__month=month
        ).prefetch_related("items")

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="GSTR1_{shop.name}_{year}_{month}.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'GSTIN/UIN of Recipient', 
            'Receiver Name', 
            'Invoice Number', 
            'Invoice Date', 
            'Invoice Value', 
            'Place Of Supply', 
            'Reverse Charge', 
            'Applicable % of Tax Rate', 
            'Invoice Type', 
            'E-Commerce GSTIN', 
            'Rate', 
            'Taxable Value',
            'Cess Amount'
        ])

        for sale in sales:
            # Group items by GST rate for the sale
            rate_groups = {}
            for item in sale.items.all():
                if item.gst_rate not in rate_groups:
                    rate_groups[item.gst_rate] = {
                        "taxable": Decimal("0.00"),
                        "tax": Decimal("0.00"),
                    }
                rate_groups[item.gst_rate]["taxable"] += item.taxable_amount
                rate_groups[item.gst_rate]["tax"] += item.tax_amount
                
            buyer_gstin = sale.buyer_gstin or ''
            invoice_type = "Regular B2B" if buyer_gstin else "B2C Others"
            
            for rate, amounts in rate_groups.items():
                if amounts["taxable"] > 0:
                    writer.writerow([
                        buyer_gstin,
                        sale.customer_name_snapshot,
                        sale.receipt_number,
                        sale.sale_date.strftime("%d-%b-%y"),
                        sale.total_amount, # Total invoice value is usually printed on all rows for same invoice in GSTR1
                        sale.place_of_supply_state or shop.state_code,
                        'N',
                        '',
                        invoice_type,
                        '',
                        rate,
                        amounts["taxable"],
                        ''
                    ])
                    
        return response
