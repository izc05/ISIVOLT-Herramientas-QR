import type PocketBase from 'pocketbase';
import { loadAppData } from '../storage';
import { saveRemoteAppData } from './capture';
import { getCentralSyncClient } from './client';
import { getCentralSyncConfig } from './config';
import { mergeRemoteSyncEvents } from './merge';
import {
  getReadySyncItems,
  markSyncItemFailed,
  readSyncConflicts,
  readSyncCursor,
  readSyncOutbox,
  removeSyncItems,
  writeSyncConflicts,
  writeSyncCursor,
} from './outbox';
import { refreshCentralSyncState, setCentralSyncState } from './state';
import type { RemoteSyncEvent, SyncQueueItem } from './types';

let syncPromise: Promise<void> | null = null;
let stopAutomaticSync: (() => void) | null = null;

const errorMessage = (error: unknown) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'No se ha podido completar la sincronización con el mini PC.';
};

const uploadItem = async (
  client: PocketBase,
  item: SyncQueueItem,
) => {
  if (item.entity === 'movements') {
    await client.send('/api/isivolt/movement', {
      method: 'POST',
      body: {
        workspaceId: item.workspaceId,
        payload: item.payload,
      },
    });
    return;
  }

  await client.send('/api/isivolt/entity', {
    method: 'POST',
    body: {
      workspaceId: item.workspaceId,
      entity: item.entity,
      entityId: item.entityId,
      action: item.action === 'delete' ? 'delete' : 'upsert',
      payload: item.payload,
    },
  });
};

const uploadPendingItems = async (client: PocketBase) => {
  for (const item of getReadySyncItems()) {
    try {
      await uploadItem(client, item);
      removeSyncItems([item.id]);
    } catch (error) {
      markSyncItemFailed(item.id, errorMessage(error));
      throw error;
    }
  }
};

type PocketBaseSyncResponse = {
  events?: RemoteSyncEvent[];
  cursor?: number;
  hasMore?: boolean;
};

const downloadRemoteEvents = async (
  client: PocketBase,
  workspaceId: string,
) => {
  let cursor = readSyncCursor();
  let keepLoading = true;

  while (keepLoading) {
    const response = await client.send<PocketBaseSyncResponse>('/api/isivolt/sync', {
      method: 'GET',
      query: {
        workspace: workspaceId,
        cursor,
      },
    });
    const events = Array.isArray(response.events) ? response.events : [];
    if (events.length === 0) break;

    const result = mergeRemoteSyncEvents(
      loadAppData(),
      events,
      readSyncOutbox(),
      readSyncConflicts(),
    );

    saveRemoteAppData(result.data);
    writeSyncConflicts(result.conflicts);
    cursor = Math.max(cursor, result.cursor, Number(response.cursor ?? 0));
    writeSyncCursor(cursor);
    keepLoading = response.hasMore === true || events.length === 500;
  }
};

const performCentralSync = async (): Promise<void> => {
  const config = getCentralSyncConfig();
  if (!config.enabled || !config.workspaceId) {
    refreshCentralSyncState();
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setCentralSyncState({
      mode: 'offline',
      enabled: true,
      message: 'Sin conexión · los cambios permanecen protegidos en este dispositivo',
    });
    return;
  }

  const client = getCentralSyncClient();
  if (!client) {
    refreshCentralSyncState();
    return;
  }

  const userId = client.authStore.record?.id;
  if (!client.authStore.isValid || !userId) {
    setCentralSyncState({
      mode: 'auth-required',
      enabled: true,
      message: 'Mini PC preparado · inicia sesión para sincronizar',
    });
    return;
  }

  setCentralSyncState({
    mode: 'syncing',
    enabled: true,
    message: 'Sincronizando con el servidor local…',
  });

  await uploadPendingItems(client);
  await downloadRemoteEvents(client, config.workspaceId);

  const conflicts = readSyncConflicts();
  const pending = readSyncOutbox();
  const now = new Date().toISOString();
  setCentralSyncState({
    mode: conflicts.length > 0 ? 'conflict' : 'synced',
    enabled: true,
    pendingCount: pending.length,
    conflictCount: conflicts.length,
    lastSyncAt: now,
    message: conflicts.length > 0
      ? `${conflicts.length} conflicto${conflicts.length === 1 ? '' : 's'} requiere${conflicts.length === 1 ? '' : 'n'} revisión`
      : pending.length > 0
        ? `${pending.length} cambio${pending.length === 1 ? '' : 's'} esperando reintento`
        : 'Datos sincronizados con el mini PC',
  });
};

export const flushCentralSync = (): Promise<void> => {
  if (syncPromise) return syncPromise;
  syncPromise = performCentralSync()
    .catch((error) => {
      setCentralSyncState({
        mode: 'error',
        enabled: getCentralSyncConfig().enabled,
        message: errorMessage(error),
      });
    })
    .finally(() => {
      syncPromise = null;
    });
  return syncPromise;
};

export const requestCentralSync = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('isivolt:central-sync-request'));
};

export const startAutomaticCentralSync = () => {
  stopAutomaticSync?.();
  refreshCentralSyncState();
  if (typeof window === 'undefined') return () => undefined;

  const run = () => { void flushCentralSync(); };
  const refresh = () => refreshCentralSyncState();
  const intervalId = window.setInterval(run, 30_000);
  const initialId = window.setTimeout(run, 800);

  window.addEventListener('online', run);
  window.addEventListener('offline', refresh);
  window.addEventListener('isivolt:central-sync-request', run);
  window.addEventListener('isivolt:central-sync-outbox', refresh);

  stopAutomaticSync = () => {
    window.clearInterval(intervalId);
    window.clearTimeout(initialId);
    window.removeEventListener('online', run);
    window.removeEventListener('offline', refresh);
    window.removeEventListener('isivolt:central-sync-request', run);
    window.removeEventListener('isivolt:central-sync-outbox', refresh);
    stopAutomaticSync = null;
  };

  return stopAutomaticSync;
};
