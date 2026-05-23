import "server-only";

import { getSession } from "@/lib/admin-api";
import type { ShopMembership } from "@/lib/types";

function canManageWorkspace(role: ShopMembership["role"]) {
  return role === "owner" || role === "admin";
}

export async function requirePlatformAdminAccess(contextLabel: string) {
  const session = await getSession();

  if (!session.user.is_platform_admin) {
    throw new Error(`${contextLabel} requires a platform-admin account.`);
  }

  return session;
}

export async function requirePlatformAdminShopAccess(
  shopId: string,
  contextLabel: string,
) {
  const session = await requirePlatformAdminAccess(contextLabel);

  const hasShopAccess = session.memberships.some((membership) => membership.shop.id === shopId);
  if (!hasShopAccess) {
    throw new Error(`${contextLabel} requires access to the selected workspace.`);
  }

  return session;
}

export async function requireWorkspaceManagerAccess(
  shopId: string,
  contextLabel: string,
) {
  const session = await getSession();
  const membership = session.memberships.find((entry) => entry.shop.id === shopId);

  if (!membership) {
    throw new Error(`${contextLabel} requires access to the selected workspace.`);
  }

  if (!canManageWorkspace(membership.role)) {
    throw new Error(`${contextLabel} requires an owner or admin workspace role.`);
  }

  return { session, membership };
}

export async function requireWorkspaceOwnerAccess(
  shopId: string,
  contextLabel: string,
) {
  const session = await getSession();
  const membership = session.memberships.find((entry) => entry.shop.id === shopId);

  if (!membership) {
    throw new Error(`${contextLabel} requires access to the selected workspace.`);
  }

  if (membership.role !== "owner") {
    throw new Error(`${contextLabel} requires the current workspace owner role.`);
  }

  return { session, membership };
}
