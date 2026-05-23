from __future__ import annotations

from rest_framework import exceptions

from platform_apps.shops.models import ShopMembership
from platform_apps.shops.plans import normalize_plan_tier

ROLE_ORDER = {
    ShopMembership.Role.VIEWER: 10,
    ShopMembership.Role.STAFF: 20,
    ShopMembership.Role.ADMIN: 30,
    ShopMembership.Role.OWNER: 40,
}

FEATURE_LABELS = {
    "expenses": "Expenses",
    "attendance": "Attendance",
    "supplier_directory": "Supplier directory",
    "purchase_workflow": "Purchase workflow",
    "advanced_reports": "Advanced reports",
    "multi_branch": "Multi-branch visibility",
    "finance_summary": "Finance summary",
    "advanced_ops": "Advanced ops",
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


def can_assign_workspace_role(actor_role: str, target_role: str) -> bool:
    if actor_role == ShopMembership.Role.OWNER:
        return target_role in {
            ShopMembership.Role.ADMIN,
            ShopMembership.Role.STAFF,
            ShopMembership.Role.VIEWER,
        }

    if actor_role == ShopMembership.Role.ADMIN:
        return target_role in {
            ShopMembership.Role.STAFF,
            ShopMembership.Role.VIEWER,
        }

    return False


def can_manage_workspace_membership(actor_role: str, target_role: str) -> bool:
    if actor_role == ShopMembership.Role.OWNER:
        return target_role in {
            ShopMembership.Role.ADMIN,
            ShopMembership.Role.STAFF,
            ShopMembership.Role.VIEWER,
        }

    if actor_role == ShopMembership.Role.ADMIN:
        return target_role in {
            ShopMembership.Role.STAFF,
            ShopMembership.Role.VIEWER,
        }

    return False


def ensure_workspace_role_assignment_or_403(actor_membership: ShopMembership, target_role: str) -> None:
    if can_assign_workspace_role(actor_membership.role, target_role):
        return

    raise exceptions.PermissionDenied(
        "Your workspace role cannot assign that target role."
    )


def ensure_workspace_membership_management_or_403(
    actor_membership: ShopMembership,
    target_membership: ShopMembership,
) -> None:
    if actor_membership.shop_id != target_membership.shop_id:
        raise exceptions.PermissionDenied("You cannot manage memberships outside your workspace.")

    if actor_membership.user_id == target_membership.user_id:
        raise exceptions.PermissionDenied("You cannot change your own workspace role or status here.")

    if can_manage_workspace_membership(actor_membership.role, target_membership.role):
        return

    raise exceptions.PermissionDenied(
        "Your workspace role cannot manage that membership."
    )


def ensure_workspace_ownership_transfer_or_403(
    actor_membership: ShopMembership,
    target_membership: ShopMembership,
) -> None:
    if actor_membership.shop_id != target_membership.shop_id:
        raise exceptions.PermissionDenied("You cannot transfer ownership outside your workspace.")

    if actor_membership.role != ShopMembership.Role.OWNER:
        raise exceptions.PermissionDenied("Only the current workspace owner can transfer ownership.")

    if actor_membership.user_id == target_membership.user_id:
        raise exceptions.PermissionDenied("Choose another active member to receive workspace ownership.")

    if target_membership.role == ShopMembership.Role.OWNER:
        raise exceptions.PermissionDenied("That membership already owns the workspace.")

    if target_membership.status != ShopMembership.Status.ACTIVE:
        raise exceptions.PermissionDenied("Transfer ownership only to an active workspace member.")


def has_feature_enabled(membership: ShopMembership, feature_key: str) -> bool:
    return membership.shop.enabled_features.get(feature_key) is True


def ensure_feature_enabled_or_403(membership: ShopMembership, feature_key: str) -> None:
    if has_feature_enabled(membership, feature_key):
        return

    plan_label = normalize_plan_tier(membership.shop.plan_tier).title()
    feature_label = FEATURE_LABELS.get(feature_key, feature_key.replace("_", " ").title())
    raise exceptions.PermissionDenied(
        f"{feature_label} is not available on the {plan_label} plan for this workspace."
    )
