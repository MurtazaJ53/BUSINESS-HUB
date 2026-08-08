from __future__ import annotations

from platform_apps.shops.models import ShopMembership


ROLE_LABELS = {
    ShopMembership.Role.OWNER: "Owner",
    ShopMembership.Role.ADMIN: "Store admin",
    ShopMembership.Role.MANAGER: "Manager",
    ShopMembership.Role.SUPERVISOR: "Supervisor",
    ShopMembership.Role.ACCOUNTANT: "Accountant",
    ShopMembership.Role.HR: "HR",
    ShopMembership.Role.CASHIER: "Cashier",
    ShopMembership.Role.SALES_STAFF: "Sales staff",
    ShopMembership.Role.INVENTORY_STAFF: "Inventory staff",
    ShopMembership.Role.STAFF: "Staff operator",
    ShopMembership.Role.VIEWER: "Read-only viewer",
}

ROLE_SUMMARIES = {
    ShopMembership.Role.OWNER: "Full business control for this workspace, including plan and management decisions.",
    ShopMembership.Role.ADMIN: "Store management access for operations, settings, and workspace controls.",
    ShopMembership.Role.MANAGER: "Manages operations and staff; can invite and assign roles below manager.",
    ShopMembership.Role.SUPERVISOR: "Supervises the shop floor: sales, stock edits, and day-to-day oversight.",
    ShopMembership.Role.ACCOUNTANT: "Finance access: reports, GST, and profit; read-only on operations.",
    ShopMembership.Role.HR: "People operations: staff and attendance management.",
    ShopMembership.Role.CASHIER: "Point-of-sale selling and payments; customer lookup.",
    ShopMembership.Role.SALES_STAFF: "Sales entry and customer work.",
    ShopMembership.Role.INVENTORY_STAFF: "Stock and purchasing management.",
    ShopMembership.Role.STAFF: "Daily operator access for selling, payments, stock updates, and customer work.",
    ShopMembership.Role.VIEWER: "Read-only access for lookup, oversight, and non-destructive review.",
}

ROLE_PRODUCT_PROFILES = {
    ShopMembership.Role.OWNER: "owner_control",
    ShopMembership.Role.ADMIN: "store_admin",
    ShopMembership.Role.MANAGER: "store_admin",
    ShopMembership.Role.SUPERVISOR: "daily_operator",
    ShopMembership.Role.ACCOUNTANT: "read_only",
    ShopMembership.Role.HR: "daily_operator",
    ShopMembership.Role.CASHIER: "daily_operator",
    ShopMembership.Role.SALES_STAFF: "daily_operator",
    ShopMembership.Role.INVENTORY_STAFF: "daily_operator",
    ShopMembership.Role.STAFF: "daily_operator",
    ShopMembership.Role.VIEWER: "read_only",
}

# Every real role maps to itself; a few friendly aliases point at the nearest
# real role. Unknown input falls back to STAFF in normalize_membership_role.
ROLE_ALIASES = {role.value: role for role in ShopMembership.Role}
ROLE_ALIASES.update(
    {
        "shop_admin": ShopMembership.Role.ADMIN,
        "operator": ShopMembership.Role.STAFF,
        "sales": ShopMembership.Role.SALES_STAFF,
        "inventory": ShopMembership.Role.INVENTORY_STAFF,
    }
)


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
