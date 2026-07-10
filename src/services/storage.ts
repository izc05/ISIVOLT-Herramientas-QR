import { seedData } from '../data/seed';
import type { AppData } from '../domain/types';
import { enforceAppDataIntegrity, type IntegrityIssue } from './dataIntegrity';
import { recordAppError } from './errorLog';
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
    candidate.schemaVersion === 1
    && Array.isArray(candidate.tools)
    && Array.isArray(candidate.technicians)
    && Array.isArray(candidate.movements)
  );
};

const notifyDataUpdated = (data: AppData) => {
  window.dispatchEvent(new CustomEvent<AppData>('isivolt:data-updated', { detail: clone(data) }));
};

const notifyIntegrityIssues = (issues: IntegrityIssue[]) => {
  if (!issues.length) return;
  window.dispatchEvent(new CustomEvent<IntegrityIssue[]>('isivolt:integrity-warning', { detail: issues }));
  recordAppError('data-integrity', issues.map((issue) => issue.message).join(' | '));
};

const prepareData = (data: AppData): AppData => {
  const result = enforceAppDataIntegrity(data);
  notifyIntegrityIssues(result.issues);
  return result.data;
};

export const loadAppData = (): AppData => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(seedData);
    const parsed: unknown = JSON.parse(raw);
    if (!isAppData(parsed)) {
      recordAppError('storage.load', 'El almacenamiento local no contiene una estructura válida.');
      return clone(seedData);
    }
    return prepareData(parsed);
  } catch (error) {
    recordAppError('storage.load', error);
    return clone(seedData);
  }
};

export const hydrateAppDataFromNative = async (): Promise<void> => {
  if (!isNativeDatabaseEnabled()) return;

  try {
    const nativeData = await readNativeAppData();
    if (nativeData) {
      const clean = prepareData(nativeData);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      await recordNativeStorageEvent('hydrate', 'Datos recuperados desde SQLite y validados.');
      return;
    }

    const initialData = loadAppData();
    await writeNativeAppData(initialData);
    await recordNativeStorageEvent('initialize', 'Base de datos creada con el estado inicial.');
  } catch (error) {
    recordAppError('storage.hydrate', error);
    console.error('No se ha podido hidratar SQLite. Se mantiene el almacenamiento web.', error);
  }
};

export const saveAppData = (data: AppData): void => {
  const clean = prepareData(data);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    notifyDataUpdated(clean);
  } catch (error) {
    recordAppError('storage.local-save', error);
    throw error;
  }

  void writeNativeAppData(clean).catch((error) => {
    recordAppError('storage.sqlite-save', error);
    console.error('No se ha podido guardar el estado en SQLite.', error);
  });
};

export const resetAppData = (): AppData => {
  const current = loadAppData();
  const confirmed = window.confirm(
    'Esta acción sustituirá el inventario, los responsables y todos los movimientos por los datos de demostración. ¿Continuar?',
  );
  if (!confirmed) return current;

  const phrase = window.prompt('Para confirmar escribe exactamente: RESTAURAR');
  if (phrase !== 'RESTAURAR') {
    window.dispatchEvent(new CustomEvent('isivolt:reset-cancelled'));
    return current;
  }

  const clean = clone(seedData);
  saveAppData(clean);
  void recordNativeStorageEvent('reset', 'Datos restaurados a la configuración inicial con confirmación reforzada.');
  return clean;
};
