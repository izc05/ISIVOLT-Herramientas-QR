import { loadAppData } from '../storage';
import { saveRemoteAppData } from './capture';
import { mergeRemoteSyncEvents } from './merge';
import {
  readSyncConflicts,
  readSyncOutbox,
  removeSyncItems,
  writeSyncConflicts,
} from './outbox';
import { refreshCentralSyncState } from './state';
import type { RemoteSyncEvent, SyncConflict } from './types';

export type ConflictDecision = 'keep-local' | 'accept-server';

export const relatedConflicts = (
  conflicts: SyncConflict[],
  conflict: SyncConflict,
): SyncConflict[] => conflicts
  .filter((item) => item.localItemId === conflict.localItemId)
  .sort((left, right) => left.remoteEventId - right.remoteEventId);

export const latestRelatedConflict = (
  conflicts: SyncConflict[],
  conflict: SyncConflict,
): SyncConflict => relatedConflicts(conflicts, conflict).at(-1) ?? conflict;

export const canAcceptServerConflict = (conflict: SyncConflict): boolean => conflict.entity !== 'movements';

export const conflictToRemoteEvent = (conflict: SyncConflict): RemoteSyncEvent => ({
  id: conflict.remoteEventId,
  workspace_id: conflict.workspaceId,
  entity: conflict.entity,
  entity_id: conflict.entityId,
  action: conflict.remoteAction ?? 'update',
  payload: conflict.remotePayload,
  actor_user_id: null,
  occurred_at: conflict.remoteOccurredAt ?? conflict.detectedAt,
});

const announceResolution = () => {
  refreshCentralSyncState();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('isivolt:central-sync-conflicts'));
    window.dispatchEvent(new CustomEvent('isivolt:central-sync-request'));
  }
};

export const resolveSyncConflict = (
  conflictId: string,
  decision: ConflictDecision,
): void => {
  const conflicts = readSyncConflicts();
  const conflict = conflicts.find((item) => item.id === conflictId);
  if (!conflict) throw new Error('El conflicto ya no existe o fue resuelto en otra sesión.');

  const group = relatedConflicts(conflicts, conflict);
  const groupIds = new Set(group.map((item) => item.id));
  const remainingConflicts = conflicts.filter((item) => !groupIds.has(item.id));

  if (decision === 'keep-local') {
    writeSyncConflicts(remainingConflicts);
    announceResolution();
    return;
  }

  const latest = latestRelatedConflict(conflicts, conflict);
  if (!canAcceptServerConflict(latest)) {
    throw new Error('Los movimientos son inmutables. Resuelve la diferencia mediante una rectificación, no sobrescribiendo el movimiento.');
  }

  removeSyncItems([latest.localItemId]);
  const result = mergeRemoteSyncEvents(
    loadAppData(),
    [conflictToRemoteEvent(latest)],
    readSyncOutbox(),
    remainingConflicts,
  );
  saveRemoteAppData(result.data);
  writeSyncConflicts(result.conflicts);
  announceResolution();
};
