import { beforeEach, describe, expect, it } from 'vitest';
import type { AppData, Movement } from '../../domain/types';
import type { StationPresenceConfig } from './config';
import {
  attachStationProofToNewMovements,
  StationPresenceRequiredError,
} from './enforce';
import {
  registerStationPass,
  resetStationPassRegistryForTests,
} from './passRegistry';

const previous = (): AppData => ({
  schemaVersion: 1,
  tools: [],
  technicians: [],
  movements: [],
  accessories: [],
  maintenanceRecords: [],
});

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

const enabledConfig: Extract<StationPresenceConfig, { enabled: true }> = {
  enabled: true,
  stationId: 'ALMACEN-PTS',
  publicKey: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
  clockSkewSeconds: 10,
  maxTokenLifetimeSeconds: 90,
};

describe('prueba presencial al guardar movimientos', () => {
  beforeEach(() => resetStationPassRegistryForTests());

  it('mantiene el funcionamiento actual cuando el modo está desactivado', () => {
    const next = { ...previous(), movements: [movement()] };
    expect(attachStationProofToNewMovements(previous(), next, {
      enabled: false,
      reason: 'disabled',
    })).toEqual(next);
  });

  it('rechaza una operación física sin pase del punto de almacén', () => {
    const next = { ...previous(), movements: [movement()] };
    expect(() => attachStationProofToNewMovements(previous(), next, enabledConfig))
      .toThrowError(StationPresenceRequiredError);
  });

  it('adjunta una única prueba a todo el lote de la misma operación', () => {
    registerStationPass('operation-1', {
      v: 1,
      stationId: 'ALMACEN-PTS',
      nonce: 'nonce-operacion-1',
      issuedAt: '2026-07-23T12:00:00.000Z',
      expiresAt: '2099-07-23T12:01:00.000Z',
      verifiedAt: '2026-07-23T12:00:10.000Z',
      token: 'token-firmado',
    });
    const next = {
      ...previous(),
      movements: [
        movement(),
        movement({ id: 'movement-2', toolId: 'tool-2' }),
      ],
    };

    const result = attachStationProofToNewMovements(previous(), next, enabledConfig);
    expect(result.movements).toHaveLength(2);
    result.movements.forEach((item) => {
      expect(item).toMatchObject({
        stationId: 'ALMACEN-PTS',
        stationNonce: 'nonce-operacion-1',
        stationVerifiedAt: '2026-07-23T12:00:10.000Z',
      });
    });
  });

  it('no exige presencia para un ajuste administrativo', () => {
    const next = {
      ...previous(),
      movements: [movement({ type: 'adjustment', technicianId: undefined })],
    };
    expect(() => attachStationProofToNewMovements(previous(), next, enabledConfig)).not.toThrow();
  });

  it('falla de forma segura si el modo está solicitado pero mal configurado', () => {
    const next = { ...previous(), movements: [movement()] };
    expect(() => attachStationProofToNewMovements(previous(), next, {
      enabled: false,
      reason: 'missing-public-key',
      stationId: 'ALMACEN-PTS',
    })).toThrow('falta la clave pública');
  });
});
