import type { AppData } from '../../domain/types';
import type {
  CentralSyncConfig,
  SyncConflict,
  SyncEntity,
  SyncQueueItem,
} from './types';

export const CENTRAL_SYNC_OUTBOX_KEY = 'isivolt:central-sync:outbox:v1';
export const CENTRAL_SYNC_CONFLICTS_KEY = 'isivolt:central-sync:conflicts:v1';
export const CENTRAL_SYNC_CURSOR_KEY = 'isivolt:central-sync:cursor:v1';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const browserStorage = (): StorageLike | null =>
  typeof window === 'undefined' ? null : window.localStorage;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const randomId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const safeArray = <T,>(raw: string | null): T[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
};

export const readSyncOutbox = (storage: StorageLike | null = browserStorage()): SyncQueueItem[] =>
  storage ? safeArray<SyncQueueItem>(storage.getItem(CENTRAL_SYNC_OUTBOX_KEY)) : [];

const writeSyncOutbox = (items: SyncQueueItem[], storage: StorageLike | null = browserStorage()) => {
  if (!storage) return;
  if (items.length === 0) {
    storage.removeItem(CENTRAL_SYNC_OUTBOX_KEY);
  } else {
    storage.setItem(CENTRAL_SYNC_OUTBOX_KEY, JSON.stringify(items));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('isivolt:central-sync-outbox', { detail: items.length }));
  }
};

export const enqueueSyncItems = (
  newItems: SyncQueueItem[],
  storage: StorageLike | null = browserStorage(),
): SyncQueueItem[] => {
  if (!storage || newItems.length === 0) return readSyncOutbox(storage);
  const current = readSyncOutbox(storage);

  for (const item of newItems) {
    const existingIndex = current.findIndex((candidate) =>
      candidate.workspaceId === item.workspaceId
      && candidate.entity === item.entity
      && candidate.entityId === item.entityId,
    );

    if (existingIndex >= 0) {
      if (item.entity === 'movements') continue;
      current[existingIndex] = {
        ...item,
        id: current[existingIndex].id,
        createdAt: current[existingIndex].createdAt,
        attempts: 0,
        nextAttemptAt: undefined,
        lastError: undefined,
      };
    } else {
      current.push(item);
    }
  }

  writeSyncOutbox(current, storage);
  return clone(current);
};

export const removeSyncItems = (
  itemIds: string[],
  storage: StorageLike | null = browserStorage(),
): SyncQueueItem[] => {
  const ids = new Set(itemIds);
  const remaining = readSyncOutbox(storage).filter((item) => !ids.has(item.id));
  writeSyncOutbox(remaining, storage);
  return clone(remaining);
};

export const markSyncItemFailed = (
  itemId: string,
  message: string,
  storage: StorageLike | null = browserStorage(),
  now = new Date(),
): SyncQueueItem[] => {
  const items = readSyncOutbox(storage).map((item) => {
    if (item.id !== itemId) return item;
    const attempts = item.attempts + 1;
    const delaySeconds = Math.min(900, 5 * (2 ** Math.min(attempts - 1, 8)));
    return {
      ...item,
      attempts,
      lastError: message,
      nextAttemptAt: new Date(now.getTime() + delaySeconds * 1_000).toISOString(),
    };
  });
  writeSyncOutbox(items, storage);
  return clone(items);
};

export const getReadySyncItems = (
  storage: StorageLike | null = browserStorage(),
  now = new Date(),
): SyncQueueItem[] => readSyncOutbox(storage).filter((item) =>
  !item.nextAttemptAt || new Date(item.nextAttemptAt).getTime() <= now.getTime(),
);

const comparable = (value: unknown): string => JSON.stringify(value);

const entityItems = <T extends { id: string }>(
  workspaceId: string,
  entity: Exclude<SyncEntity, 'movements'>,
  previous: T[] = [],
  next: T[] = [],
  createdAt: string,
): SyncQueueItem[] => {
  const previousById = new Map(previous.map((item) => [item.id, comparable(item)]));
  return next
    .filter((item) => previousById.get(item.id) !== comparable(item))
    .map((item) => ({
      id: randomId(),
      workspaceId,
      entity,
      entityId: item.id,
      action: 'upsert' as const,
      payload: clone(item) as unknown as Record<string, unknown>,
      createdAt,
      attempts: 0,
    }));
};

export const buildAppDataSyncItems = (
  previous: AppData | null,
  next: AppData,
  workspaceId: string,
  createdAt = new Date().toISOString(),
): SyncQueueItem[] => {
  const previousMovementIds = new Set(previous?.movements.map((item) => item.id) ?? []);
  const movements: SyncQueueItem[] = next.movements
    .filter((item) => !previousMovementIds.has(item.id))
    .map((item) => ({
      id: randomId(),
      workspaceId,
      entity: 'movements',
      entityId: item.id,
      action: 'insert',
      payload: clone(item) as unknown as Record<string, unknown>,
      operationId: item.operationId,
      createdAt,
      attempts: 0,
    }));

  return [
    ...entityItems(workspaceId, 'tools', previous?.tools, next.tools, createdAt),
    ...entityItems(workspaceId, 'technicians', previous?.technicians, next.technicians, createdAt),
    ...entityItems(workspaceId, 'accessories', previous?.accessories, next.accessories, createdAt),
    ...entityItems(
      workspaceId,
      'maintenance_records',
      previous?.maintenanceRecords,
      next.maintenanceRecords,
      createdAt,
    ),
    ...movements,
  ];
};

export const queueAppDataChanges = (
  previous: AppData | null,
  next: AppData,
  config: CentralSyncConfig,
  storage: StorageLike | null = browserStorage(),
): SyncQueueItem[] => {
  if (!config.enabled || !config.workspaceId) return readSyncOutbox(storage);
  return enqueueSyncItems(
    buildAppDataSyncItems(previous, next, config.workspaceId),
    storage,
  );
};

export const readSyncConflicts = (
  storage: StorageLike | null = browserStorage(),
): SyncConflict[] => storage
  ? safeArray<SyncConflict>(storage.getItem(CENTRAL_SYNC_CONFLICTS_KEY))
  : [];

export const writeSyncConflicts = (
  conflicts: SyncConflict[],
  storage: StorageLike | null = browserStorage(),
) => {
  if (!storage) return;
  if (conflicts.length === 0) storage.removeItem(CENTRAL_SYNC_CONFLICTS_KEY);
  else storage.setItem(CENTRAL_SYNC_CONFLICTS_KEY, JSON.stringify(conflicts));
};

export const readSyncCursor = (storage: StorageLike | null = browserStorage()): number => {
  if (!storage) return 0;
  const raw = Number(storage.getItem(CENTRAL_SYNC_CURSOR_KEY));
  return Number.isSafeInteger(raw) && raw >= 0 ? raw : 0;
};

export const writeSyncCursor = (
  cursor: number,
  storage: StorageLike | null = browserStorage(),
) => {
  if (!storage || !Number.isSafeInteger(cursor) || cursor < 0) return;
  storage.setItem(CENTRAL_SYNC_CURSOR_KEY, String(cursor));
};
