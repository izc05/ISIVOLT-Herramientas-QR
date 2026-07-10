import { seedData } from '../data/seed';
import type { AppData } from '../domain/types';
import { enforceAppDataIntegrity, type IntegrityIssue } from './dataIntegrity';
import { getDeviceId } from './deviceIdentity';
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
    && (candidate.accessories === undefined || Array.isArray(candidate.accessories))
    && (candidate.maintenanceRecords === undefined || Array.isArray(candidate.maintenanceRecords))
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

const readLocalDataWithoutFallback = (): AppData | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isAppData(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const hasMissingIds = <T extends { id: string }>(previous: T[] = [], next: T[] = []) => {
  const nextIds = new Set(next.map((item) => item.id));
  return previous.some((item) => !nextIds.has(item.id));
};

const hasRemovedIds = (previous: AppData | null, next: AppData): boolean => {
  if (!previous) return false;
  return hasMissingIds(previous.tools, next.tools)
    || hasMissingIds(previous.technicians, next.technicians)
    || hasMissingIds(previous.movements, next.movements)
    || hasMissingIds(previous.accessories, next.accessories)
    || hasMissingIds(previous.maintenanceRecords, next.maintenanceRecords);
};

const attachDeviceToNewMovements = async (
  previous: AppData | null,
  next: AppData,
): Promise<AppData> => {
  if (!isNativeDatabaseEnabled()) return next;

  const known = new Set(previous?.movements.map((movement) => movement.id) ?? []);
  const hasNewWithoutDevice = next.movements.some(
    (movement) => !known.has(movement.id) && !movement.deviceId,
  );
  if (!hasNewWithoutDevice) return next;

  const deviceId = await getDeviceId();
  return {
    ...next,
    movements: next.movements.map((movement) =>
      !known.has(movement.id) && !movement.deviceId
        ? { ...movement, deviceId, syncStatus: movement.syncStatus ?? 'local' }
        : movement,
    ),
  };
};

export const loadAppData = (): AppData => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return prepareData(clone(seedData));
    const parsed: unknown = JSON.parse(raw);
    if (!isAppData(parsed)) {
      recordAppError('storage.load', 'El almacenamiento local no contiene una estructura válida.');
      return prepareData(clone(seedData));
    }
    return prepareData(parsed);
  } catch (error) {
    recordAppError('storage.load', error);
    return prepareData(clone(seedData));
  }
};

export const hydrateAppDataFromNative = async (): Promise<void> => {
  if (!isNativeDatabaseEnabled()) return;

  try {
    const nativeData = await readNativeAppData();
    if (nativeData) {
      const clean = prepareData(nativeData);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      await recordNativeStorageEvent('hydrate', 'Datos recuperados desde SQLite normalizado y validados.');
      return;
    }

    const initialData = loadAppData();
    await writeNativeAppData(initialData, { replace: true });
    await recordNativeStorageEvent('initialize', 'Base de datos normalizada creada con el estado inicial.');
  } catch (error) {
    recordAppError('storage.hydrate', error);
    console.error('No se ha podido hidratar SQLite. Se mantiene el almacenamiento web.', error);
  }
};

export const saveAppData = (
  data: AppData,
  options: { replaceNative?: boolean } = {},
): void => {
  const previous = readLocalDataWithoutFallback();
  const clean = prepareData(data);
  const replaceNative = options.replaceNative === true || hasRemovedIds(previous, clean);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    notifyDataUpdated(clean);
  } catch (error) {
    recordAppError('storage.local-save', error);
    throw error;
  }

  void (async () => {
    const nativeData = await attachDeviceToNewMovements(previous, clean);
    await writeNativeAppData(nativeData, { replace: replaceNative });

    if (nativeData !== clean) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nativeData));
      notifyDataUpdated(nativeData);
    }
  })().catch((error) => {
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

  const clean = prepareData(clone(seedData));
  saveAppData(clean, { replaceNative: true });
  void recordNativeStorageEvent('reset', 'Datos restaurados con reemplazo transaccional y confirmación reforzada.');
  return clean;
};
