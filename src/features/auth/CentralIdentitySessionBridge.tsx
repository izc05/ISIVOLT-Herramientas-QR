import { useEffect } from 'react';
import { getCentralSyncClient } from '../../services/centralSync/client';
import {
  appendAuditEntry,
  ensureSecurityCache,
  getSecurityUsersSync,
  readSessionSync,
  saveSecurityUsers,
  saveSession,
  upsertSecurityUser,
} from '../../security/store';
import type { SecurityUser, UserRole } from '../../security/types';

const CENTRAL_USER_PREFIX = 'central-';
const validRoles = new Set<UserRole>(['admin', 'warehouse', 'coordinator', 'technician']);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

const roleFromRecord = (value: unknown): UserRole => {
  const role = text(value) as UserRole;
  return validRoles.has(role) ? role : 'technician';
};

const dispatchSession = () => {
  window.dispatchEvent(new CustomEvent('isivolt:security-session', { detail: readSessionSync() }));
  window.dispatchEvent(new CustomEvent('isivolt:central-account-changed'));
};

const clearCentralSession = async () => {
  await ensureSecurityCache();
  const session = readSessionSync();
  const centralUsers = getSecurityUsersSync().filter((user) => user.id.startsWith(CENTRAL_USER_PREFIX));
  if (centralUsers.length > 0) {
    await saveSecurityUsers(getSecurityUsersSync().filter((user) => !user.id.startsWith(CENTRAL_USER_PREFIX)));
  }
  if (session?.userId.startsWith(CENTRAL_USER_PREFIX)) {
    await saveSession(null);
  }
  dispatchSession();
};

const synchronizeCentralSession = async () => {
  const client = getCentralSyncClient();
  const record = client?.authStore.isValid ? client.authStore.record : null;
  if (!record || record.active !== true) {
    await clearCentralSession();
    return;
  }

  await ensureSecurityCache();
  const timestamp = new Date().toISOString();
  const userId = `${CENTRAL_USER_PREFIX}${record.id}`;
  const existing = getSecurityUsersSync().find((user) => user.id === userId);
  const user: SecurityUser = {
    id: userId,
    name: text(record.name) || text(record.email) || 'Usuario ISIVOLT',
    role: roleFromRecord(record.role),
    technicianId: text(record.technician_id) || undefined,
    pinHash: `remote-account:${record.id}`,
    active: true,
    failedAttempts: 0,
    lastLoginAt: timestamp,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  await upsertSecurityUser(user);
  const current = readSessionSync();
  if (current?.userId !== user.id) {
    await saveSession({ userId: user.id, unlockedAt: timestamp, lastActivityAt: timestamp });
    await appendAuditEntry({
      eventType: 'security.login',
      operatorUserId: user.id,
      operatorName: user.name,
      detail: `Inicio de sesión central con rol ${user.role}.`,
    });
  }
  dispatchSession();
};

export default function CentralIdentitySessionBridge() {
  useEffect(() => {
    const client = getCentralSyncClient();
    let disposed = false;

    const synchronize = () => {
      if (disposed) return;
      void synchronizeCentralSession();
    };

    const unsubscribe = client?.authStore.onChange(synchronize, true);
    window.addEventListener('focus', synchronize);

    return () => {
      disposed = true;
      unsubscribe?.();
      window.removeEventListener('focus', synchronize);
    };
  }, []);

  return null;
}
