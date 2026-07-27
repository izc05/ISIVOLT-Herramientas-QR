import { useEffect, useSyncExternalStore } from 'react';
import { getCurrentSecurityUser } from '../../security/session';
import {
  getCentralSyncState,
  subscribeCentralSyncState,
} from '../../services/centralSync/state';
import type { CentralSyncState } from '../../services/centralSync/types';
import { loadAppData } from '../../services/storage';

const capitalize = (value: string) => value.charAt(0).toLocaleUpperCase('es-ES') + value.slice(1);

const dateLabel = () => capitalize(new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(new Date()));

const formatLastSync = (value?: string) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

const plural = (count: number, singular: string, pluralValue: string) => count === 1 ? singular : pluralValue;

const heroSummary = (state: CentralSyncState, technicianCount: number) => {
  const technicians = `${technicianCount} ${plural(technicianCount, 'técnico', 'técnicos')}`;

  switch (state.mode) {
    case 'local':
      return `${technicians} registrados localmente`;
    case 'ready':
      return `${technicians} · servidor central preparado`;
    case 'auth-required':
      return `${technicians} · acceso central pendiente`;
    case 'offline':
      return `${technicians} · trabajando sin conexión`;
    case 'syncing':
      return `${technicians} · sincronizando`;
    case 'synced':
      return `${technicians} sincronizados`;
    case 'conflict':
      return `${technicians} · ${state.conflictCount} ${plural(state.conflictCount, 'conflicto', 'conflictos')}`;
    case 'error':
      return `${technicians} · error de sincronización`;
  }
};

type StatusCopy = {
  primary: string;
  detail: string;
  level: string;
};

const statusCopy = (state: CentralSyncState): StatusCopy => {
  const pending = state.pendingCount > 0
    ? `${state.pendingCount} ${plural(state.pendingCount, 'cambio pendiente', 'cambios pendientes')}`
    : '';

  switch (state.mode) {
    case 'local':
      return {
        primary: 'Modo local operativo',
        detail: 'Datos guardados en este dispositivo',
        level: 'SERVIDOR PENDIENTE',
      };
    case 'ready':
      return {
        primary: 'Servidor central preparado',
        detail: pending || state.message,
        level: pending ? 'CAMBIOS PENDIENTES' : 'LISTO PARA SINCRONIZAR',
      };
    case 'auth-required':
      return {
        primary: 'Acceso central pendiente',
        detail: state.message,
        level: 'INICIAR SESIÓN',
      };
    case 'offline':
      return {
        primary: 'Trabajo sin conexión',
        detail: pending || state.message,
        level: pending ? 'COLA LOCAL ACTIVA' : 'SIN CONEXIÓN',
      };
    case 'syncing':
      return {
        primary: 'Sincronizando con el mini PC',
        detail: pending || state.message,
        level: 'SINCRONIZANDO',
      };
    case 'synced': {
      const lastSync = formatLastSync(state.lastSyncAt);
      return {
        primary: 'Servidor central conectado',
        detail: lastSync ? `Última sincronización: ${lastSync}` : state.message,
        level: 'SINCRONIZADO',
      };
    }
    case 'conflict':
      return {
        primary: 'Revisión de sincronización necesaria',
        detail: `${state.conflictCount} ${plural(state.conflictCount, 'conflicto pendiente', 'conflictos pendientes')}`,
        level: 'REVISAR CONFLICTOS',
      };
    case 'error':
      return {
        primary: 'Error de sincronización',
        detail: state.message,
        level: 'REVISAR SERVIDOR',
      };
  }
};

const setText = (element: Element | null | undefined, value: string) => {
  if (element && element.textContent !== value) element.textContent = value;
};

const applyStatus = (state: CentralSyncState) => {
  const data = loadAppData();
  const currentUser = getCurrentSecurityUser();
  const technicianMode = currentUser?.role === 'technician' && Boolean(currentUser.technicianId);

  if (!technicianMode) {
    const summary = `${dateLabel()} · ${heroSummary(state, data.technicians.length)}`;
    document.querySelectorAll<HTMLElement>('.command-hero .hero-date').forEach((element) => setText(element, summary));
  }

  const copy = statusCopy(state);
  document.querySelectorAll<HTMLElement>('.status-line, .game-status-line').forEach((status) => {
    const directSpans = Array.from(status.children)
      .filter((element): element is HTMLSpanElement => element instanceof HTMLSpanElement);
    const textSpans = directSpans.filter((span) => (
      !span.classList.contains('live-dot')
      && !span.classList.contains('status-divider')
      && !span.classList.contains('system-level')
    ));

    setText(textSpans[0], copy.primary);
    setText(textSpans[1], copy.detail);
    const level = status.querySelector<HTMLElement>('.system-level');
    setText(level, copy.level);
    status.dataset.syncMode = state.mode;
    status.setAttribute('aria-label', `${copy.primary}. ${copy.detail}. ${copy.level}.`);
  });

  document.body.dataset.centralMode = state.mode;
};

export default function OperationalStatusPresenter() {
  const state = useSyncExternalStore(
    subscribeCentralSyncState,
    getCentralSyncState,
    getCentralSyncState,
  );

  useEffect(() => {
    let frame: number | null = null;

    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        applyStatus(state);
      });
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('isivolt:data-updated', schedule);
    window.addEventListener('isivolt:security-session', schedule);
    window.addEventListener('isivolt:central-account-changed', schedule);
    schedule();

    return () => {
      observer.disconnect();
      window.removeEventListener('isivolt:data-updated', schedule);
      window.removeEventListener('isivolt:security-session', schedule);
      window.removeEventListener('isivolt:central-account-changed', schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [state]);

  return null;
}
