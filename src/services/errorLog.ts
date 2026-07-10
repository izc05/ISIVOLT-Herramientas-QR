export type AppErrorEntry = {
  id: string;
  occurredAt: string;
  source: string;
  message: string;
  detail?: string;
};

const ERROR_LOG_KEY = 'isivolt-herramientas-qr:error-log:v1';
const MAX_ENTRIES = 80;

const readEntries = (): AppErrorEntry[] => {
  try {
    const raw = window.localStorage.getItem(ERROR_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as AppErrorEntry[] : [];
  } catch {
    return [];
  }
};

export const recordAppError = (source: string, error: unknown, detail?: string): AppErrorEntry => {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Error desconocido';
  const entry: AppErrorEntry = {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    occurredAt: new Date().toISOString(),
    source,
    message,
    detail: detail ?? (error instanceof Error ? error.stack : undefined),
  };

  try {
    window.localStorage.setItem(ERROR_LOG_KEY, JSON.stringify([entry, ...readEntries()].slice(0, MAX_ENTRIES)));
  } catch {
    // El registro de errores nunca debe impedir el funcionamiento de la app.
  }

  window.dispatchEvent(new CustomEvent<AppErrorEntry>('isivolt:error-recorded', { detail: entry }));
  return entry;
};

export const getAppErrorLog = (): AppErrorEntry[] => readEntries();

export const clearAppErrorLog = (): void => {
  window.localStorage.removeItem(ERROR_LOG_KEY);
};

export const installGlobalErrorLogging = (): (() => void) => {
  const onError = (event: ErrorEvent) => {
    recordAppError('window.error', event.error ?? event.message, `${event.filename}:${event.lineno}:${event.colno}`);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    recordAppError('window.unhandledrejection', event.reason);
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
};
