export type UserRole = 'admin' | 'warehouse' | 'coordinator' | 'technician';

export type SecurityUser = {
  id: string;
  name: string;
  role: UserRole;
  technicianId?: string;
  pinHash: string;
  active: boolean;
  failedAttempts: number;
  lockedUntil?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type SecuritySession = {
  userId: string;
  unlockedAt: string;
  lastActivityAt: string;
};

export type AuditEntry = {
  id: string;
  eventType:
    | 'security.setup'
    | 'security.login'
    | 'security.logout'
    | 'security.failed-login'
    | 'security.lock'
    | 'user.created'
    | 'user.updated'
    | 'movement.created'
    | 'movement.rectified'
    | 'data.exported'
    | 'data.restored'
    | 'admin.action';
  entityType?: string;
  entityId?: string;
  operatorUserId?: string;
  operatorName?: string;
  occurredAt: string;
  detail?: string;
};

export type Permission =
  | 'operations.execute'
  | 'inventory.manage'
  | 'technicians.manage'
  | 'maintenance.manage'
  | 'reports.export'
  | 'backup.restore'
  | 'security.manage'
  | 'audit.view'
  | 'diagnostics.view';
