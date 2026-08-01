import type { AppData } from '../../domain/types';
import { runTrustedRemoteChange } from '../../security/operationAuthorization';
import { loadAppData, saveAppData } from '../storage';
import { getCentralSyncConfig } from './config';
import { queueAppDataChanges } from './outbox';

let previousData: AppData | null = null;
let captureSuppressed = false;
let stopCapture: (() => void) | null = null;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const saveRemoteAppData = (data: AppData) => {
  captureSuppressed = true;
  try {
    runTrustedRemoteChange(() => saveAppData(data));
    previousData = clone(data);
  } finally {
    captureSuppressed = false;
  }
};

export const startCentralSyncCapture = () => {
  stopCapture?.();
  if (typeof window === 'undefined') return () => undefined;
  previousData = loadAppData();

  const handleDataUpdated = (event: Event) => {
    const next = (event as CustomEvent<AppData>).detail;
    if (!next) return;

    if (captureSuppressed) {
      previousData = clone(next);
      return;
    }

    const config = getCentralSyncConfig();
    const beforeCount = config.enabled
      ? queueAppDataChanges(previousData, next, config).length
      : 0;
    previousData = clone(next);

    if (config.enabled && beforeCount > 0) {
      window.dispatchEvent(new CustomEvent('isivolt:central-sync-request'));
    }
  };

  window.addEventListener('isivolt:data-updated', handleDataUpdated);
  stopCapture = () => {
    window.removeEventListener('isivolt:data-updated', handleDataUpdated);
    stopCapture = null;
  };
  return stopCapture;
};
