import { seedData } from '../data/seed';
import type { AppData } from '../domain/types';

const STORAGE_KEY = 'isivolt-herramientas-qr:v1';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const isAppData = (value: unknown): value is AppData => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppData>;
  return (
    candidate.schemaVersion === 1 &&
    Array.isArray(candidate.tools) &&
    Array.isArray(candidate.technicians) &&
    Array.isArray(candidate.movements)
  );
};

export const loadAppData = (): AppData => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(seedData);
    const parsed: unknown = JSON.parse(raw);
    return isAppData(parsed) ? parsed : clone(seedData);
  } catch {
    return clone(seedData);
  }
};

export const saveAppData = (data: AppData): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const resetAppData = (): AppData => {
  const clean = clone(seedData);
  saveAppData(clean);
  return clean;
};
