import { describe, expect, it } from 'vitest';
import {
  canChooseOperationTechnician,
  permissionsForRole,
  requiresLinkedTechnician,
} from './permissions';
import type { SecurityUser } from './types';

const user = (role: SecurityUser['role']): SecurityUser => ({
  id: `user-${role}`,
  name: role,
  role,
  pinHash: 'hash',
  active: true,
  failedAttempts: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('permisos por rol', () => {
  it('concede control completo al administrador', () => {
    const permissions = permissionsForRole('admin');
    expect(permissions).toContain('security.manage');
    expect(permissions).toContain('audit.view');
    expect(permissions).toContain('backup.restore');
    expect(permissions).toContain('operations.execute');
  });

  it('permite operar y gestionar material al responsable de almacén', () => {
    const permissions = permissionsForRole('warehouse');
    expect(permissions).toContain('operations.execute');
    expect(permissions).toContain('inventory.manage');
    expect(permissions).toContain('maintenance.manage');
    expect(permissions).not.toContain('security.manage');
    expect(permissions).not.toContain('backup.restore');
  });

  it('mantiene al coordinador en consulta e informes', () => {
    const permissions = permissionsForRole('coordinator');
    expect(permissions).toContain('reports.export');
    expect(permissions).toContain('audit.view');
    expect(permissions).not.toContain('operations.execute');
    expect(permissions).not.toContain('inventory.manage');
  });

  it('permite al técnico operar sin conceder gestión administrativa', () => {
    const permissions = permissionsForRole('technician');
    expect(permissions).toContain('operations.execute');
    expect(permissions).not.toContain('inventory.manage');
    expect(permissions).not.toContain('maintenance.manage');
  });

  it('solo permite elegir cualquier técnico a administración y almacén', () => {
    expect(canChooseOperationTechnician(user('admin'))).toBe(true);
    expect(canChooseOperationTechnician(user('warehouse'))).toBe(true);
    expect(canChooseOperationTechnician(user('coordinator'))).toBe(false);
    expect(canChooseOperationTechnician(user('technician'))).toBe(false);
  });

  it('exige una ficha vinculada únicamente al usuario técnico', () => {
    expect(requiresLinkedTechnician(user('technician'))).toBe(true);
    expect(requiresLinkedTechnician(user('coordinator'))).toBe(false);
  });
});
