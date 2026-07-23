import { useSyncExternalStore } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  LockKeyhole,
  RefreshCw,
} from 'lucide-react';
import { requestCentralSync } from '../services/centralSync/engine';
import {
  getCentralSyncState,
  subscribeCentralSyncState,
} from '../services/centralSync/state';
import type { CentralSyncMode } from '../services/centralSync/types';

const iconByMode: Record<CentralSyncMode, typeof Cloud> = {
  local: CloudOff,
  ready: Cloud,
  'auth-required': LockKeyhole,
  offline: CloudOff,
  syncing: RefreshCw,
  synced: CheckCircle2,
  conflict: AlertTriangle,
  error: AlertTriangle,
};

const labelByMode: Record<CentralSyncMode, string> = {
  local: 'Solo local',
  ready: 'Servidor preparado',
  'auth-required': 'Acceso pendiente',
  offline: 'Sin conexión',
  syncing: 'Sincronizando',
  synced: 'Sincronizado',
  conflict: 'Revisión necesaria',
  error: 'Error de sincronización',
};

export default function SyncStatusIndicator() {
  const state = useSyncExternalStore(
    subscribeCentralSyncState,
    getCentralSyncState,
    getCentralSyncState,
  );
  const Icon = iconByMode[state.mode];
  const canRetry = state.enabled && ['ready', 'offline', 'synced', 'error'].includes(state.mode);

  return (
    <aside
      className={`central-sync-indicator central-sync-${state.mode}`}
      aria-label={`Estado de sincronización: ${labelByMode[state.mode]}`}
      title={state.message}
    >
      <span className="central-sync-icon">
        <Icon className={state.mode === 'syncing' ? 'central-sync-spin' : undefined} size={18} />
      </span>
      <span className="central-sync-copy">
        <strong>{labelByMode[state.mode]}</strong>
        <small>{state.message}</small>
      </span>
      {(state.pendingCount > 0 || state.conflictCount > 0) && (
        <span className="central-sync-count" aria-label={`${state.pendingCount} pendientes y ${state.conflictCount} conflictos`}>
          {state.conflictCount > 0 ? state.conflictCount : state.pendingCount}
        </span>
      )}
      {canRetry && (
        <button type="button" onClick={requestCentralSync} aria-label="Sincronizar ahora">
          <RefreshCw size={16} />
        </button>
      )}
    </aside>
  );
}
