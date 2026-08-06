"""Shop settings: the details that appear on every receipt and GST return.

Until now these lived only in each device's local database — the mobile app's
`saveShopDocument` wrote to Drift and pushed nothing, and the web had no
endpoint to call. So a shop's name, GSTIN and UPI id were per-device: they were
lost on reinstall, and two devices could disagree about what the receipt says.
"""
from __future__ import annotations

import re

from rest_framework import exceptions, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_apps.audit.services import create_workspace_audit_event
from platform_apps.shops.models import ShopMembership
from platform_apps.shops.permissions import get_membership_or_403

# 15 chars: 2 state digits, 10-char PAN, entity digit, 'Z', checksum.
GSTIN_PATTERN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$")
# Anything@bank — same shape the app and the receipt QR builder accept.
UPI_PATTERN = re.compile(r"^[a-zA-Z0-9.\-_]{1,256}@[a-zA-Z]{2,64}$")

#: Free-text values kept in settings_json rather than as columns.
BLOB_FIELDS = (
    "tagline",
    "footer",
    "business_phone",
    "business_email",
    "address",
    "invoice_prefix",
    "upi_vpa",
)

#: Real columns on the Shop row.
COLUMN_FIELDS = (
    "name",
    "legal_name",
    "currency_code",
    "timezone",
    "region_code",
    "gstin",
    "state_code",
)


def serialise(shop) -> dict:
    blob = shop.settings_json or {}
    payload = {field: getattr(shop, field, "") or "" for field in COLUMN_FIELDS}
    payload.update({field: str(blob.get(field, "") or "") for field in BLOB_FIELDS})
    payload["id"] = str(shop.id)
    payload["slug"] = shop.slug
    return payload


class ShopSettingsView(APIView):
    """Read or update the shop's own details."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, shop_id):
        membership = get_membership_or_403(
            request.user, shop_id, ShopMembership.Role.STAFF
        )
        return Response(serialise(membership.shop))

    def patch(self, request, shop_id):
        # These print on every receipt and feed the GST return, so this is an
        # owner/admin decision rather than a cashier's.
        membership = get_membership_or_403(
            request.user, shop_id, ShopMembership.Role.ADMIN
        )
        shop = membership.shop
        before = serialise(shop)

        data = request.data if isinstance(request.data, dict) else {}
        errors: dict[str, str] = {}

        name = data.get("name")
        if name is not None and not str(name).strip():
            # A blank shop name would print an empty receipt header.
            errors["name"] = "The shop name cannot be empty."

        gstin = data.get("gstin")
        if gstin:
            candidate = str(gstin).strip().upper()
            if not GSTIN_PATTERN.match(candidate):
                errors["gstin"] = (
                    "That is not a valid 15-character GSTIN. Leave it blank if the "
                    "shop is not registered."
                )

        upi = data.get("upi_vpa")
        if upi:
            if not UPI_PATTERN.match(str(upi).strip()):
                # A malformed id produces a pay link that silently fails at the
                # counter, which is worse than having no link at all.
                errors["upi_vpa"] = "That is not a valid UPI ID (e.g. name@bank)."

        if errors:
            raise exceptions.ValidationError(errors)

        changed_columns: list[str] = []
        for field in COLUMN_FIELDS:
            if field in data:
                value = str(data[field] or "").strip()
                if field == "gstin":
                    value = value.upper()
                if getattr(shop, field) != value:
                    setattr(shop, field, value)
                    changed_columns.append(field)

        blob = dict(shop.settings_json or {})
        blob_changed = False
        for field in BLOB_FIELDS:
            if field in data:
                value = str(data[field] or "").strip()
                if blob.get(field) != value:
                    blob[field] = value
                    blob_changed = True

        if blob_changed:
            shop.settings_json = blob
            changed_columns.append("settings_json")

        if changed_columns:
            shop.save(update_fields=changed_columns + ["updated_at"])

        after = serialise(shop)
        if changed_columns:
            create_workspace_audit_event(
                shop=shop,
                actor_user=request.user,
                actor_role=membership.role,
                category="shop",
                event_type="shop.settings.updated",
                entity_type="shop",
                entity_id=shop.id,
                entity_label=shop.name,
                summary=f"Updated shop settings for {shop.name}.",
                source_surface="backend_api",
                before=before,
                after=after,
            )
        return Response(after)
