import type { AppData, Technician } from './types';

const STORAGE_KEY = 'isivoltpro-herramientas-v2:data';
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

export const loadData = (): AppData => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    return normalizeData(JSON.parse(raw)) ?? emptyData();
  } catch {
    return emptyData();
  }
};

export const saveData = (data: AppData): void => {
  const normalized = normalizeData(data) ?? emptyData();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent<AppData>(WORKSPACE_DATA_EVENT, { detail: normalized }));
};

export const clearData = (): AppData => {
  const data = emptyData();
  saveData(data);
  return data;
};
