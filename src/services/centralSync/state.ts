import { getCentralSyncConfig } from './config';
import { readSyncConflicts, readSyncOutbox } from './outbox';
import type { CentralSyncState } from './types';

const listeners = new Set<() => void>();

const initialState = (): CentralSyncState => {
  const config = getCentralSyncConfig();
  const pendingCount = readSyncOutbox().length;
  const conflictCount = readSyncConflicts().length;

  if (!config.enabled) {
    return {
      mode: 'local',
      enabled: false,
      pendingCount,
      conflictCount,
      message: 'Solo local · servidor central sin configurar',
    };
  }

  return {
    mode: conflictCount > 0 ? 'conflict' : 'ready',
    enabled: true,
    pendingCount,
    conflictCount,
    message: conflictCount > 0
      ? `${conflictCount} conflicto${conflictCount === 1 ? '' : 's'} pendiente${conflictCount === 1 ? '' : 's'}`
      : pendingCount > 0
        ? `${pendingCount} cambio${pendingCount === 1 ? '' : 's'} pendiente${pendingCount === 1 ? '' : 's'}`
        : 'Preparado para sincronizar',
  };
};

let state = initialState();

export const getCentralSyncState = (): CentralSyncState => state;

export const subscribeCentralSyncState = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setCentralSyncState = (patch: Partial<CentralSyncState>) => {
  state = {
    ...state,
    ...patch,
    pendingCount: patch.pendingCount ?? readSyncOutbox().length,
    conflictCount: patch.conflictCount ?? readSyncConflicts().length,
  };
  listeners.forEach((listener) => listener());
};

export const refreshCentralSyncState = () => {
  const next = initialState();
  state = {
    ...next,
    lastSyncAt: state.lastSyncAt,
  };
  listeners.forEach((listener) => listener());
};
