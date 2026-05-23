from __future__ import annotations

from platform_apps.shops.models import ShopMembership


ROLE_LABELS = {
    ShopMembership.Role.OWNER: "Owner",
    ShopMembership.Role.ADMIN: "Store admin",
    ShopMembership.Role.STAFF: "Staff operator",
    ShopMembership.Role.VIEWER: "Read-only viewer",
}

ROLE_SUMMARIES = {
    ShopMembership.Role.OWNER: "Full business control for this workspace, including plan and management decisions.",
    ShopMembership.Role.ADMIN: "Store management access for operations, settings, and workspace controls.",
    ShopMembership.Role.STAFF: "Daily operator access for selling, payments, stock updates, and customer work.",
    ShopMembership.Role.VIEWER: "Read-only access for lookup, oversight, and non-destructive review.",
}

ROLE_PRODUCT_PROFILES = {
    ShopMembership.Role.OWNER: "owner_control",
    ShopMembership.Role.ADMIN: "store_admin",
    ShopMembership.Role.STAFF: "daily_operator",
    ShopMembership.Role.VIEWER: "read_only",
}

ROLE_ALIASES = {
    "owner": ShopMembership.Role.OWNER,
    "admin": ShopMembership.Role.ADMIN,
    "shop_admin": ShopMembership.Role.ADMIN,
    "manager": ShopMembership.Role.ADMIN,
    "staff": ShopMembership.Role.STAFF,
    "cashier": ShopMembership.Role.STAFF,
    "operator": ShopMembership.Role.STAFF,
    "viewer": ShopMembership.Role.VIEWER,
}


def normalize_membership_role(
    raw_role: str | None,
    *,
    is_shop_owner: bool = False,
) -> str:
    if is_shop_owner:
        return ShopMembership.Role.OWNER

    normalized = (raw_role or "").strip().lower()
    return ROLE_ALIASES.get(normalized, ShopMembership.Role.STAFF)


def get_membership_role_label(role: str | None) -> str:
    normalized = normalize_membership_role(role)
    return ROLE_LABELS[normalized]


def get_membership_role_summary(role: str | None) -> str:
    normalized = normalize_membership_role(role)
    return ROLE_SUMMARIES[normalized]


def get_membership_role_product_profile(role: str | None) -> str:
    normalized = normalize_membership_role(role)
    return ROLE_PRODUCT_PROFILES[normalized]
