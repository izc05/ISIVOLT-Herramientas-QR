export type SyncEntity =
  | 'tools'
  | 'technicians'
  | 'movements'
  | 'accessories'
  | 'maintenance_records';

export type SyncAction = 'upsert' | 'insert' | 'delete';

export type SyncQueueItem = {
  id: string;
  workspaceId: string;
  entity: SyncEntity;
  entityId: string;
  action: SyncAction;
  payload: Record<string, unknown>;
  operationId?: string;
  createdAt: string;
  attempts: number;
  nextAttemptAt?: string;
  lastError?: string;
};

export type RemoteSyncEvent = {
  id: number;
  workspace_id: string;
  entity: SyncEntity;
  entity_id: string;
  action: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  actor_user_id?: string | null;
  occurred_at: string;
};

export type SyncConflict = {
  id: string;
  workspaceId: string;
  entity: SyncEntity;
  entityId: string;
  localItemId: string;
  remoteEventId: number;
  remoteAction?: RemoteSyncEvent['action'];
  remotePayload: Record<string, unknown>;
  remoteOccurredAt?: string;
  detectedAt: string;
  reason: 'local-change-pending';
};

export type CentralSyncMode =
  | 'local'
  | 'ready'
  | 'auth-required'
  | 'offline'
  | 'syncing'
  | 'synced'
  | 'conflict'
  | 'error';

export type CentralSyncState = {
  mode: CentralSyncMode;
  enabled: boolean;
  pendingCount: number;
  conflictCount: number;
  lastSyncAt?: string;
  message: string;
};

export type CentralSyncConfig = {
  enabled: boolean;
  supabaseUrl?: string;
  publishableKey?: string;
  workspaceId?: string;
  reason?: 'missing-url' | 'missing-key' | 'missing-workspace';
};

export type AppDataMergeResult<T> = {
  data: T;
  conflicts: SyncConflict[];
  cursor: number;
};
