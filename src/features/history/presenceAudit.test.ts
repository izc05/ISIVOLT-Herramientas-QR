import { describe, expect, it } from 'vitest';
import type { Movement } from '../../domain/types';
import {
  getMovementPresenceState,
  matchesPresenceFilter,
  presenceLabel,
} from './presenceAudit';

const movement = (overrides: Partial<Movement> = {}): Movement => ({
  id: 'movement-1',
  operationId: 'operation-1',
  type: 'delivery',
  toolId: 'tool-1',
  technicianId: 'technician-1',
  operatorName: 'Técnico Uno',
  occurredAt: '2026-07-23T12:00:00.000Z',
  previousStatus: 'available',
  nextStatus: 'loaned',
  ...overrides,
});

describe('auditoría de presencia física', () => {
  it('reconoce una prueba presencial completa', () => {
    const item = movement({
      stationId: 'ALMACEN-PTS',
      stationNonce: 'nonce-1',
      stationVerifiedAt: '2026-07-23T12:00:10.000Z',
    });
    expect(getMovementPresenceState(item)).toBe('verified');
    expect(presenceLabel(item)).toBe('Presencia validada');
    expect(matchesPresenceFilter(item, 'verified')).toBe(true);
  });

  it('clasifica sin acusar los movimientos físicos antiguos sin prueba', () => {
    const item = movement();
    expect(getMovementPresenceState(item)).toBe('missing');
    expect(presenceLabel(item)).toBe('Sin evidencia presencial');
    expect(matchesPresenceFilter(item, 'without-proof')).toBe(true);
  });

  it('separa una evidencia incompleta de la ausencia total', () => {
    const item = movement({ stationId: 'ALMACEN-PTS' });
    expect(getMovementPresenceState(item)).toBe('partial');
    expect(presenceLabel(item)).toBe('Evidencia presencial incompleta');
    expect(matchesPresenceFilter(item, 'without-proof')).toBe(true);
  });

  it('no exige prueba presencial a un ajuste administrativo', () => {
    const item = movement({ type: 'adjustment', technicianId: undefined });
    expect(getMovementPresenceState(item)).toBe('not-applicable');
    expect(matchesPresenceFilter(item, 'not-applicable')).toBe(true);
  });
});
