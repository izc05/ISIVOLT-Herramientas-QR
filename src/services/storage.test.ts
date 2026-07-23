import { describe, expect, it } from 'vitest';
import type { AppData, Movement } from '../domain/types';
import { mergeMovementMetadata } from './storage';

const movement = (overrides: Partial<Movement> = {}): Movement => ({
  id: 'mov-1',
  operationId: 'op-1',
  type: 'delivery',
  toolId: 'tool-1',
  technicianId: 'tech-1',
  operatorName: 'Responsable almacén',
  occurredAt: '2026-07-20T08:00:00.000Z',
  previousStatus: 'available',
  nextStatus: 'loaned',
  ...overrides,
});

const appData = (movements: Movement[]): AppData => ({
  schemaVersion: 1,
  technicians: [],
  tools: [],
  movements,
  accessories: [],
  maintenanceRecords: [],
});

describe('recuperación de metadatos de movimientos', () => {
  it('conserva deviceId y syncStatus ya confirmados por SQLite', () => {
    const local = appData([movement()]);
    const native = appData([movement({ deviceId: 'device-android-1', syncStatus: 'synced' })]);

    const recovered = mergeMovementMetadata(local, native);

    expect(recovered.movements[0]).toMatchObject({
      id: 'mov-1',
      operationId: 'op-1',
      deviceId: 'device-android-1',
      syncStatus: 'synced',
    });
  });

  it('no sobrescribe metadatos locales ya definidos', () => {
    const local = appData([movement({ deviceId: 'device-local', syncStatus: 'pending' })]);
    const native = appData([movement({ deviceId: 'device-native', syncStatus: 'synced' })]);

    const recovered = mergeMovementMetadata(local, native);

    expect(recovered.movements[0]).toMatchObject({
      deviceId: 'device-local',
      syncStatus: 'pending',
    });
  });

  it('mantiene sin cambios los movimientos que todavía no existen en SQLite', () => {
    const pending = movement({ id: 'mov-pending', operationId: 'op-pending' });
    const recovered = mergeMovementMetadata(appData([pending]), appData([]));

    expect(recovered.movements[0]).toEqual(pending);
  });
});
