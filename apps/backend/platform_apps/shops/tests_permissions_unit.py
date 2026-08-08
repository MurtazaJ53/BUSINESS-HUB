"""Pure unit tests for workspace-role permission helpers (no DB required).

All functions under test accept role *strings*, so we can call them without
creating any ORM objects.  Tests cover:
  - ``can_assign_workspace_role``
  - ``can_manage_workspace_membership``
  - ``can_assign_workspace_pulse_signal``
  - ``_can_act_on_role`` (indirectly via the public API)
  - ``ROLE_ORDER`` internal ordering
"""
from __future__ import annotations

import pytest
from unittest.mock import MagicMock

from platform_apps.shops.models import ShopMembership
from platform_apps.shops.permissions import (
    ROLE_ORDER,
    can_assign_workspace_role,
    can_assign_workspace_pulse_signal,
    can_manage_workspace_membership,
)

R = ShopMembership.Role


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _membership(role: str, shop_id=1, user_id=1, status=None) -> MagicMock:
    """Lightweight stand-in for ShopMembership — no DB writes."""
    m = MagicMock(spec=ShopMembership)
    m.role = role
    m.shop_id = shop_id
    m.user_id = user_id
    m.status = status or ShopMembership.Status.ACTIVE
    return m


# ---------------------------------------------------------------------------
# ROLE_ORDER sanity
# ---------------------------------------------------------------------------

def test_owner_is_highest_rank():
    assert ROLE_ORDER[R.OWNER] > ROLE_ORDER[R.ADMIN]
    assert ROLE_ORDER[R.ADMIN] >= ROLE_ORDER[R.MANAGER]
    assert ROLE_ORDER[R.MANAGER] > ROLE_ORDER[R.STAFF]
    assert ROLE_ORDER[R.STAFF] > ROLE_ORDER[R.VIEWER]


def test_cashier_sales_staff_inventory_staff_are_same_rank():
    assert ROLE_ORDER[R.CASHIER] == ROLE_ORDER[R.SALES_STAFF]
    assert ROLE_ORDER[R.CASHIER] == ROLE_ORDER[R.INVENTORY_STAFF]
    assert ROLE_ORDER[R.CASHIER] == ROLE_ORDER[R.STAFF]


# ---------------------------------------------------------------------------
# can_assign_workspace_role
# ---------------------------------------------------------------------------

class TestCanAssignWorkspaceRole:
    def test_owner_can_assign_admin(self):
        assert can_assign_workspace_role(R.OWNER, R.ADMIN) is True

    def test_owner_can_assign_manager(self):
        assert can_assign_workspace_role(R.OWNER, R.MANAGER) is True

    def test_owner_can_assign_cashier(self):
        assert can_assign_workspace_role(R.OWNER, R.CASHIER) is True

    def test_owner_can_assign_viewer(self):
        assert can_assign_workspace_role(R.OWNER, R.VIEWER) is True

    def test_owner_cannot_assign_another_owner(self):
        """Ownership transfer has its own dedicated flow."""
        assert can_assign_workspace_role(R.OWNER, R.OWNER) is False

    def test_admin_can_assign_staff(self):
        assert can_assign_workspace_role(R.ADMIN, R.STAFF) is True

    def test_admin_can_assign_viewer(self):
        assert can_assign_workspace_role(R.ADMIN, R.VIEWER) is True

    def test_admin_cannot_assign_manager(self):
        """Admin rank == Manager rank → cannot assign equal rank."""
        assert can_assign_workspace_role(R.ADMIN, R.MANAGER) is False

    def test_admin_cannot_assign_admin(self):
        assert can_assign_workspace_role(R.ADMIN, R.ADMIN) is False

    def test_admin_cannot_assign_owner(self):
        assert can_assign_workspace_role(R.ADMIN, R.OWNER) is False

    def test_manager_can_assign_cashier(self):
        assert can_assign_workspace_role(R.MANAGER, R.CASHIER) is True

    def test_manager_cannot_assign_admin(self):
        assert can_assign_workspace_role(R.MANAGER, R.ADMIN) is False

    def test_cashier_can_assign_viewer(self):
        """Cashier rank (20) > Viewer rank (10), so cashier CAN assign viewer."""
        assert can_assign_workspace_role(R.CASHIER, R.VIEWER) is True

    def test_cashier_cannot_assign_same_rank(self):
        """Cashier cannot assign STAFF/CASHIER/SALES_STAFF (same rank)."""
        for target in [R.STAFF, R.CASHIER, R.SALES_STAFF, R.INVENTORY_STAFF]:
            assert can_assign_workspace_role(R.CASHIER, target) is False

    def test_cashier_cannot_assign_higher_rank(self):
        for target in [R.MANAGER, R.ADMIN, R.OWNER]:
            assert can_assign_workspace_role(R.CASHIER, target) is False

    def test_viewer_cannot_assign_anyone(self):
        for target in [R.VIEWER, R.STAFF, R.CASHIER]:
            assert can_assign_workspace_role(R.VIEWER, target) is False

    def test_unknown_actor_role_returns_false(self):
        assert can_assign_workspace_role("superuser", R.STAFF) is False

    def test_unknown_target_role_returns_false(self):
        assert can_assign_workspace_role(R.OWNER, "superuser") is False


# ---------------------------------------------------------------------------
# can_manage_workspace_membership — same logic as can_assign_workspace_role
# ---------------------------------------------------------------------------

class TestCanManageWorkspaceMembership:
    def test_owner_can_manage_staff(self):
        assert can_manage_workspace_membership(R.OWNER, R.STAFF) is True

    def test_staff_can_manage_viewer(self):
        """STAFF rank (20) > VIEWER rank (10) → staff CAN manage viewer."""
        assert can_manage_workspace_membership(R.STAFF, R.VIEWER) is True

    def test_staff_cannot_manage_same_rank(self):
        """STAFF cannot manage anyone at the same rank (20)."""
        for target in [R.CASHIER, R.SALES_STAFF, R.INVENTORY_STAFF, R.STAFF]:
            assert can_manage_workspace_membership(R.STAFF, target) is False

    def test_manager_can_manage_cashier(self):
        assert can_manage_workspace_membership(R.MANAGER, R.CASHIER) is True

    def test_manager_cannot_manage_admin(self):
        assert can_manage_workspace_membership(R.MANAGER, R.ADMIN) is False


# ---------------------------------------------------------------------------
# can_assign_workspace_pulse_signal
# ---------------------------------------------------------------------------

class TestCanAssignWorkspacePulseSignal:
    def _setup(self, actor_role, target_role, *, same_user=False, target_inactive=False):
        actor = _membership(actor_role, shop_id=1, user_id=1)
        target = _membership(
            target_role,
            shop_id=1,
            user_id=1 if same_user else 2,
            status=ShopMembership.Status.DISABLED if target_inactive else ShopMembership.Status.ACTIVE,
        )
        return actor, target

    # Same-shop, active target
    def test_owner_can_signal_staff(self):
        actor, target = self._setup(R.OWNER, R.STAFF)
        assert can_assign_workspace_pulse_signal(actor, target) is True

    def test_manager_can_signal_cashier(self):
        actor, target = self._setup(R.MANAGER, R.CASHIER)
        assert can_assign_workspace_pulse_signal(actor, target) is True

    def test_cashier_can_signal_viewer(self):
        """CASHIER rank (20) > VIEWER rank (10) → cashier CAN signal viewer."""
        actor, target = self._setup(R.CASHIER, R.VIEWER)
        assert can_assign_workspace_pulse_signal(actor, target) is True

    def test_viewer_cannot_signal_cashier(self):
        """VIEWER rank (10) < CASHIER rank (20) → viewer cannot signal cashier."""
        actor, target = self._setup(R.VIEWER, R.CASHIER)
        assert can_assign_workspace_pulse_signal(actor, target) is False

    # Inactive target is always blocked
    def test_inactive_target_is_blocked(self):
        actor, target = self._setup(R.OWNER, R.STAFF, target_inactive=True)
        assert can_assign_workspace_pulse_signal(actor, target) is False

    # Same user — owner/admin self-signal is allowed
    def test_owner_can_self_signal(self):
        actor, target = self._setup(R.OWNER, R.OWNER, same_user=True)
        assert can_assign_workspace_pulse_signal(actor, target) is True

    def test_admin_can_self_signal(self):
        actor, target = self._setup(R.ADMIN, R.ADMIN, same_user=True)
        assert can_assign_workspace_pulse_signal(actor, target) is True

    def test_cashier_cannot_self_signal(self):
        actor, target = self._setup(R.CASHIER, R.CASHIER, same_user=True)
        assert can_assign_workspace_pulse_signal(actor, target) is False

    # Cross-shop — different shop_id
    def test_cross_shop_is_always_blocked(self):
        actor = _membership(R.OWNER, shop_id=1)
        target = _membership(R.STAFF, shop_id=2)
        assert can_assign_workspace_pulse_signal(actor, target) is False
