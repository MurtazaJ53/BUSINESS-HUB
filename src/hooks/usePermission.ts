import { useBusinessStore } from '@/lib/useBusinessStore';
import { useAuthStore } from '@/lib/useAuthStore';
import { getEffectivePermissionMatrix, getPermissionValue } from '@/lib/permissions';
import { Module, Action, LimitedAction } from '@/lib/types';

/**
 * Checks if the current staff member has permission for a specific module action.
 * Returns `true` if the user is an admin or has boolean `true` for the action.
 * If the action is a limited action object (e.g., `{ max: 100 }`), returns the object.
 * Returns `false` otherwise.
 */
export const usePermission = (mod: Module, act: Action): LimitedAction => {
  const cur = useBusinessStore(s => s.currentStaff);
  const role = useBusinessStore(s => s.role);
  const isLocked = useBusinessStore(s => s.isLocked);
  const claimPermissions = useAuthStore(s => s.permissions);

  const permissions = getEffectivePermissionMatrix({
    role,
    isLocked,
    staffRole: cur?.role,
    staffPermissions: cur?.permissions,
    claimPermissions,
  });

  return getPermissionValue(permissions, mod, act);
};
