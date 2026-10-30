/** Staff roles from the blueprint. Guests never log in; they reach the guest app by QR code. */
export type Role = 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen';

/** Staff-facing apps that require sign-in. */
export type StaffApp = 'pos' | 'kitchen' | 'owner' | 'admin';

export type Permission =
  | 'orders.create'
  | 'billing.checkout'
  | 'billing.discount.approve'
  | 'tables.manage'
  | 'kitchen.update'
  | 'menu.availability'
  | 'menu.manage'
  | 'reports.view';

export interface StaffUser {
  id: string;
  name: string;
  username: string;
  role: Role;
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner', admin: 'Admin', manager: 'Manager', cashier: 'Cashier', waiter: 'Waiter', kitchen: 'Kitchen staff',
};

export const STAFF_APP_LABEL: Record<StaffApp, string> = {
  pos: 'POS & billing', kitchen: 'Kitchen display', owner: 'Owner dashboard', admin: 'Admin',
};

/** Apps each role may open; the first one is where the role lands after signing in. */
export const ROLE_APPS: Record<Role, StaffApp[]> = {
  owner: ['owner', 'admin', 'pos', 'kitchen'],
  admin: ['admin', 'pos', 'kitchen'],
  manager: ['pos', 'kitchen'],
  cashier: ['pos'],
  waiter: ['pos'],
  kitchen: ['kitchen'],
};

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ['orders.create', 'billing.checkout', 'billing.discount.approve', 'tables.manage', 'kitchen.update', 'menu.availability', 'menu.manage', 'reports.view'],
  admin: ['orders.create', 'billing.checkout', 'billing.discount.approve', 'tables.manage', 'kitchen.update', 'menu.availability', 'menu.manage'],
  manager: ['orders.create', 'billing.checkout', 'billing.discount.approve', 'tables.manage', 'kitchen.update', 'menu.availability'],
  cashier: ['orders.create', 'billing.checkout', 'tables.manage'],
  waiter: ['orders.create', 'tables.manage'],
  kitchen: ['kitchen.update', 'menu.availability'],
};

export function homeApp(role: Role): StaffApp {
  return ROLE_APPS[role][0];
}

export function canOpenApp(role: Role, app: StaffApp): boolean {
  return ROLE_APPS[role].includes(app);
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
