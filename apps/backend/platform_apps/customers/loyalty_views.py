"""Read and change the shop's loyalty rules.

The rules themselves live in `shop.settings_json["loyalty"]` and are read all
over the sale path via `loyalty_config`. This endpoint is the only supported
way to change them, so the clamping in one place is what stops a typo from
handing out unlimited points.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from rest_framework import exceptions, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_apps.audit.services import create_workspace_audit_event
from platform_apps.customers.loyalty import loyalty_config
from platform_apps.shops.models import ShopMembership
from platform_apps.shops.permissions import get_membership_or_403

MAX_POINTS_PER_HUNDRED = 1000
MAX_POINT_VALUE = Decimal("100.00")


def _serialise(shop) -> dict:
    config = loyalty_config(shop)
    return {
        "enabled": config["enabled"],
        "points_per_hundred": config["points_per_hundred"],
        "point_value": config["point_value"],
        # Spelled out so the UI never has to re-derive the promise the shop is
        # making, and both surfaces word it identically.
        "summary": (
            f"{config['points_per_hundred']} point(s) per Rs.100 spent. "
            f"1 point = Rs.{config['point_value']} off."
        ),
    }


class LoyaltySettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, shop_id):
        membership = get_membership_or_403(
            request.user, shop_id, ShopMembership.Role.STAFF
        )
        return Response(_serialise(membership.shop))

    def patch(self, request, shop_id):
        # Changing this changes what the shop owes every existing customer, so
        # it is an owner/admin decision, not a cashier's.
        membership = get_membership_or_403(
            request.user, shop_id, ShopMembership.Role.ADMIN
        )
        shop = membership.shop
        before = _serialise(shop)

        settings_json = dict(shop.settings_json or {})
        current = settings_json.get("loyalty")
        config = dict(current) if isinstance(current, dict) else {}

        if "enabled" in request.data:
            config["enabled"] = bool(request.data["enabled"])

        if "points_per_hundred" in request.data:
            try:
                points = int(request.data["points_per_hundred"])
            except (TypeError, ValueError):
                raise exceptions.ValidationError(
                    {"points_per_hundred": "Enter a whole number of points."}
                )
            if points < 0 or points > MAX_POINTS_PER_HUNDRED:
                raise exceptions.ValidationError(
                    {
                        "points_per_hundred": (
                            f"Must be between 0 and {MAX_POINTS_PER_HUNDRED}."
                        )
                    }
                )
            config["points_per_hundred"] = points

        if "point_value" in request.data:
            try:
                value = Decimal(str(request.data["point_value"]))
            except (TypeError, ValueError, InvalidOperation):
                raise exceptions.ValidationError(
                    {"point_value": "Enter what one point is worth in rupees."}
                )
            # A zero or negative point value would make redemption meaningless
            # or, worse, hand money back.
            if value <= 0 or value > MAX_POINT_VALUE:
                raise exceptions.ValidationError(
                    {"point_value": f"Must be more than 0 and at most {MAX_POINT_VALUE}."}
                )
            config["point_value"] = str(value)

        settings_json["loyalty"] = config
        shop.settings_json = settings_json
        shop.save(update_fields=["settings_json", "updated_at"])

        after = _serialise(shop)
        create_workspace_audit_event(
            shop=shop,
            actor_user=request.user,
            actor_role=membership.role,
            category="shop",
            event_type="shop.loyalty.updated",
            entity_type="shop",
            entity_id=shop.id,
            entity_label=shop.name,
            summary=f"Updated loyalty rules for {shop.name}.",
            source_surface="backend_api",
            before={k: str(v) for k, v in before.items()},
            after={k: str(v) for k, v in after.items()},
        )
        return Response(after)
