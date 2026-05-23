import type { ShopMembership } from "@/lib/types";

export type WorkspaceRole = ShopMembership["role"] | null;

export function canManageWorkspace(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

export function canAccessPaymentsWorkspace(role: WorkspaceRole) {
  return canManageWorkspace(role);
}
