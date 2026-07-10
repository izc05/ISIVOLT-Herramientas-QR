import { describe, expect, it } from 'vitest';
import { DATABASE_MIGRATIONS, MOVEMENT_IMMUTABILITY_TRIGGERS } from './schema';

const schema = DATABASE_MIGRATIONS.map((migration) => migration.statements).join('\n');

describe('SQLite schema 0.7', () => {
  it('crea las entidades principales del inventario', () => {
    for (const table of [
      'categories',
      'locations',
      'technicians',
      'tools',
      'movements',
      'accessories',
      'movement_accessories',
      'users',
      'app_settings',
      'audit_log',
    ]) {
      expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('impone códigos y QR únicos', () => {
    expect(schema).toMatch(/code TEXT NOT NULL COLLATE NOCASE UNIQUE/);
    expect(schema).toMatch(/qr_code TEXT NOT NULL COLLATE NOCASE UNIQUE/);
  });

  it('protege el estado de préstamo mediante CHECK', () => {
    expect(schema).toContain("status = 'loaned' AND holder_technician_id IS NOT NULL AND loaned_at IS NOT NULL");
    expect(schema).toContain("status <> 'loaned' AND holder_technician_id IS NULL AND loaned_at IS NULL");
  });

  it('impide modificar y borrar movimientos', () => {
    expect(MOVEMENT_IMMUTABILITY_TRIGGERS).toContain('BEFORE UPDATE ON movements');
    expect(MOVEMENT_IMMUTABILITY_TRIGGERS).toContain('BEFORE DELETE ON movements');
  });

  it('incluye claves foráneas e índices de consulta', () => {
    expect(schema).toContain('FOREIGN KEY (holder_technician_id) REFERENCES technicians');
    expect(schema).toContain('FOREIGN KEY (tool_id) REFERENCES tools');
    expect(schema).toContain('idx_movements_tool_time');
    expect(schema).toContain('idx_tools_status');
  });
});
