"""Canonical permission catalog: the modules and actions a custom role can be
granted. Server-driven so the mobile editor renders exactly what the backend
understands, and there's a single source of truth for permission keys.
"""
from __future__ import annotations

from rest_framework.response import Response
from rest_framework.views import APIView

from platform_apps.shops.models import ShopMembership
from platform_apps.shops.permissions import get_membership_or_403

# module key -> (label, [action keys]). Actions are the CRUD+ verbs relevant to
# that module; the editor shows a toggle per (module, action).
PERMISSION_CATALOG: list[dict] = [
    {"key": "pos", "label": "POS / Billing",
     "actions": ["view", "create", "refund", "discount"]},
    {"key": "inventory", "label": "Inventory",
     "actions": ["view", "create", "edit", "delete", "view_cost"]},
    {"key": "customers", "label": "Customers / Khata",
     "actions": ["view", "create", "edit", "delete"]},
    {"key": "purchases", "label": "Purchases / Suppliers",
     "actions": ["view", "create", "edit", "delete"]},
    {"key": "expenses", "label": "Expenses",
     "actions": ["view", "create", "delete"]},
    {"key": "reports", "label": "Reports / GST",
     "actions": ["view", "export", "view_profit"]},
    {"key": "team", "label": "Team / Roles",
     "actions": ["view", "manage", "assign_roles"]},
    {"key": "settings", "label": "Settings",
     "actions": ["view", "edit"]},
]

ACTION_LABELS = {
    "view": "View", "create": "Create", "edit": "Edit", "delete": "Delete",
    "refund": "Refund", "discount": "Discount", "view_cost": "See cost",
    "view_profit": "See profit", "export": "Export", "manage": "Manage",
    "assign_roles": "Assign roles", "approve": "Approve", "print": "Print",
}

_VALID = {m["key"]: set(m["actions"]) for m in PERMISSION_CATALOG}


def sanitize_permissions(raw: dict | None) -> dict:
    """Keep only known module/action keys with boolean values, so a client can
    never inject arbitrary permission keys."""
    if not isinstance(raw, dict):
        return {}
    clean: dict = {}
    for module, actions in raw.items():
        if module not in _VALID or not isinstance(actions, dict):
            continue
        allowed = _VALID[module]
        # Store only GRANTED actions - permissions_json lists what's allowed,
        # so disabled toggles are simply absent (smaller, unambiguous).
        picked = {
            action: True
            for action, value in actions.items()
            if action in allowed and value is True
        }
        if picked:
            clean[module] = picked
    return clean


class PermissionCatalogView(APIView):
    """GET the module/action catalog + action labels. Any active member may
    read it (the editor is gated separately by role)."""

    def get(self, request, shop_id):
        get_membership_or_403(request.user, shop_id, ShopMembership.Role.VIEWER)
        return Response(
            {"catalog": PERMISSION_CATALOG, "action_labels": ACTION_LABELS}
        )
