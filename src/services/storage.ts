import { seedData } from '../data/seed';
import type { AppData, Movement } from '../domain/types';
import { assertAuthorizedDataChange } from '../security/operationAuthorization';
import { getCurrentSecurityUser } from '../security/session';
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
const PENDING_NATIVE_WRITE_KEY = 'isivolt-herramientas-qr:pending-native-write:v1';

let nativeWriteQueue: Promise<void> = Promise.resolve();
let lastNativeWriteError: unknown = null;

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

type PendingNativeWrite = {
  id: string;
  startedAt: string;
  movementCount: number;
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

const readPendingNativeWrite = (): PendingNativeWrite | null => {
  try {
    const raw = window.localStorage.getItem(PENDING_NATIVE_WRITE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingNativeWrite>;
    if (!parsed.id || !parsed.startedAt || typeof parsed.movementCount !== 'number') return null;
    return parsed as PendingNativeWrite;
  } catch {
    return null;
  }
};

const markNativeWritePending = (data: AppData): string => {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const pending: PendingNativeWrite = {
    id,
    startedAt: new Date().toISOString(),
    movementCount: data.movements.length,
  };
  window.localStorage.setItem(PENDING_NATIVE_WRITE_KEY, JSON.stringify(pending));
  return id;
};

const clearPendingNativeWrite = (id?: string) => {
  if (!id) {
    window.localStorage.removeItem(PENDING_NATIVE_WRITE_KEY);
    return;
  }

  const current = readPendingNativeWrite();
  if (!current || current.id === id) {
    window.localStorage.removeItem(PENDING_NATIVE_WRITE_KEY);
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

export const mergeMovementMetadata = (current: AppData, persisted: AppData): AppData => {
  const persistedById = new Map<string, Movement>(
    persisted.movements.map((movement) => [movement.id, movement]),
  );

  return {
    ...current,
    movements: current.movements.map((movement) => {
      const stored = persistedById.get(movement.id);
      if (!stored) return movement;
      if (movement.deviceId === stored.deviceId && movement.syncStatus === stored.syncStatus) return movement;
      return {
        ...movement,
        deviceId: movement.deviceId ?? stored.deviceId,
        syncStatus: movement.syncStatus ?? stored.syncStatus,
      };
    }),
  };
};

const localContainsDataMissingFromNative = (local: AppData, native: AppData): boolean => {
  const nativeMovementIds = new Set(native.movements.map((movement) => movement.id));
  if (local.movements.some((movement) => !nativeMovementIds.has(movement.id))) return true;

  const nativeToolIds = new Set(native.tools.map((tool) => tool.id));
  if (local.tools.some((tool) => !nativeToolIds.has(tool.id))) return true;

  const nativeTechnicianIds = new Set(native.technicians.map((technician) => technician.id));
  return local.technicians.some((technician) => !nativeTechnicianIds.has(technician.id));
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
    const localData = readLocalDataWithoutFallback();
    const pendingWrite = readPendingNativeWrite();

    if (nativeData) {
      const cleanNative = prepareData(nativeData);
      const shouldRecoverLocal = Boolean(
        localData
        && (pendingWrite || localContainsDataMissingFromNative(localData, cleanNative)),
      );

      if (shouldRecoverLocal && localData) {
        const cleanLocal = prepareData(localData);
        const recoveredLocal = prepareData(mergeMovementMetadata(cleanLocal, cleanNative));
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recoveredLocal));
        await writeNativeAppData(recoveredLocal, { replace: true });
        clearPendingNativeWrite();
        lastNativeWriteError = null;
        await recordNativeStorageEvent(
          'recover-local',
          'Se ha conservado el estado local pendiente, incluidos los metadatos ya confirmados por SQLite, y se ha reconstruido la base nativa.',
        );
        notifyDataUpdated(recoveredLocal);
        return;
      }

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanNative));
      clearPendingNativeWrite();
      lastNativeWriteError = null;
      await recordNativeStorageEvent('hydrate', 'Datos recuperados desde SQLite normalizado y validados.');
      return;
    }

    const initialData = loadAppData();
    await writeNativeAppData(initialData, { replace: true });
    clearPendingNativeWrite();
    lastNativeWriteError = null;
    await recordNativeStorageEvent('initialize', 'Base de datos normalizada creada con el estado inicial.');
  } catch (error) {
    lastNativeWriteError = error;
    recordAppError('storage.hydrate', error);
    console.error('No se ha podido hidratar SQLite. Se mantiene el almacenamiento web.', error);
  }
};

export const saveAppData = (
  data: AppData,
  options: { replaceNative?: boolean } = {},
): void => {
  const previous = readLocalDataWithoutFallback();
  assertAuthorizedDataChange(previous, data, getCurrentSecurityUser());
  const clean = prepareData(data);
  const replaceNative = options.replaceNative === true || hasRemovedIds(previous, clean);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    notifyDataUpdated(clean);
  } catch (error) {
    recordAppError('storage.local-save', error);
    throw error;
  }

  lastNativeWriteError = null;
  if (!isNativeDatabaseEnabled()) return;

  const pendingWriteId = markNativeWritePending(clean);

  nativeWriteQueue = nativeWriteQueue
    .catch(() => undefined)
    .then(async () => {
      const nativeData = await attachDeviceToNewMovements(previous, clean);
      await writeNativeAppData(nativeData, { replace: replaceNative });

      if (nativeData !== clean) {
        const latestLocal = readLocalDataWithoutFallback() ?? clean;
        const merged = prepareData(mergeMovementMetadata(latestLocal, nativeData));
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        notifyDataUpdated(merged);
      }

      clearPendingNativeWrite(pendingWriteId);
      lastNativeWriteError = null;
    })
    .catch((error) => {
      lastNativeWriteError = error;
      recordAppError('storage.sqlite-save', error);
      console.error('No se ha podido guardar el estado en SQLite.', error);
    });
};

export const waitForPendingAppDataWrites = async (): Promise<void> => {
  await nativeWriteQueue;
  if (!lastNativeWriteError) return;
  throw lastNativeWriteError instanceof Error
    ? lastNativeWriteError
    : new Error('No se ha podido confirmar el guardado en SQLite.');
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
