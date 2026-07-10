import { describe, expect, it } from 'vitest';
import type { Technician, Tool } from '../../domain/types';
import { rowToTechnician, rowToTool, stableLookupId, technicianToSqlValues, toolToSqlValues } from './mappers';

const tool: Tool = {
  id: 'tool-1',
  code: 'HER-001',
  qrCode: 'ISIVOLT:TOOL:HER-001',
  name: 'Multímetro',
  category: 'Medición eléctrica',
  brand: 'Fluke',
  location: 'Almacén principal',
  status: 'loaned',
  holderTechnicianId: 'tech-1',
  loanedAt: '2026-07-10T08:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-07-10T08:00:00.000Z',
};

const technician: Technician = {
  id: 'tech-1',
  code: 'TEC-001',
  name: 'Técnico Uno',
  specialty: 'Electricidad',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('SQLite mappers', () => {
  it('genera IDs estables para categorías y ubicaciones', () => {
    expect(stableLookupId('cat', 'Medición eléctrica')).toBe(stableLookupId('cat', '  medición ELÉCTRICA '));
    expect(stableLookupId('cat', 'Medición eléctrica')).not.toBe(stableLookupId('loc', 'Medición eléctrica'));
  });

  it('convierte herramientas a valores SQL con relaciones estables', () => {
    const values = toolToSqlValues(tool);
    expect(values[0]).toBe(tool.id);
    expect(values[4]).toBe(stableLookupId('cat', tool.category));
    expect(values[8]).toBe(stableLookupId('loc', tool.location));
    expect(values[9]).toBe('loaned');
    expect(values[10]).toBe('tech-1');
  });

  it('recupera una herramienta desde una fila SQL', () => {
    const recovered = rowToTool({
      id: tool.id,
      code: tool.code,
      qr_code: tool.qrCode,
      name: tool.name,
      category_name: tool.category,
      brand: tool.brand,
      location_name: tool.location,
      status: tool.status,
      holder_technician_id: tool.holderTechnicianId,
      loaned_at: tool.loanedAt,
      created_at: tool.createdAt,
      updated_at: tool.updatedAt,
    });
    expect(recovered).toMatchObject(tool);
  });

  it('convierte y recupera técnicos', () => {
    const values = technicianToSqlValues(technician);
    expect(values[0]).toBe('tech-1');
    expect(values[9]).toBe(1);

    const recovered = rowToTechnician({
      id: technician.id,
      code: technician.code,
      name: technician.name,
      specialty: technician.specialty,
      active: 1,
      created_at: technician.createdAt,
      updated_at: technician.updatedAt,
    });
    expect(recovered).toEqual(technician);
  });
});
