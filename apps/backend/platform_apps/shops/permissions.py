from __future__ import annotations

from rest_framework import exceptions

from platform_apps.shops.models import ShopMembership

ROLE_ORDER = {
    ShopMembership.Role.VIEWER: 10,
    ShopMembership.Role.STAFF: 20,
    ShopMembership.Role.ADMIN: 30,
    ShopMembership.Role.OWNER: 40,
}


def get_membership_or_403(user, shop_id, minimum_role: str = ShopMembership.Role.VIEWER) -> ShopMembership:
    membership = (
        ShopMembership.objects.select_related("shop")
        .filter(user=user, shop_id=shop_id, status=ShopMembership.Status.ACTIVE)
        .first()
    )
    if membership is None:
        raise exceptions.PermissionDenied("You do not have access to this shop.")

    if ROLE_ORDER[membership.role] < ROLE_ORDER[minimum_role]:
        raise exceptions.PermissionDenied("Your role does not allow this action.")

    return membership
