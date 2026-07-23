import type { AppData } from '../../domain/types';
import {
  remoteAccessoryToDomain,
  remoteMaintenanceToDomain,
  remoteMovementToDomain,
  remoteTechnicianToDomain,
  remoteToolToDomain,
} from './mappers';
import type {
  AppDataMergeResult,
  RemoteSyncEvent,
  SyncConflict,
  SyncQueueItem,
} from './types';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const replaceById = <T extends { id: string }>(items: T[], next: T): T[] => {
  const index = items.findIndex((item) => item.id === next.id);
  if (index < 0) return [...items, next];
  const copy = [...items];
  copy[index] = next;
  return copy;
};

const removeById = <T extends { id: string }>(items: T[], id: string): T[] =>
  items.filter((item) => item.id !== id);

const conflictId = (event: RemoteSyncEvent, localItem: SyncQueueItem) =>
  `${event.workspace_id}:${event.entity}:${event.entity_id}:${localItem.id}:${event.id}`;

export const mergeRemoteSyncEvents = (
  current: AppData,
  events: RemoteSyncEvent[],
  pendingItems: SyncQueueItem[],
  previousConflicts: SyncConflict[] = [],
): AppDataMergeResult<AppData> => {
  let data = clone(current);
  const conflicts = [...previousConflicts];
  let cursor = 0;

  const pendingByEntity = new Map(
    pendingItems.map((item) => [`${item.entity}:${item.entityId}`, item]),
  );
  const knownConflictIds = new Set(conflicts.map((item) => item.id));

  for (const event of [...events].sort((left, right) => left.id - right.id)) {
    cursor = Math.max(cursor, event.id);
    const localItem = pendingByEntity.get(`${event.entity}:${event.entity_id}`);

    if (localItem) {
      const id = conflictId(event, localItem);
      if (!knownConflictIds.has(id)) {
        conflicts.push({
          id,
          workspaceId: event.workspace_id,
          entity: event.entity,
          entityId: event.entity_id,
          localItemId: localItem.id,
          remoteEventId: event.id,
          remotePayload: clone(event.payload),
          detectedAt: new Date().toISOString(),
          reason: 'local-change-pending',
        });
        knownConflictIds.add(id);
      }
      continue;
    }

    if (event.entity === 'tools') {
      data.tools = event.action === 'delete'
        ? removeById(data.tools, event.entity_id)
        : replaceById(data.tools, remoteToolToDomain(event.payload));
      continue;
    }

    if (event.entity === 'technicians') {
      data.technicians = event.action === 'delete'
        ? removeById(data.technicians, event.entity_id)
        : replaceById(data.technicians, remoteTechnicianToDomain(event.payload));
      continue;
    }

    if (event.entity === 'accessories') {
      const accessories = data.accessories ?? [];
      data.accessories = event.action === 'delete'
        ? removeById(accessories, event.entity_id)
        : replaceById(accessories, remoteAccessoryToDomain(event.payload));
      continue;
    }

    if (event.entity === 'maintenance_records') {
      const records = data.maintenanceRecords ?? [];
      data.maintenanceRecords = event.action === 'delete'
        ? removeById(records, event.entity_id)
        : replaceById(records, remoteMaintenanceToDomain(event.payload));
      continue;
    }

    if (event.entity === 'movements' && event.action !== 'delete') {
      data.movements = replaceById(data.movements, remoteMovementToDomain(event.payload));
    }
  }

  return { data, conflicts, cursor };
};
