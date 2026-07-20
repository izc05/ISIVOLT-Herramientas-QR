import { describe, expect, it } from 'vitest';
import type { AppData } from './types';
import { applyMovementCommand, MovementRuleError } from './movementEngine';

const baseData = (): AppData => ({
  schemaVersion: 1,
  technicians: [
    {
      id: 'tech-1',
      code: 'TEC-001',
      name: 'Técnico Activo',
      specialty: 'Electricidad',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'tech-2',
      code: 'TEC-002',
      name: 'Técnico Inactivo',
      specialty: 'Climatización',
      active: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'tech-3',
      code: 'TEC-003',
      name: 'Otro Técnico',
      specialty: 'Fontanería',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  tools: [
    {
      id: 'tool-1',
      code: 'HER-001',
      qrCode: 'ISIVOLT:TOOL:HER-001',
      name: 'Multímetro',
      category: 'Medición',
      location: 'Almacén',
      status: 'available',
      serviceStatus: 'none',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'tool-2',
      code: 'HER-002',
      qrCode: 'ISIVOLT:TOOL:HER-002',
      name: 'Taladro',
      category: 'Herramienta',
      location: 'Almacén',
      status: 'loaned',
      holderTechnicianId: 'tech-1',
      loanedAt: '2026-07-09T08:00:00.000Z',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-07-09T08:00:00.000Z',
    },
    {
      id: 'tool-3',
      code: 'HER-003',
      qrCode: 'ISIVOLT:TOOL:HER-003',
      name: 'Pinza amperimétrica',
      category: 'Medición',
      location: 'Almacén',
      status: 'loaned',
      holderTechnicianId: 'tech-1',
      loanedAt: '2026-07-09T08:10:00.000Z',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-07-09T08:10:00.000Z',
    },
  ],
  movements: [],
  accessories: [],
  maintenanceRecords: [],
});

const ids = () => {
  let index = 0;
  return () => `mov-test-${++index}`;
};

describe('applyMovementCommand', () => {
  it('entrega una herramienta disponible y conserva operationId', () => {
    const result = applyMovementCommand(
      baseData(),
      {
        operationId: 'op-test-1',
        mode: 'delivery',
        toolIds: ['tool-1'],
        technicianId: 'tech-1',
        operatorName: 'Almacén',
        occurredAt: '2026-07-10T10:00:00.000Z',
      },
      ids(),
    );

    const tool = result.data.tools.find((item) => item.id === 'tool-1');
    expect(tool?.status).toBe('loaned');
    expect(tool?.holderTechnicianId).toBe('tech-1');
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0]).toMatchObject({
      operationId: 'op-test-1',
      type: 'delivery',
      previousStatus: 'available',
      nextStatus: 'loaned',
    });
  });

  it('devuelve una herramienta y conserva el técnico en el movimiento', () => {
    const result = applyMovementCommand(
      baseData(),
      {
        mode: 'return',
        toolIds: ['tool-2'],
        condition: 'ok',
        operatorName: 'Almacén',
        occurredAt: '2026-07-10T11:00:00.000Z',
      },
      ids(),
    );

    const tool = result.data.tools.find((item) => item.id === 'tool-2');
    expect(tool?.status).toBe('available');
    expect(tool?.holderTechnicianId).toBeUndefined();
    expect(result.movements[0]).toMatchObject({ type: 'return', technicianId: 'tech-1' });
  });

  it('aplica una condición distinta a cada herramienta devuelta', () => {
    const result = applyMovementCommand(
      baseData(),
      {
        operationId: 'op-mixed-return',
        mode: 'return',
        toolIds: ['tool-2', 'tool-3'],
        technicianId: 'tech-1',
        returnConditions: {
          'tool-2': 'ok',
          'tool-3': 'damaged',
        },
        notes: 'La pinza presenta daños en la carcasa.',
        operatorName: 'Almacén',
        occurredAt: '2026-07-10T11:30:00.000Z',
      },
      ids(),
    );

    expect(result.data.tools.find((item) => item.id === 'tool-2')?.status).toBe('available');
    expect(result.data.tools.find((item) => item.id === 'tool-3')?.status).toBe('damaged');
    expect(result.movements).toEqual(expect.arrayContaining([
      expect.objectContaining({ toolId: 'tool-2', type: 'return', condition: 'ok' }),
      expect.objectContaining({ toolId: 'tool-3', type: 'incident', condition: 'damaged' }),
    ]));
  });

  it('exige una condición para cada herramienta de una devolución múltiple', () => {
    expect(() => applyMovementCommand(baseData(), {
      mode: 'return',
      toolIds: ['tool-2', 'tool-3'],
      returnConditions: { 'tool-2': 'ok' },
      operatorName: 'Almacén',
    })).toThrowError(/condición/i);
  });

  it('exige observaciones para una devolución averiada', () => {
    expect(() => applyMovementCommand(baseData(), {
      mode: 'return',
      toolIds: ['tool-2'],
      condition: 'damaged',
      operatorName: 'Almacén',
    })).toThrowError(MovementRuleError);
  });

  it('rechaza repetir una operación ya registrada', () => {
    const data = baseData();
    data.movements.push({
      id: 'mov-existing',
      operationId: 'op-existing',
      type: 'delivery',
      toolId: 'tool-1',
      technicianId: 'tech-1',
      operatorName: 'Almacén',
      occurredAt: '2026-07-10T09:00:00.000Z',
      previousStatus: 'available',
      nextStatus: 'loaned',
    });

    expect(() => applyMovementCommand(data, {
      operationId: 'op-existing',
      mode: 'delivery',
      toolIds: ['tool-1'],
      technicianId: 'tech-1',
      operatorName: 'Almacén',
    })).toThrowError(/ya fue registrada/i);
  });

  it('bloquea devolver herramientas de otro técnico en el mismo lote', () => {
    expect(() => applyMovementCommand(baseData(), {
      mode: 'return',
      toolIds: ['tool-2'],
      technicianId: 'tech-3',
      condition: 'ok',
      operatorName: 'Almacén',
    })).toThrowError(/técnico seleccionado/i);
  });

  it('bloquea una entrega a un técnico inactivo', () => {
    expect(() => applyMovementCommand(baseData(), {
      mode: 'delivery',
      toolIds: ['tool-1'],
      technicianId: 'tech-2',
      operatorName: 'Almacén',
    })).toThrowError(/inactivo/i);
  });

  it('bloquea entregar una herramienta que ya está prestada', () => {
    expect(() => applyMovementCommand(baseData(), {
      mode: 'delivery',
      toolIds: ['tool-2'],
      technicianId: 'tech-1',
      operatorName: 'Almacén',
    })).toThrowError(/no está disponible/i);
  });

  it('permite entregar una reserva al técnico previsto y limpia la reserva', () => {
    const data = baseData();
    data.tools[0] = {
      ...data.tools[0],
      serviceStatus: 'reserved',
      reservedTechnicianId: 'tech-1',
    };

    const result = applyMovementCommand(data, {
      mode: 'delivery',
      toolIds: ['tool-1'],
      technicianId: 'tech-1',
      operatorName: 'Almacén',
    });
    const tool = result.data.tools.find((item) => item.id === 'tool-1');
    expect(tool?.status).toBe('loaned');
    expect(tool?.serviceStatus).toBe('none');
    expect(tool?.reservedTechnicianId).toBeUndefined();
  });

  it('bloquea una reserva para un técnico diferente', () => {
    const data = baseData();
    data.tools[0] = {
      ...data.tools[0],
      serviceStatus: 'reserved',
      reservedTechnicianId: 'tech-1',
    };

    expect(() => applyMovementCommand(data, {
      mode: 'delivery',
      toolIds: ['tool-1'],
      technicianId: 'tech-3',
      operatorName: 'Almacén',
    })).toThrowError(/reservada/i);
  });

  it('bloquea herramientas en reparación aunque estén marcadas como disponibles', () => {
    const data = baseData();
    data.tools[0] = { ...data.tools[0], serviceStatus: 'repair' };

    expect(() => applyMovementCommand(data, {
      mode: 'delivery',
      toolIds: ['tool-1'],
      technicianId: 'tech-1',
      operatorName: 'Almacén',
    })).toThrowError(/bloqueada/i);
  });
});
