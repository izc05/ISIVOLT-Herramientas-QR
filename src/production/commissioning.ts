import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Preferences } from '@capacitor/preferences';
import { APP_VERSION, DATABASE_SCHEMA_VERSION } from '../config/app';
import { getSecurityUsersSync } from '../security/store';
import { getNativeDatabaseHealth } from '../services/nativeDatabase';
import { getNfcAvailability, normalizeNfcUid } from '../services/nfcScanner';
import { loadAppData } from '../services/storage';

const STORAGE_KEY = 'isivolt-commissioning-v1';

export type CommissioningCheckStatus = 'pending' | 'passed' | 'failed';

export type CommissioningManualCheck = {
  id: string;
  title: string;
  detail: string;
  status: CommissioningCheckStatus;
  updatedAt?: string;
};

export type CommissioningAutomaticCheck = {
  id: string;
  title: string;
  detail: string;
  passed: boolean;
};

export type CommissioningState = {
  appVersion: string;
  deviceModel?: string;
  androidVersion?: string;
  tester?: string;
  startedAt: string;
  updatedAt: string;
  manual: CommissioningManualCheck[];
};

export const DEFAULT_MANUAL_CHECKS: CommissioningManualCheck[] = [
  { id: 'update-data', title: 'Actualización conserva datos', detail: 'Instalar sobre la versión anterior y comprobar todos los contadores.', status: 'pending' },
  { id: 'camera-permission', title: 'Permiso y apertura de cámara', detail: 'Aceptar el permiso y abrir el lector QR.', status: 'pending' },
  { id: 'technician-qr', title: 'Escaneo QR de técnico', detail: 'Identificar un técnico real mediante su etiqueta.', status: 'pending' },
  { id: 'tool-qr', title: 'Escaneo QR de herramienta', detail: 'Leer una herramienta real e identificarla correctamente.', status: 'pending' },
  { id: 'technician-nfc', title: 'Tarjeta NFC de técnico', detail: 'Leer la misma tarjeta tres veces y confirmar que mantiene el UID.', status: 'pending' },
  { id: 'tool-nfc', title: 'Pegatina NFC de herramienta', detail: 'Vincular una etiqueta, leerla y localizar la herramienta correcta.', status: 'pending' },
  { id: 'nfc-bulk-return', title: 'Devolución completa por tarjeta', detail: 'Pasar la tarjeta del técnico, revisar todas sus herramientas y confirmar la entrada.', status: 'pending' },
  { id: 'manual-code', title: 'Entrada manual de respaldo', detail: 'Completar una operación sin utilizar cámara ni NFC.', status: 'pending' },
  { id: 'checkout-return', title: 'Entrega y devolución completas', detail: 'Registrar una salida y su posterior entrada mediante QR o NFC.', status: 'pending' },
  { id: 'incident', title: 'Devolución con incidencia', detail: 'Comprobar observación obligatoria y bloqueo de la herramienta.', status: 'pending' },
  { id: 'photo', title: 'Fotografía persistente', detail: 'Hacer foto, cerrar, abrir y comprobarla.', status: 'pending' },
  { id: 'excel', title: 'Excel compartible', detail: 'Generar y abrir el informe operativo y de gestión.', status: 'pending' },
  { id: 'backup', title: 'Copia y restauración', detail: 'Crear una copia y restaurarla en un entorno de prueba.', status: 'pending' },
  { id: 'offline', title: 'Funcionamiento sin conexión', detail: 'Realizar operaciones en modo avión y reiniciar la app.', status: 'pending' },
  { id: 'roles', title: 'Permisos de los tres roles', detail: 'Verificar Administrador, Almacén y Técnico.', status: 'pending' },
  { id: 'autolock', title: 'Bloqueo por inactividad', detail: 'Confirmar bloqueo automático y desbloqueo por PIN.', status: 'pending' },
  { id: 'rectification', title: 'Rectificación inmutable', detail: 'Crear ajuste y conservar el movimiento original.', status: 'pending' },
  { id: 'sound-haptics', title: 'Sonido y vibración', detail: 'Confirmar funcionamiento y desactivación independiente.', status: 'pending' },
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const readLocal = (): CommissioningState | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CommissioningState>;
    if (!parsed.startedAt || !Array.isArray(parsed.manual)) return null;
    return parsed as CommissioningState;
  } catch {
    return null;
  }
};

const mergeManualChecks = (stored: CommissioningManualCheck[]) => {
  const byId = new Map(stored.map((item) => [item.id, item]));
  return DEFAULT_MANUAL_CHECKS.map((item) => byId.get(item.id) ?? item);
};

export const loadCommissioningState = async (): Promise<CommissioningState> => {
  let stored: string | null = null;
  try {
    stored = (await Preferences.get({ key: STORAGE_KEY })).value;
  } catch {
    stored = window.localStorage.getItem(STORAGE_KEY);
  }

  if (stored) {
    try {
      const parsed = JSON.parse(stored) as CommissioningState;
      if (Array.isArray(parsed.manual)) return { ...parsed, appVersion: APP_VERSION, manual: mergeManualChecks(parsed.manual) };
    } catch {
      // Se crea un estado nuevo.
    }
  }

  const local = readLocal();
  if (local) return { ...local, appVersion: APP_VERSION, manual: mergeManualChecks(local.manual) };
  const timestamp = new Date().toISOString();
  return {
    appVersion: APP_VERSION,
    startedAt: timestamp,
    updatedAt: timestamp,
    manual: clone(DEFAULT_MANUAL_CHECKS),
  };
};

export const saveCommissioningState = async (state: CommissioningState) => {
  const next = { ...state, appVersion: APP_VERSION, updatedAt: new Date().toISOString() };
  const text = JSON.stringify(next);
  window.localStorage.setItem(STORAGE_KEY, text);
  try {
    await Preferences.set({ key: STORAGE_KEY, value: text });
  } catch {
    // localStorage queda como respaldo.
  }
  return next;
};

export const resetCommissioningState = async () => {
  const timestamp = new Date().toISOString();
  return saveCommissioningState({
    appVersion: APP_VERSION,
    startedAt: timestamp,
    updatedAt: timestamp,
    manual: clone(DEFAULT_MANUAL_CHECKS),
  });
};

export const runAutomaticCommissioningChecks = async (): Promise<CommissioningAutomaticCheck[]> => {
  const data = loadAppData();
  const users = getSecurityUsersSync();
  const native = Capacitor.isNativePlatform();
  let cameraSupported = false;
  let cameraPermission = 'no disponible';
  let nfcAvailable = false;
  let nfcEnabled = false;
  let databaseSchema = 0;
  let databaseMatches = false;

  if (native) {
    try {
      cameraSupported = (await BarcodeScanner.isSupported()).supported;
      cameraPermission = (await BarcodeScanner.checkPermissions()).camera;
    } catch {
      cameraSupported = false;
    }
    try {
      const nfc = await getNfcAvailability();
      nfcAvailable = nfc.available;
      nfcEnabled = nfc.enabled;
    } catch {
      nfcAvailable = false;
      nfcEnabled = false;
    }
    try {
      const health = await getNativeDatabaseHealth();
      databaseSchema = health?.schemaVersion ?? 0;
      databaseMatches = Boolean(
        health
        && health.tools === data.tools.length
        && health.technicians === data.technicians.length
        && health.movements === data.movements.length,
      );
    } catch {
      databaseMatches = false;
    }
  }

  const uniqueCodes = new Set(data.tools.map((tool) => tool.code.trim().toUpperCase())).size === data.tools.length;
  const uniqueQr = new Set(data.tools.map((tool) => tool.qrCode.trim().toUpperCase())).size === data.tools.length;
  const nfcValues = [
    ...data.technicians.map((item) => normalizeNfcUid(item.nfcUid)),
    ...data.tools.map((item) => normalizeNfcUid(item.nfcUid)),
  ].filter(Boolean);
  const uniqueNfc = new Set(nfcValues).size === nfcValues.length;
  const hasAdmin = users.some((user) => user.active && user.role === 'admin');
  const brokenMovements = data.movements.filter((movement) => !data.tools.some((tool) => tool.id === movement.toolId)).length;

  return [
    { id: 'version', title: 'Versión candidata', detail: APP_VERSION, passed: APP_VERSION.startsWith('1.0.0-rc.') },
    { id: 'native', title: 'Ejecución Android nativa', detail: native ? 'Capacitor Android activo' : 'Abierta desde navegador', passed: native },
    { id: 'database-schema', title: 'Esquema SQLite', detail: `Detectado v${databaseSchema} · requerido v${DATABASE_SCHEMA_VERSION}`, passed: native && databaseSchema >= DATABASE_SCHEMA_VERSION },
    { id: 'database-counts', title: 'Contadores SQLite', detail: databaseMatches ? 'Coinciden con la aplicación' : 'No coinciden o no disponibles', passed: native && databaseMatches },
    { id: 'camera', title: 'Compatibilidad de cámara QR', detail: `Compatible: ${cameraSupported ? 'sí' : 'no'} · permiso: ${cameraPermission}`, passed: native && cameraSupported },
    { id: 'nfc', title: 'Compatibilidad NFC', detail: nfcAvailable ? `Lector disponible · ${nfcEnabled ? 'activado' : 'desactivado'}` : 'Sin lector NFC', passed: native && nfcAvailable },
    { id: 'admin', title: 'Administrador activo', detail: hasAdmin ? 'Configurado' : 'No existe', passed: hasAdmin },
    { id: 'codes', title: 'Códigos únicos', detail: uniqueCodes ? 'Sin duplicados' : 'Hay códigos repetidos', passed: uniqueCodes },
    { id: 'qr', title: 'QR únicos', detail: uniqueQr ? 'Sin duplicados' : 'Hay QR repetidos', passed: uniqueQr },
    { id: 'nfc-unique', title: 'UID NFC únicos', detail: uniqueNfc ? `${nfcValues.length} identificadores vinculados sin duplicados` : 'Hay un UID NFC repetido', passed: uniqueNfc },
    { id: 'history', title: 'Integridad del historial', detail: brokenMovements === 0 ? 'Sin movimientos huérfanos' : `${brokenMovements} movimientos huérfanos`, passed: brokenMovements === 0 },
  ];
};
