import { seedData } from '../data/seed';
import type { AppData } from '../domain/types';
import {
  isNativeDatabaseEnabled,
  readNativeAppData,
  recordNativeStorageEvent,
  writeNativeAppData,
} from './nativeDatabase';

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

const notifyDataUpdated = (data: AppData) => {
  window.dispatchEvent(new CustomEvent<AppData>('isivolt:data-updated', { detail: clone(data) }));
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

export const hydrateAppDataFromNative = async (): Promise<void> => {
  if (!isNativeDatabaseEnabled()) return;

  try {
    const nativeData = await readNativeAppData();
    if (nativeData) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nativeData));
      await recordNativeStorageEvent('hydrate', 'Datos recuperados desde SQLite.');
      return;
    }

    const initialData = loadAppData();
    await writeNativeAppData(initialData);
    await recordNativeStorageEvent('initialize', 'Base de datos creada con el estado inicial.');
  } catch (error) {
    console.error('No se ha podido hidratar SQLite. Se mantiene el almacenamiento web.', error);
  }
};

export const saveAppData = (data: AppData): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  notifyDataUpdated(data);
  void writeNativeAppData(data).catch((error) => {
    console.error('No se ha podido guardar el estado en SQLite.', error);
  });
};

export const resetAppData = (): AppData => {
  const clean = clone(seedData);
  saveAppData(clean);
  void recordNativeStorageEvent('reset', 'Datos restaurados a la configuración inicial.');
  return clean;
};
