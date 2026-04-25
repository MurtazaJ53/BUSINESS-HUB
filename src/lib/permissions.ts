import type { Action, LimitedAction, Module, PermissionMatrix } from './types';

const MODULE_ACTIONS: Record<Module, Action[]> = {
  inventory: ['view', 'create', 'edit', 'delete', 'view_cost'],
  sales: ['view', 'create', 'edit', 'delete', 'override_price', 'void_sale', 'view_profit'],
  customers: ['view', 'create', 'edit', 'delete', 'approve_credit'],
  expenses: ['view', 'create', 'edit', 'delete'],
  analytics: ['view', 'export'],
  team: ['view', 'edit', 'view_cost'],
  settings: ['view', 'edit'],
};

const MODULE_ALIASES: Record<string, Module> = {
  inventory: 'inventory',
  sales: 'sales',
  sales_hub: 'sales',
  customers: 'customers',
  expenses: 'expenses',
  analytics: 'analytics',
  team: 'team',
  team_portal: 'team',
  settings: 'settings',
};

const ACTION_ALIASES: Record<string, Action> = {
  view: 'view',
  add: 'create',
  create: 'create',
  edit: 'edit',
  delete: 'delete',
  export: 'export',
  price: 'override_price',
  override_price: 'override_price',
  void: 'void_sale',
  void_sale: 'void_sale',
  cost: 'view_cost',
  view_cost: 'view_cost',
  profit: 'view_profit',
  view_profit: 'view_profit',
  credit: 'approve_credit',
  approve_credit: 'approve_credit',
};

const ROUTE_PERMISSIONS: Record<string, Array<[Module, Action, LimitedAction?]>> = {
  inventory: [['inventory', 'view']],
  sell: [['sales', 'view'], ['sales', 'create']],
  history: [['sales', 'view']],
  customers: [['customers', 'view']],
  expenses: [['expenses', 'view']],
  analytics: [['analytics', 'view']],
  team: [['team', 'view']],
  settings: [['settings', 'view']],
  'stock-alerts': [['inventory', 'view']],
};

const ROLE_ALIASES: Record<string, string> = {
  Sales: 'Sales Associate',
  Manager: 'Store Manager',
  Staff: 'General Staff',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const clonePermissionMatrix = (matrix?: PermissionMatrix | null): PermissionMatrix =>
  JSON.parse(JSON.stringify(matrix ?? {}));

const setPermission = (
  matrix: PermissionMatrix,
  moduleId: Module,
  actionId: Action,
  value: LimitedAction = true,
) => {
  if (!MODULE_ACTIONS[moduleId].includes(actionId)) return;
  matrix[moduleId] = {
    ...(matrix[moduleId] || {}),
    [actionId]: value,
  };
};

const normalizeLimitedAction = (actionId: Action, value: unknown): LimitedAction | null => {
  if (value === true) return true;
  if (value === false || value == null) return null;

  if (actionId === 'override_price' && isRecord(value)) {
    const next: { max?: number; requiresApproval?: boolean } = {};
    const maxValue = Number(value.max);
    if (Number.isFinite(maxValue)) next.max = maxValue;
    if (typeof value.requiresApproval === 'boolean') next.requiresApproval = value.requiresApproval;
    return Object.keys(next).length > 0 ? next : true;
  }

  if (isRecord(value) && typeof value.requiresApproval === 'boolean') {
    return { requiresApproval: value.requiresApproval };
  }

  return true;
};

const normalizeRoutePermissions = (values: string[], fallback: PermissionMatrix): PermissionMatrix => {
  const next: PermissionMatrix = {};

  for (const rawValue of values) {
    const key = rawValue.trim().toLowerCase();
    const mapped = ROUTE_PERMISSIONS[key];
    if (!mapped) continue;

    for (const [moduleId, actionId, value] of mapped) {
      setPermission(next, moduleId, actionId, value ?? true);
    }
  }

  return Object.keys(next).length > 0 ? next : clonePermissionMatrix(fallback);
};

export const normalizePermissionMatrix = (
  input: unknown,
  fallback: PermissionMatrix = {},
): PermissionMatrix => {
  if (Array.isArray(input)) {
    return normalizeRoutePermissions(
      input.filter((value): value is string => typeof value === 'string'),
      fallback,
    );
  }

  if (!isRecord(input)) {
    return clonePermissionMatrix(fallback);
  }

  const next: PermissionMatrix = {};

  for (const [rawModule, rawValue] of Object.entries(input)) {
    const moduleId = MODULE_ALIASES[rawModule];
    if (!moduleId) continue;

    if (Array.isArray(rawValue)) {
      for (const rawAction of rawValue) {
        if (typeof rawAction !== 'string') continue;
        const actionId = ACTION_ALIASES[rawAction];
        if (actionId) setPermission(next, moduleId, actionId);
      }
      continue;
    }

    if (rawValue === true) {
      setPermission(next, moduleId, 'view');
      continue;
    }

    if (!isRecord(rawValue)) continue;

    for (const [rawAction, permissionValue] of Object.entries(rawValue)) {
      const actionId = ACTION_ALIASES[rawAction];
      if (!actionId) continue;

      const normalizedValue = normalizeLimitedAction(actionId, permissionValue);
      if (normalizedValue) {
        setPermission(next, moduleId, actionId, normalizedValue);
      }
    }
  }

  return Object.keys(next).length > 0 ? next : clonePermissionMatrix(fallback);
};

export const ADMIN_PERMISSION_TEMPLATE: PermissionMatrix = normalizePermissionMatrix({
  inventory: { view: true, create: true, edit: true, delete: true, view_cost: true },
  sales: { view: true, create: true, edit: true, delete: true, override_price: true, void_sale: true, view_profit: true },
  customers: { view: true, create: true, edit: true, delete: true, approve_credit: true },
  expenses: { view: true, create: true, edit: true, delete: true },
  analytics: { view: true, export: true },
  team: { view: true, edit: true, view_cost: true },
  settings: { view: true, edit: true },
});

export const STAFF_LOCK_PERMISSION_TEMPLATE: PermissionMatrix = normalizePermissionMatrix({
  sales: { view: true, create: true },
  customers: { view: true, create: true },
  team: { view: true },
});

export const ROLE_PERMISSION_TEMPLATES: Record<string, PermissionMatrix> = {
  'Store Manager': normalizePermissionMatrix({
    inventory: { view: true, create: true, edit: true, delete: true, view_cost: true },
    sales: { view: true, create: true, edit: true, override_price: { max: 1000 }, void_sale: true, view_profit: true },
    customers: { view: true, create: true, edit: true, delete: true, approve_credit: true },
    expenses: { view: true, create: true, delete: true },
    analytics: { view: true, export: true },
    team: { view: true, edit: true, view_cost: true },
  }),
  'Sales Associate': normalizePermissionMatrix({
    inventory: { view: true },
    sales: { view: true, create: true },
    customers: { view: true, create: true },
    team: { view: true },
  }),
  'Delivery Partner': normalizePermissionMatrix({
    sales: { view: true },
    customers: { view: true },
    team: { view: true },
  }),
  'Inventory Incharge': normalizePermissionMatrix({
    inventory: { view: true, create: true, edit: true, delete: true, view_cost: true },
    team: { view: true },
  }),
  'General Staff': normalizePermissionMatrix({
    inventory: { view: true },
    sales: { view: true },
    team: { view: true },
  }),
};

export const getRolePermissions = (role: string, fallbackRole = 'Sales Associate'): PermissionMatrix => {
  const canonicalRole = ROLE_ALIASES[role] ?? role;
  return clonePermissionMatrix(
    ROLE_PERMISSION_TEMPLATES[canonicalRole] ?? ROLE_PERMISSION_TEMPLATES[fallbackRole] ?? {},
  );
};

interface EffectivePermissionContext {
  role: string | null;
  isLocked?: boolean;
  staffRole?: string | null;
  staffPermissions?: unknown;
  claimPermissions?: unknown;
}

export const getEffectivePermissionMatrix = ({
  role,
  isLocked = false,
  staffRole,
  staffPermissions,
  claimPermissions,
}: EffectivePermissionContext): PermissionMatrix => {
  if (role === 'admin') {
    return normalizePermissionMatrix(staffPermissions, ADMIN_PERMISSION_TEMPLATE);
  }

  if (!role || role === 'suspended') {
    return {};
  }

  if (isLocked && staffRole === 'admin') {
    return clonePermissionMatrix(STAFF_LOCK_PERMISSION_TEMPLATE);
  }

  const fallback = normalizePermissionMatrix(claimPermissions, {});
  return normalizePermissionMatrix(staffPermissions, fallback);
};

export const getPermissionValue = (
  permissions: PermissionMatrix,
  moduleId: Module,
  actionId: Action,
): LimitedAction => permissions[moduleId]?.[actionId] || false;
