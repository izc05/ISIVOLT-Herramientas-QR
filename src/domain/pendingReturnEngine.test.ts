import { describe, expect, it } from 'vitest';
import type { AppData } from './types';
import {
  getPendingReturnRequests,
  requestTechnicianReturn,
  reviewPendingReturn,
} from './pendingReturnEngine';

const data = (): AppData => ({
  schemaVersion: 1,
  technicians: [{
    id: 'tech-1',
    code: 'TEC-001',
    name: 'Técnico Uno',
    specialty: 'Electricidad',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }],
  tools: [{
    id: 'tool-1',
    code: 'HER-001',
    qrCode: 'ISIVOLT:TOOL:HER-001',
    name: 'Multímetro',
    category: 'Medición',
    location: 'Almacén',
    status: 'loaned',
    holderTechnicianId: 'tech-1',
    loanedAt: '2026-07-28T08:00:00.000Z',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-07-28T08:00:00.000Z',
  }],
  movements: [],
  accessories: [],
  maintenanceRecords: [],
});

describe('devoluciones pendientes', () => {
  it('mantiene la herramienta asociada al técnico hasta la validación', () => {
    const result = requestTechnicianReturn(data(), {
      operationId: 'op-return-request',
      toolId: 'tool-1',
      technicianId: 'tech-1',
      condition: 'ok',
      operatorName: 'Técnico Uno',
      occurredAt: '2026-07-29T08:00:00.000Z',
    });

    const tool = result.data.tools[0];
    expect(tool.status).toBe('review');
    expect(tool.holderTechnicianId).toBe('tech-1');
    expect(result.movement).toMatchObject({
      type: 'return',
      previousStatus: 'loaned',
      nextStatus: 'review',
      technicianId: 'tech-1',
    });
    expect(getPendingReturnRequests(result.data)).toHaveLength(1);
  });

  it('libera la herramienta cuando el administrador acepta la devolución', () => {
    const requested = requestTechnicianReturn(data(), {
      toolId: 'tool-1',
      technicianId: 'tech-1',
      condition: 'ok',
      operatorName: 'Técnico Uno',
    });
    const reviewed = reviewPendingReturn(requested.data, {
      toolId: 'tool-1',
      approve: true,
      condition: 'ok',
      operatorName: 'Administrador',
      occurredAt: '2026-07-29T09:00:00.000Z',
    });

    expect(reviewed.data.tools[0].status).toBe('available');
    expect(reviewed.data.tools[0].holderTechnicianId).toBeUndefined();
    expect(reviewed.movement).toMatchObject({
      type: 'adjustment',
      previousStatus: 'review',
      nextStatus: 'available',
      reversedMovementId: requested.movement.id,
    });
    expect(getPendingReturnRequests(reviewed.data)).toHaveLength(0);
  });

  it('restaura el préstamo si el administrador rechaza la devolución', () => {
    const requested = requestTechnicianReturn(data(), {
      toolId: 'tool-1',
      technicianId: 'tech-1',
      condition: 'ok',
      operatorName: 'Técnico Uno',
    });
    const rejected = reviewPendingReturn(requested.data, {
      toolId: 'tool-1',
      approve: false,
      notes: 'La herramienta no se ha entregado físicamente.',
      operatorName: 'Administrador',
    });

    expect(rejected.data.tools[0].status).toBe('loaned');
    expect(rejected.data.tools[0].holderTechnicianId).toBe('tech-1');
    expect(rejected.movement.nextStatus).toBe('loaned');
    expect(getPendingReturnRequests(rejected.data)).toHaveLength(0);
  });

  it('exige motivo para rechazar una devolución', () => {
    const requested = requestTechnicianReturn(data(), {
      toolId: 'tool-1',
      technicianId: 'tech-1',
      condition: 'ok',
      operatorName: 'Técnico Uno',
    });

    expect(() => reviewPendingReturn(requested.data, {
      toolId: 'tool-1',
      approve: false,
      operatorName: 'Administrador',
    })).toThrowError(/motivo/i);
  });
});
