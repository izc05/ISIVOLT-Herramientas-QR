import { describe, expect, it } from 'vitest';
import { permissionsForRole } from './permissions';

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

  it('mantiene al técnico en modo consulta', () => {
    expect(permissionsForRole('technician')).toEqual([]);
  });
});
