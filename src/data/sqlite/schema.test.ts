import { describe, expect, it } from 'vitest';
import { DATABASE_MIGRATIONS, MOVEMENT_IMMUTABILITY_TRIGGERS } from './schema';

const schema = DATABASE_MIGRATIONS.map((migration) => migration.statements).join('\n');

describe('SQLite schema RC30 identificación y operaciones', () => {
  it('mantiene las migraciones ordenadas y versionadas', () => {
    expect(DATABASE_MIGRATIONS.map((migration) => migration.version)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(DATABASE_MIGRATIONS[1].name).toBe('asset_management_and_maintenance');
    expect(DATABASE_MIGRATIONS[2].name).toBe('nfc_identification');
    expect(DATABASE_MIGRATIONS[3].name).toBe('movement_operation_idempotency');
    expect(DATABASE_MIGRATIONS[4].name).toBe('technician_barcode_identification');
    expect(DATABASE_MIGRATIONS[5].name).toBe('movement_context_and_accessory_checks');
  });

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
      'maintenance_records',
    ]) {
      expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('impone códigos y QR únicos', () => {
    expect(schema).toMatch(/code TEXT NOT NULL COLLATE NOCASE UNIQUE/);
    expect(schema).toMatch(/qr_code TEXT NOT NULL COLLATE NOCASE UNIQUE/);
  });

  it('añade UID NFC único para técnicos y herramientas', () => {
    expect(schema).toContain('ALTER TABLE technicians ADD COLUMN nfc_uid TEXT');
    expect(schema).toContain('ALTER TABLE tools ADD COLUMN nfc_uid TEXT');
    expect(schema).toContain('idx_technicians_nfc_uid');
    expect(schema).toContain('idx_tools_nfc_uid');
  });

  it('persiste el identificador de operación para impedir duplicados tras reiniciar', () => {
    expect(schema).toContain('ALTER TABLE movements ADD COLUMN operation_id TEXT');
    expect(schema).toContain('idx_movements_operation_id');
  });

  it('persiste un código de barras único por técnico', () => {
    expect(schema).toContain('ALTER TABLE technicians ADD COLUMN barcode_value TEXT');
    expect(schema).toContain('idx_technicians_barcode_value');
  });

  it('persiste OT, ubicación y fecha prevista de devolución', () => {
    expect(schema).toContain('ALTER TABLE movements ADD COLUMN expected_return_at TEXT');
    expect(schema).toContain('ALTER TABLE movements ADD COLUMN work_order TEXT');
    expect(schema).toContain('ALTER TABLE movements ADD COLUMN work_location TEXT');
    expect(schema).toContain('idx_movements_expected_return');
    expect(schema).toContain('idx_movements_work_order');
  });

  it('protege el estado de préstamo mediante CHECK', () => {
    expect(schema).toContain("status = 'loaned' AND holder_technician_id IS NOT NULL AND loaned_at IS NOT NULL");
    expect(schema).toContain("status <> 'loaned' AND holder_technician_id IS NULL AND loaned_at IS NULL");
  });

  it('añade gestión de servicio, revisiones y calibraciones', () => {
    expect(schema).toContain('service_status');
    expect(schema).toContain('next_review_date');
    expect(schema).toContain('next_calibration_date');
    expect(schema).toContain('max_loan_days');
    expect(schema).toContain('idx_maintenance_status_due');
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
