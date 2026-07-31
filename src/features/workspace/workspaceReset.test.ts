import { describe, expect, it } from 'vitest';
import { hospitalTechnicians, technicianSpecialties } from '../../data/technicians';
import type { AppData } from '../../domain/types';
import {
  createFreshWorkspace,
  hasOperationalData,
  isLegacyDemoWorkspace,
} from './workspaceReset';

const timestamp = '2026-07-31T06:00:00.000Z';

const legacyWorkspace = (): AppData => ({
  schemaVersion: 1,
  technicians: [{
    id: 'tech-antonio',
    code: 'TEC-001',
    name: 'Técnico de demostración',
    specialty: 'Electricidad',
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }],
  tools: [{
    id: 'tool-fluke-289',
    code: 'ELE-001',
    qrCode: 'ISIVOLT:TOOL:ELE-001',
    name: 'Multímetro demo',
    category: 'Medida eléctrica',
    location: 'Demo',
    status: 'loaned',
    holderTechnicianId: 'tech-antonio',
    createdAt: timestamp,
    updatedAt: timestamp,
  }],
  movements: [{
    id: 'mov-001',
    type: 'delivery',
    toolId: 'tool-fluke-289',
    technicianId: 'tech-antonio',
    operatorName: 'Demo',
    occurredAt: timestamp,
    previousStatus: 'available',
    nextStatus: 'loaned',
  }],
  accessories: [],
  maintenanceRecords: [],
});

describe('workspaceReset', () => {
  it('no precarga personas al iniciar RC57', () => {
    expect(hospitalTechnicians).toEqual([]);
    expect(technicianSpecialties.length).toBeGreaterThan(0);
  });

  it('reconoce únicamente los identificadores históricos de demostración', () => {
    expect(isLegacyDemoWorkspace(legacyWorkspace())).toBe(true);
  });

  it('protege un inventario real aunque conviva con registros demo', () => {
    const data = legacyWorkspace();
    data.tools.push({
      ...data.tools[0],
      id: 'tool-real-001',
      code: 'REAL-001',
      qrCode: 'ISIVOLT:TOOL:REAL-001',
      name: 'Herramienta real',
    });

    expect(isLegacyDemoWorkspace(data)).toBe(false);
  });

  it('protege técnicos y movimientos con identificadores no reconocidos', () => {
    const data = legacyWorkspace();
    data.technicians[0] = { ...data.technicians[0], id: 'tech-real-001' };
    data.movements[0] = { ...data.movements[0], id: 'mov-real-001' };

    expect(isLegacyDemoWorkspace(data)).toBe(false);
  });

  it('crea un espacio nuevo completamente vacío', () => {
    const fresh = createFreshWorkspace();

    expect(fresh).toEqual({
      schemaVersion: 1,
      technicians: [],
      tools: [],
      movements: [],
      accessories: [],
      maintenanceRecords: [],
    });
    expect(hasOperationalData(fresh)).toBe(false);
    expect(hasOperationalData(legacyWorkspace())).toBe(true);
  });
});
