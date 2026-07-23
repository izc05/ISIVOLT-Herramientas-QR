import { describe, expect, it } from 'vitest';
import type { AppData, Movement, Tool } from '../../domain/types';
import {
  buildAppDataSyncItems,
  enqueueSyncItems,
  getReadySyncItems,
  markSyncItemFailed,
  readSyncOutbox,
  type StorageLike,
} from './outbox';
import type { SyncQueueItem } from './types';

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const tool = (overrides: Partial<Tool> = {}): Tool => ({
  id: 'tool-1',
  code: 'HER-001',
  qrCode: 'ISIVOLT:TOOL:HER-001',
  name: 'Taladro',
  category: 'Eléctrica',
  location: 'Almacén',
  status: 'available',
  active: true,
  createdAt: '2026-07-23T08:00:00.000Z',
  updatedAt: '2026-07-23T08:00:00.000Z',
  ...overrides,
});

const movement = (overrides: Partial<Movement> = {}): Movement => ({
  id: 'movement-1',
  operationId: 'operation-1',
  type: 'delivery',
  toolId: 'tool-1',
  technicianId: 'technician-1',
  operatorName: 'Almacén',
  occurredAt: '2026-07-23T08:05:00.000Z',
  previousStatus: 'available',
  nextStatus: 'loaned',
  ...overrides,
});

const appData = (tools: Tool[], movements: Movement[] = []): AppData => ({
  schemaVersion: 1,
  tools,
  technicians: [],
  movements,
  accessories: [],
  maintenanceRecords: [],
});

const queueItem = (overrides: Partial<SyncQueueItem> = {}): SyncQueueItem => ({
  id: 'queue-1',
  workspaceId: 'workspace-1',
  entity: 'tools',
  entityId: 'tool-1',
  action: 'upsert',
  payload: { id: 'tool-1', name: 'Taladro' },
  createdAt: '2026-07-23T08:00:00.000Z',
  attempts: 0,
  ...overrides,
});

describe('cola offline de sincronización', () => {
  it('consolida cambios sucesivos de una herramienta', () => {
    const storage = new MemoryStorage();
    enqueueSyncItems([queueItem()], storage);
    enqueueSyncItems([
      queueItem({
        id: 'queue-2',
        payload: { id: 'tool-1', name: 'Taladro actualizado' },
      }),
    ], storage);

    const items = readSyncOutbox(storage);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'queue-1',
      payload: { id: 'tool-1', name: 'Taladro actualizado' },
      attempts: 0,
    });
  });

  it('no duplica un movimiento ya encolado', () => {
    const storage = new MemoryStorage();
    const first = queueItem({
      entity: 'movements',
      entityId: 'movement-1',
      action: 'insert',
      operationId: 'operation-1',
    });
    enqueueSyncItems([first], storage);
    enqueueSyncItems([{ ...first, id: 'queue-2' }], storage);

    expect(readSyncOutbox(storage)).toEqual([first]);
  });

  it('genera una sola operación transaccional para préstamo y estado de herramienta', () => {
    const previous = appData([tool()]);
    const next = appData(
      [tool({
        status: 'loaned',
        holderTechnicianId: 'technician-1',
        loanedAt: '2026-07-23T08:05:00.000Z',
        updatedAt: '2026-07-23T08:05:00.000Z',
      })],
      [movement()],
    );

    const items = buildAppDataSyncItems(
      previous,
      next,
      'workspace-1',
      '2026-07-23T08:11:00.000Z',
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      entity: 'movements',
      entityId: 'movement-1',
      payload: {
        toolId: 'tool-1',
        toolState: {
          id: 'tool-1',
          status: 'loaned',
          holderTechnicianId: 'technician-1',
        },
      },
    });
    expect(items[0].payload.toolState).not.toHaveProperty('imageDataUrl');
  });

  it('mantiene una edición administrativa independiente sin movimiento', () => {
    const previous = appData([tool()]);
    const next = appData([tool({ location: 'Taller', updatedAt: '2026-07-23T08:10:00.000Z' })]);

    const items = buildAppDataSyncItems(previous, next, 'workspace-1');

    expect(items.map((item) => `${item.entity}:${item.entityId}`)).toEqual(['tools:tool-1']);
  });

  it('sustituye el cambio pendiente de herramienta por el movimiento que contiene su estado final', () => {
    const storage = new MemoryStorage();
    enqueueSyncItems([queueItem()], storage);
    enqueueSyncItems([
      queueItem({
        id: 'queue-movement',
        entity: 'movements',
        entityId: 'movement-1',
        action: 'insert',
        payload: { toolId: 'tool-1', toolState: { id: 'tool-1', status: 'loaned' } },
      }),
    ], storage);

    expect(readSyncOutbox(storage).map((item) => item.entity)).toEqual(['movements']);
  });

  it('aplica espera exponencial después de un fallo', () => {
    const storage = new MemoryStorage();
    enqueueSyncItems([queueItem()], storage);
    markSyncItemFailed(
      'queue-1',
      'Red no disponible',
      storage,
      new Date('2026-07-23T08:00:00.000Z'),
    );

    expect(getReadySyncItems(storage, new Date('2026-07-23T08:00:04.000Z'))).toHaveLength(0);
    expect(getReadySyncItems(storage, new Date('2026-07-23T08:00:05.000Z'))).toHaveLength(1);
    expect(readSyncOutbox(storage)[0]).toMatchObject({
      attempts: 1,
      lastError: 'Red no disponible',
      nextAttemptAt: '2026-07-23T08:00:05.000Z',
    });
  });
});
