import logging
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from celery import shared_task
from django.db import transaction
from django.utils import timezone
from platform_apps.sales.models import SaleCommandReceipt
from platform_apps.sales.serializers import SaleSerializer

logger = logging.getLogger(__name__)

@shared_task(name="process_sale_command_task", queue="default", max_retries=3)
def process_sale_command_task(receipt_id: str):
    logger.info(f"Processing sale command receipt {receipt_id}")
    try:
        receipt = SaleCommandReceipt.objects.select_related("shop", "actor_user").get(pk=receipt_id)
    except SaleCommandReceipt.DoesNotExist:
        logger.error(f"SaleCommandReceipt {receipt_id} not found")
        return

    if receipt.result_status != SaleCommandReceipt.ResultStatus.PENDING:
        logger.info(f"Receipt {receipt_id} is already processed with status {receipt.result_status}")
        return

    sale_payload = receipt.payload_json.get("sale", {})
    command_id = receipt.command_id
    source_surface = receipt.source_surface
    base_domain_epoch = receipt.base_domain_epoch

    with transaction.atomic():
        # Lock receipt to prevent race conditions during task retry
        receipt = SaleCommandReceipt.objects.select_for_update().get(pk=receipt_id)
        if receipt.result_status != SaleCommandReceipt.ResultStatus.PENDING:
            return

        sale_serializer = SaleSerializer(
            data=sale_payload,
            context={
                "shop": receipt.shop,
                "actor": receipt.actor_user,
            },
        )
        if not sale_serializer.is_valid():
            logger.error(f"Validation failed for receipt {receipt_id}: {sale_serializer.errors}")
            # We don't have a FAILED status, just keep it pending or log error.
            # In a production app, we should add a FAILED status to the enum.
            return

        source_meta_json = dict(sale_payload.get("source_meta_json") or {})
        source_meta_json.update(
            {
                "command_id": command_id,
                "source_surface": source_surface,
            }
        )
        
        resolved_epochs = receipt.payload_json.get("resolved_epochs", {})
        domain_epoch = resolved_epochs.get("sales") or base_domain_epoch

        sale = sale_serializer.save(
            source_system="postgres_command",
            source_id=command_id,
            source_shop_id=receipt.shop.source_id,
            source_path=f"shops/{receipt.shop.source_id or receipt.shop_id}/sales/commands/{command_id}",
            domain_epoch=domain_epoch,
            source_meta_json=source_meta_json,
        )

        receipt.sale = sale
        receipt.result_status = SaleCommandReceipt.ResultStatus.ACCEPTED
        receipt.applied_at = timezone.now()
        receipt.save(
            update_fields=["sale", "result_status", "applied_at"]
        )

    logger.info(f"Successfully processed sale command receipt {receipt_id}, created sale {sale.id}")

    # Broadcast to WebSocket. The sale is already committed above, so realtime
    # delivery is best-effort: a Redis/channel-layer outage must NOT fail the
    # command or roll back the sale.
    try:
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"shop_{receipt.shop.id}",
                {
                    "type": "shop_message",
                    "message": {
                        "event": "sale.command.accepted",
                        "command_id": command_id,
                        "receipt_id": str(receipt.id),
                        "sale_id": str(sale.id)
                    }
                }
            )
    except Exception as broadcast_error:  # noqa: BLE001 - realtime is best-effort
        logger.warning(
            "Realtime broadcast failed for sale command %s (sale %s): %s",
            command_id, sale.id, broadcast_error,
        )
