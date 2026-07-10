import { getCurrentSecurityUser } from './session';
import type { Permission, SecurityUser, UserRole } from './types';

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  admin: new Set<Permission>([
    'operations.execute',
    'inventory.manage',
    'technicians.manage',
    'maintenance.manage',
    'reports.export',
    'backup.restore',
    'security.manage',
    'audit.view',
    'diagnostics.view',
  ]),
  warehouse: new Set<Permission>([
    'operations.execute',
    'inventory.manage',
    'maintenance.manage',
    'reports.export',
  ]),
  technician: new Set<Permission>(),
};

export class PermissionError extends Error {
  constructor(public readonly permission: Permission) {
    super('Tu usuario no tiene permiso para realizar esta acción.');
    this.name = 'PermissionError';
  }
}

export const hasPermission = (permission: Permission, user: SecurityUser | null = getCurrentSecurityUser()) =>
  Boolean(user?.active && ROLE_PERMISSIONS[user.role].has(permission));

export const assertPermission = (permission: Permission) => {
  if (!hasPermission(permission)) throw new PermissionError(permission);
};

export const permissionsForRole = (role: UserRole) => [...ROLE_PERMISSIONS[role]];
