import "server-only";

import { getSession } from "@/lib/admin-api";

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
