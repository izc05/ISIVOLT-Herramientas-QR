import { describe, expect, it } from 'vitest';
import { applyMovementCommand, MovementRuleError } from '../domain/movementEngine';
import type { AppData } from '../domain/types';
import { enforceAppDataIntegrity } from '../services/dataIntegrity';

const initialData = (): AppData => ({
  schemaVersion: 1,
  technicians: [{
    id: 'tech-1',
    code: 'TEC-001',
    name: 'Técnico de prueba',
    specialty: 'Electricidad',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }],
  tools: [{
    id: 'tool-1',
    code: 'HER-001',
    qrCode: 'ISIVOLT:TOOL:HER-001',
    name: 'Comprobador',
    category: 'Medición',
    location: 'Almacén',
    status: 'available',
    serviceStatus: 'none',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }],
  movements: [],
  accessories: [{
    id: 'acc-1',
    toolId: 'tool-1',
    name: 'Puntas de prueba',
    required: true,
    active: true,
    condition: 'ok',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }],
  maintenanceRecords: [],
});

const ids = () => {
  let sequence = 0;
  return () => `mov-production-${++sequence}`;
};

describe('flujo candidato de producción', () => {
  it('completa entrega, devolución e incidencia conservando trazabilidad', () => {
    const idFactory = ids();
    const delivery = applyMovementCommand(initialData(), {
      mode: 'delivery',
      toolIds: ['tool-1'],
      technicianId: 'tech-1',
      operatorName: 'Responsable almacén',
      occurredAt: '2026-07-10T08:00:00.000Z',
    }, idFactory);

    expect(delivery.data.tools[0].status).toBe('loaned');
    expect(delivery.movements[0].operatorName).toBe('Responsable almacén');

    const returned = applyMovementCommand(delivery.data, {
      mode: 'return',
      toolIds: ['tool-1'],
      condition: 'ok',
      operatorName: 'Responsable almacén',
      occurredAt: '2026-07-10T12:00:00.000Z',
    }, idFactory);

    expect(returned.data.tools[0].status).toBe('available');
    expect(returned.data.movements).toHaveLength(2);

    const secondDelivery = applyMovementCommand(returned.data, {
      mode: 'delivery',
      toolIds: ['tool-1'],
      technicianId: 'tech-1',
      operatorName: 'Responsable almacén',
      occurredAt: '2026-07-11T08:00:00.000Z',
    }, idFactory);

    const incident = applyMovementCommand(secondDelivery.data, {
      mode: 'return',
      toolIds: ['tool-1'],
      condition: 'damaged',
      notes: 'Pantalla rota durante el uso.',
      operatorName: 'Responsable almacén',
      occurredAt: '2026-07-11T11:30:00.000Z',
    }, idFactory);

    expect(incident.data.tools[0].status).toBe('damaged');
    expect(incident.data.tools[0].serviceStatus).toBe('out_of_service');
    expect(incident.data.movements).toHaveLength(4);
    expect(incident.data.movements.map((movement) => movement.id).every(Boolean)).toBe(true);
  });

  it('rechaza incidencia sin observaciones', () => {
    const data = initialData();
    data.tools[0] = {
      ...data.tools[0],
      status: 'loaned',
      holderTechnicianId: 'tech-1',
      loanedAt: '2026-07-10T08:00:00.000Z',
    };
    expect(() => applyMovementCommand(data, {
      mode: 'return',
      toolIds: ['tool-1'],
      condition: 'damaged',
      operatorName: 'Almacén',
    })).toThrowError(MovementRuleError);
  });

  it('sanea una copia con códigos duplicados y movimientos huérfanos', () => {
    const data = initialData();
    data.tools.push({ ...data.tools[0], id: 'tool-duplicate', name: 'Duplicada' });
    data.movements.push({
      id: 'mov-orphan',
      type: 'adjustment',
      toolId: 'missing-tool',
      operatorName: 'Sistema',
      occurredAt: '2026-07-10T10:00:00.000Z',
      previousStatus: 'available',
      nextStatus: 'available',
    });

    const result = enforceAppDataIntegrity(data);
    expect(result.data.tools).toHaveLength(1);
    expect(result.data.movements).toHaveLength(0);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });
});
