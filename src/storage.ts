import type { AppData } from './types';

const STORAGE_KEY = 'isivoltpro-herramientas-v2:data';

export const emptyData = (): AppData => ({
  schemaVersion: 2,
  tools: [],
  technicians: [],
  movements: [],
});

const isAppData = (value: unknown): value is AppData => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppData>;
  return candidate.schemaVersion === 2
    && Array.isArray(candidate.tools)
    && Array.isArray(candidate.technicians)
    && Array.isArray(candidate.movements);
};

export const loadData = (): AppData => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed: unknown = JSON.parse(raw);
    return isAppData(parsed) ? parsed : emptyData();
  } catch {
    return emptyData();
  }
};

export const saveData = (data: AppData): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const clearData = (): AppData => {
  const data = emptyData();
  saveData(data);
  return data;
};
