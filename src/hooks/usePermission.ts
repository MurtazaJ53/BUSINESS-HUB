import { useBusinessStore } from '@/lib/useBusinessStore';
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
  
  if (role === 'admin') return true;
  return cur?.permissions?.[mod]?.[act] || false;
};
