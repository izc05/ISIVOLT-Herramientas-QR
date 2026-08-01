import { describe, expect, it } from 'vitest';
import type { AppData, Tool } from '../../domain/types';
import { mergeRemoteSyncEvents } from './merge';
import type { RemoteSyncEvent, SyncQueueItem } from './types';

const tool = (overrides: Partial<Tool> = {}): Tool => ({
  id: 'tool-1',
  code: 'HER-001',
  qrCode: 'ISIVOLT:TOOL:HER-001',
  name: 'Taladro local',
  category: 'Eléctrica',
  location: 'Almacén',
  status: 'available',
  active: true,
  createdAt: '2026-07-23T08:00:00.000Z',
  updatedAt: '2026-07-23T08:00:00.000Z',
  ...overrides,
});

const appData = (): AppData => ({
  schemaVersion: 1,
  tools: [tool()],
  technicians: [],
  movements: [],
  accessories: [],
  maintenanceRecords: [],
});

const remoteToolEvent = (overrides: Partial<RemoteSyncEvent> = {}): RemoteSyncEvent => ({
  id: 12,
  workspace_id: 'workspace-1',
  entity: 'tools',
  entity_id: 'tool-1',
  action: 'update',
  actor_user_id: 'user-2',
  occurred_at: '2026-07-23T08:10:00.000Z',
  payload: {
    id: 'tool-1',
    code: 'HER-001',
    qr_code: 'ISIVOLT:TOOL:HER-001',
    name: 'Taladro remoto',
    category: 'Eléctrica',
    location: 'Taller',
    status: 'available',
    active: true,
    created_at: '2026-07-23T08:00:00.000Z',
    updated_at: '2026-07-23T08:10:00.000Z',
  },
  ...overrides,
});

const pendingTool = (): SyncQueueItem => ({
  id: 'queue-local-tool-1',
  workspaceId: 'workspace-1',
  entity: 'tools',
  entityId: 'tool-1',
  action: 'upsert',
  payload: { ...tool(), location: 'Quirófano' },
  createdAt: '2026-07-23T08:09:00.000Z',
  attempts: 0,
});

describe('fusión de eventos remotos', () => {
  it('aplica un cambio remoto cuando no existe modificación local pendiente', () => {
    const result = mergeRemoteSyncEvents(appData(), [remoteToolEvent()], []);

    expect(result.cursor).toBe(12);
    expect(result.conflicts).toHaveLength(0);
    expect(result.data.tools[0]).toMatchObject({
      id: 'tool-1',
      name: 'Taladro remoto',
      location: 'Taller',
      updatedAt: '2026-07-23T08:10:00.000Z',
    });
  });

  it('mantiene la copia local y registra conflicto cuando hay un cambio pendiente', () => {
    const result = mergeRemoteSyncEvents(
      appData(),
      [remoteToolEvent()],
      [pendingTool()],
    );

    expect(result.cursor).toBe(12);
    expect(result.data.tools[0]).toMatchObject({
      name: 'Taladro local',
      location: 'Almacén',
    });
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      workspaceId: 'workspace-1',
      entity: 'tools',
      entityId: 'tool-1',
      localItemId: 'queue-local-tool-1',
      remoteEventId: 12,
      reason: 'local-change-pending',
    });
  });

  it('no duplica el mismo conflicto al procesar de nuevo el evento', () => {
    const first = mergeRemoteSyncEvents(appData(), [remoteToolEvent()], [pendingTool()]);
    const second = mergeRemoteSyncEvents(
      first.data,
      [remoteToolEvent()],
      [pendingTool()],
      first.conflicts,
    );

    expect(second.conflicts).toHaveLength(1);
  });
});
