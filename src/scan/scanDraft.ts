import { getCloudProfile } from '../cloud/config';
import type { BatchOperation, IdentificationMethod, OperatorMode, ScanMethod } from '../types';

export type ScanDraft = {
  version: 1;
  operation: BatchOperation;
  operatorMode: OperatorMode;
  technicianId: string;
  identificationMethod: IdentificationMethod;
  toolIds: string[];
  scanMethods: Array<Exclude<ScanMethod, 'mixed'>>;
  startedAt: string;
  savedAt: string;
};

const PREFIX = 'isivoltpro:scan-draft:v1';

function scopeKey(): string {
  const profile = getCloudProfile();
  if (!profile) return 'local-admin';
  return `${profile.workspace}:${profile.id}`;
}

function storageKey(): string {
  return `${PREFIX}:${scopeKey()}`;
}

export function loadScanDraft(): ScanDraft | null {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ScanDraft>;
    if (
      value.version !== 1
      || (value.operation !== 'loan' && value.operation !== 'return')
      || (value.operatorMode !== 'administrator' && value.operatorMode !== 'self-service')
      || typeof value.technicianId !== 'string'
      || !Array.isArray(value.toolIds)
      || !Array.isArray(value.scanMethods)
      || typeof value.startedAt !== 'string'
      || typeof value.savedAt !== 'string'
    ) return null;
    return value as ScanDraft;
  } catch {
    return null;
  }
}

export function saveScanDraft(draft: Omit<ScanDraft, 'version' | 'savedAt'>): void {
  const value: ScanDraft = {
    ...draft,
    version: 1,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(storageKey(), JSON.stringify(value));
}

export function clearScanDraft(): void {
  localStorage.removeItem(storageKey());
}

export function scanDraftIsMeaningful(draft: Pick<ScanDraft, 'technicianId' | 'toolIds'>): boolean {
  return Boolean(draft.technicianId || draft.toolIds.length > 0);
}
