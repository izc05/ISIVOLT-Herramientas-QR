import { getCloudProfile, type CloudProfile } from './cloud/config';
import type { AppData, Technician } from './types';

const LOCAL_STORAGE_KEY = 'isivoltpro-herramientas-v2:data';
const CLOUD_STORAGE_PREFIX = 'isivoltpro-herramientas-v2:data:cloud';
export const WORKSPACE_DATA_EVENT = 'isivoltpro-v2:data-changed';

const technicianQr = (technician: Pick<Technician, 'code' | 'qrPayload'>) => technician.qrPayload ?? `ISIVOLTPRO:TECH:${technician.code}`;

export const emptyData = (): AppData => ({
  schemaVersion: 2,
  tools: [],
  technicians: [],
  movements: [],
  batches: [],
});

const normalizeData = (value: unknown): AppData | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<AppData>;
  if (candidate.schemaVersion !== 2
    || !Array.isArray(candidate.tools)
    || !Array.isArray(candidate.technicians)
    || !Array.isArray(candidate.movements)) return null;

  return {
    schemaVersion: 2,
    tools: candidate.tools,
    technicians: candidate.technicians.map((technician) => ({
      ...technician,
      qrPayload: technicianQr(technician),
    })),
    movements: candidate.movements,
    batches: Array.isArray(candidate.batches) ? candidate.batches : [],
  };
};

const accountStorageKey = (profile: CloudProfile): string => [
  CLOUD_STORAGE_PREFIX,
  encodeURIComponent(profile.workspace),
  encodeURIComponent(profile.id),
].join(':');

export const activeStorageKey = (profile = getCloudProfile()): string => (
  profile ? accountStorageKey(profile) : LOCAL_STORAGE_KEY
);

const readKey = (key: string): AppData => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return emptyData();
    return normalizeData(JSON.parse(raw)) ?? emptyData();
  } catch {
    return emptyData();
  }
};

export const hasStoredData = (profile = getCloudProfile()): boolean => {
  try {
    const raw = window.localStorage.getItem(activeStorageKey(profile));
    if (!raw) return false;
    return normalizeData(JSON.parse(raw)) !== null;
  } catch {
    return false;
  }
};

export const hasMeaningfulData = (data: AppData): boolean => (
  data.tools.length > 0
  || data.technicians.length > 0
  || data.movements.length > 0
  || data.batches.length > 0
);

export const loadLocalData = (): AppData => readKey(LOCAL_STORAGE_KEY);

export const loadData = (): AppData => readKey(activeStorageKey());

export const loadDataForProfile = (profile: CloudProfile): AppData => readKey(accountStorageKey(profile));

export const saveData = (data: AppData): void => {
  const normalized = normalizeData(data) ?? emptyData();
  window.localStorage.setItem(activeStorageKey(), JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent<AppData>(WORKSPACE_DATA_EVENT, { detail: normalized }));
};

export const announceActiveData = (): AppData => {
  const data = loadData();
  window.dispatchEvent(new CustomEvent<AppData>(WORKSPACE_DATA_EVENT, { detail: data }));
  return data;
};

export const clearData = (): AppData => {
  const data = emptyData();
  saveData(data);
  return data;
};
