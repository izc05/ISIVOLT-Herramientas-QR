import type { SecuritySession, SecurityUser } from './types';
import {
  appendAuditEntry,
  ensureSecurityCache,
  getCurrentUserSync,
  readSessionSync,
  saveSession,
  touchSession,
} from './store';

const DEFAULT_OPERATOR = 'Operador no identificado';

export const unlockSession = async (user: SecurityUser): Promise<SecuritySession> => {
  const timestamp = new Date().toISOString();
  const session: SecuritySession = {
    userId: user.id,
    unlockedAt: timestamp,
    lastActivityAt: timestamp,
  };
  await saveSession(session);
  await appendAuditEntry({
    eventType: 'security.login',
    operatorUserId: user.id,
    operatorName: user.name,
    detail: `Inicio de sesión con rol ${user.role}.`,
  });
  window.dispatchEvent(new CustomEvent('isivolt:security-session', { detail: session }));
  return session;
};

export const lockSession = async (reason = 'Bloqueo manual') => {
  await ensureSecurityCache();
  const user = getCurrentUserSync();
  await appendAuditEntry({
    eventType: 'security.lock',
    operatorUserId: user?.id,
    operatorName: user?.name,
    detail: reason,
  });
  await saveSession(null);
  window.dispatchEvent(new CustomEvent('isivolt:security-session', { detail: null }));
};

export const logoutSession = async () => {
  await ensureSecurityCache();
  const user = getCurrentUserSync();
  await appendAuditEntry({
    eventType: 'security.logout',
    operatorUserId: user?.id,
    operatorName: user?.name,
    detail: 'Cierre de sesión voluntario.',
  });
  await saveSession(null);
  window.dispatchEvent(new CustomEvent('isivolt:security-session', { detail: null }));
};

export const getCurrentSecuritySession = readSessionSync;
export const getCurrentSecurityUser = getCurrentUserSync;
export const getCurrentOperatorName = () => getCurrentUserSync()?.name ?? DEFAULT_OPERATOR;
export const getCurrentOperatorId = () => getCurrentUserSync()?.id;
export const registerSessionActivity = touchSession;
