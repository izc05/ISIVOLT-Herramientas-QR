import { describe, expect, it } from 'vitest';
import type { AppData, Tool } from '../../domain/types';
import {
  applyToolLifecycleAction,
  listToolLifecycleActions,
  resolveToolLifecyclePresentation,
} from './toolLifecycle';

const tool = (overrides: Partial<Tool> = {}): Tool => ({
  id: 'tool-1',
  code: 'ELE-001',
  qrCode: 'ISIVOLT:TOOL:ELE-001',
  name: 'Multímetro de prueba',
  category: 'Medida eléctrica',
  location: 'Almacén',
  status: 'available',
  active: true,
  createdAt: '2026-07-23T08:00:00.000Z',
  updatedAt: '2026-07-23T08:00:00.000Z',
  ...overrides,
});

const data = (item: Tool): AppData => ({
  schemaVersion: 1,
  tools: [item],
  technicians: [],
  movements: [],
  accessories: [],
  maintenanceRecords: [],
});

describe('ciclo de vida de herramientas RC36', () => {
  it('presenta el bloqueo como estado independiente sin romper el estado persistido', () => {
    expect(resolveToolLifecyclePresentation(tool({ status: 'review', serviceStatus: 'out_of_service' }))).toEqual({
      key: 'blocked',
      label: 'Bloqueada',
      restricted: true,
    });
  });

  it('bloquea con motivo y genera movimiento y registro técnico', () => {
    const result = applyToolLifecycleAction(
      data(tool()),
      'tool-1',
      'block',
      'Falta comprobación de aislamiento',
      'Responsable almacén',
      '2026-07-23T10:00:00.000Z',
    );

    expect(result.tool).toMatchObject({
      status: 'review',
      serviceStatus: 'out_of_service',
      active: true,
      updatedAt: '2026-07-23T10:00:00.000Z',
    });
    expect(resolveToolLifecyclePresentation(result.tool).key).toBe('blocked');
    expect(result.movement).toMatchObject({
      type: 'adjustment',
      previousStatus: 'available',
      nextStatus: 'review',
      operatorName: 'Responsable almacén',
      syncStatus: 'pending',
    });
    expect(result.movement.notes).toContain('Falta comprobación de aislamiento');
    expect(result.maintenance).toMatchObject({
      type: 'status_change',
      status: 'completed',
      description: 'Falta comprobación de aislamiento',
    });
  });

  it('reactiva una herramienta bloqueada y la devuelve a disponible', () => {
    const blocked = tool({ status: 'review', serviceStatus: 'out_of_service' });
    const result = applyToolLifecycleAction(
      data(blocked),
      'tool-1',
      'reactivate',
      'Ensayo correcto y equipo apto',
      'Isi',
      '2026-07-23T11:00:00.000Z',
    );

    expect(result.tool).toMatchObject({ status: 'available', serviceStatus: 'none', active: true });
    expect(result.maintenance.resolution).toContain('reactivada');
  });

  it('no ofrece repetir el estado actual', () => {
    const damagedActions = listToolLifecycleActions(tool({ status: 'damaged', serviceStatus: 'out_of_service' }))
      .map((item) => item.action);
    const blockedActions = listToolLifecycleActions(tool({ status: 'review', serviceStatus: 'out_of_service' }))
      .map((item) => item.action);

    expect(damagedActions).not.toContain('damage');
    expect(blockedActions).not.toContain('block');
    expect(damagedActions).toContain('reactivate');
  });

  it('rechaza cambios sin motivo o mientras la herramienta está prestada', () => {
    expect(() => applyToolLifecycleAction(data(tool()), 'tool-1', 'review', '   ')).toThrow(/motivo/i);
    expect(() => applyToolLifecycleAction(
      data(tool({ status: 'loaned', holderTechnicianId: 'tech-1', loanedAt: '2026-07-23T09:00:00.000Z' })),
      'tool-1',
      'block',
      'Bloqueo administrativo',
    )).toThrow(/prestada/i);
  });
});
