import { describe, expect, it } from 'vitest';
import {
  canAcceptServerConflict,
  conflictToRemoteEvent,
  latestRelatedConflict,
  relatedConflicts,
} from './conflictResolution';
import type { SyncConflict } from './types';

const conflict = (overrides: Partial<SyncConflict> = {}): SyncConflict => ({
  id: 'conflict-1',
  workspaceId: 'workspace-1',
  entity: 'tools',
  entityId: 'tool-1',
  localItemId: 'queue-1',
  remoteEventId: 10,
  remoteAction: 'update',
  remotePayload: { id: 'tool-1', name: 'Remoto' },
  remoteOccurredAt: '2026-07-23T09:00:00.000Z',
  detectedAt: '2026-07-23T09:01:00.000Z',
  reason: 'local-change-pending',
  ...overrides,
});

describe('resolución de conflictos de sincronización', () => {
  it('agrupa todos los eventos remotos asociados al mismo cambio local', () => {
    const conflicts = [
      conflict(),
      conflict({ id: 'conflict-2', remoteEventId: 12 }),
      conflict({ id: 'other', localItemId: 'queue-2', remoteEventId: 20 }),
    ];

    expect(relatedConflicts(conflicts, conflicts[0]).map((item) => item.id))
      .toEqual(['conflict-1', 'conflict-2']);
    expect(latestRelatedConflict(conflicts, conflicts[0]).remoteEventId).toBe(12);
  });

  it('reconstruye el evento remoto incluyendo borrados', () => {
    const event = conflictToRemoteEvent(conflict({
      remoteAction: 'delete',
      remotePayload: { id: 'tool-1' },
    }));

    expect(event).toMatchObject({
      id: 10,
      workspace_id: 'workspace-1',
      entity: 'tools',
      entity_id: 'tool-1',
      action: 'delete',
      occurred_at: '2026-07-23T09:00:00.000Z',
    });
  });

  it('mantiene los movimientos fuera de la sobrescritura servidor', () => {
    expect(canAcceptServerConflict(conflict({ entity: 'movements' }))).toBe(false);
    expect(canAcceptServerConflict(conflict({ entity: 'tools' }))).toBe(true);
  });

  it('mantiene compatibilidad con conflictos antiguos sin acción guardada', () => {
    const event = conflictToRemoteEvent(conflict({
      remoteAction: undefined,
      remoteOccurredAt: undefined,
    }));

    expect(event.action).toBe('update');
    expect(event.occurred_at).toBe('2026-07-23T09:01:00.000Z');
  });
});
