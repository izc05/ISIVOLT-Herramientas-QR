import type { SupabaseClient } from '@supabase/supabase-js';
import { loadAppData, saveAppData } from '../storage';
import { getCentralSyncClient } from './client';
import { getCentralSyncConfig } from './config';
import { mergeRemoteSyncEvents } from './merge';
import { toRemoteRow } from './mappers';
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

const duplicateKey = (error: { code?: string } | null) => error?.code === '23505';

const errorMessage = (error: unknown) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'No se ha podido completar la sincronización.';
};

const registerDevice = async (
  client: SupabaseClient,
  item: SyncQueueItem,
  userId: string,
) => {
  if (item.entity !== 'movements') return;
  const deviceId = typeof item.payload.deviceId === 'string' ? item.payload.deviceId : undefined;
  if (!deviceId) return;

  const { error } = await client.from('devices').upsert({
    workspace_id: item.workspaceId,
    id: deviceId,
    user_id: userId,
    name: typeof navigator === 'undefined' ? 'Dispositivo ISIVOLT' : navigator.userAgent,
    platform: typeof navigator === 'undefined' ? 'unknown' : navigator.platform,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,id' });

  if (error) throw error;
};

const uploadAccessoryChecks = async (
  client: SupabaseClient,
  item: SyncQueueItem,
) => {
  if (item.entity !== 'movements' || !Array.isArray(item.payload.accessoryChecks)) return;

  for (const check of item.payload.accessoryChecks) {
    if (!check || typeof check !== 'object') continue;
    const candidate = check as Record<string, unknown>;
    if (typeof candidate.accessoryId !== 'string' || typeof candidate.condition !== 'string') continue;

    const { error } = await client.from('movement_accessories').insert({
      workspace_id: item.workspaceId,
      movement_id: item.entityId,
      accessory_id: candidate.accessoryId,
      condition: candidate.condition,
      notes: candidate.notes ?? null,
    });

    if (error && !duplicateKey(error)) throw error;
  }
};

const uploadItem = async (
  client: SupabaseClient,
  item: SyncQueueItem,
  userId: string,
) => {
  await registerDevice(client, item, userId);
  const row = toRemoteRow(item.entity, item.workspaceId, item.payload, userId);

  if (item.entity === 'movements') {
    const { error } = await client.from('movements').insert(row);
    if (error && !duplicateKey(error)) throw error;
    await uploadAccessoryChecks(client, item);
    return;
  }

  const { error } = await client
    .from(item.entity)
    .upsert(row, { onConflict: 'workspace_id,id' });
  if (error) throw error;
};

const uploadPendingItems = async (
  client: SupabaseClient,
  userId: string,
) => {
  for (const item of getReadySyncItems()) {
    try {
      await uploadItem(client, item, userId);
      removeSyncItems([item.id]);
    } catch (error) {
      markSyncItemFailed(item.id, errorMessage(error));
      throw error;
    }
  }
};

const downloadRemoteEvents = async (
  client: SupabaseClient,
  workspaceId: string,
) => {
  let cursor = readSyncCursor();
  let keepLoading = true;

  while (keepLoading) {
    const { data, error } = await client
      .from('sync_events')
      .select('id,workspace_id,entity,entity_id,action,payload,actor_user_id,occurred_at')
      .eq('workspace_id', workspaceId)
      .gt('id', cursor)
      .order('id', { ascending: true })
      .limit(500);

    if (error) throw error;
    const events = (data ?? []) as RemoteSyncEvent[];
    if (events.length === 0) break;

    const result = mergeRemoteSyncEvents(
      loadAppData(),
      events,
      readSyncOutbox(),
      readSyncConflicts(),
    );

    saveAppData(result.data, { skipCentralSync: true });
    writeSyncConflicts(result.conflicts);
    cursor = Math.max(cursor, result.cursor);
    writeSyncCursor(cursor);
    keepLoading = events.length === 500;
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

  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  const userId = data.session?.user.id;
  if (!userId) {
    setCentralSyncState({
      mode: 'auth-required',
      enabled: true,
      message: 'Servidor preparado · inicia sesión para sincronizar',
    });
    return;
  }

  setCentralSyncState({
    mode: 'syncing',
    enabled: true,
    message: 'Sincronizando cambios pendientes…',
  });

  await uploadPendingItems(client, userId);
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
        : 'Datos sincronizados',
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
