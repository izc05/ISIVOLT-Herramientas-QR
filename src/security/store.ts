import { Preferences } from '@capacitor/preferences';
import type { AuditEntry, SecuritySession, SecurityUser, UserRole } from './types';

const USERS_KEY = 'isivolt-security-users-v1';
const SESSION_KEY = 'isivolt-security-session-v1';
const AUDIT_KEY = 'isivolt-security-audit-v1';
const MAX_AUDIT_ENTRIES = 1_000;
const PREFERENCES_TIMEOUT_MS = 1_800;

let cachedUsers: SecurityUser[] = [];
let cacheLoaded = false;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const parseArray = <T,>(value: string | null): T[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
};

const withTimeout = async <T,>(operation: Promise<T>, milliseconds = PREFERENCES_TIMEOUT_MS): Promise<T> =>
  Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`Preferences no respondió en ${milliseconds} ms.`)), milliseconds);
    }),
  ]);

const readPreference = async (key: string) => {
  const fallback = window.localStorage.getItem(key);
  try {
    const result = await withTimeout(Preferences.get({ key }));
    return result.value ?? fallback;
  } catch {
    return fallback;
  }
};

const writePreference = async (key: string, value: string) => {
  window.localStorage.setItem(key, value);
  try {
    await withTimeout(Preferences.set({ key, value }));
  } catch {
    // localStorage permanece como respaldo web y de emergencia.
  }
};

export const loadSecurityUsers = async (): Promise<SecurityUser[]> => {
  const users = parseArray<SecurityUser>(await readPreference(USERS_KEY))
    .filter((user) => user && typeof user.id === 'string' && typeof user.pinHash === 'string');
  cachedUsers = users;
  cacheLoaded = true;
  return clone(users);
};

export const getSecurityUsersSync = () => clone(cachedUsers);

export const ensureSecurityCache = async () => {
  if (!cacheLoaded) await loadSecurityUsers();
};

export const saveSecurityUsers = async (users: SecurityUser[]) => {
  cachedUsers = clone(users);
  cacheLoaded = true;
  await writePreference(USERS_KEY, JSON.stringify(users));
};

export const upsertSecurityUser = async (user: SecurityUser) => {
  await ensureSecurityCache();
  const users = cachedUsers.some((item) => item.id === user.id)
    ? cachedUsers.map((item) => item.id === user.id ? user : item)
    : [user, ...cachedUsers];
  await saveSecurityUsers(users);
  return clone(user);
};

export const buildSecurityUser = (input: {
  name: string;
  role: UserRole;
  pinHash: string;
  technicianId?: string;
}): SecurityUser => {
  const timestamp = new Date().toISOString();
  return {
    id: `user-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
    name: input.name.trim(),
    role: input.role,
    technicianId: input.technicianId,
    pinHash: input.pinHash,
    active: true,
    failedAttempts: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const readSessionSync = (): SecuritySession | null => {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SecuritySession>;
    return parsed.userId && parsed.unlockedAt && parsed.lastActivityAt
      ? parsed as SecuritySession
      : null;
  } catch {
    return null;
  }
};

export const saveSession = async (session: SecuritySession | null) => {
  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    try { await withTimeout(Preferences.remove({ key: SESSION_KEY })); } catch { /* sin acción */ }
    return;
  }
  await writePreference(SESSION_KEY, JSON.stringify(session));
};

export const touchSession = async () => {
  const session = readSessionSync();
  if (!session) return null;
  const next = { ...session, lastActivityAt: new Date().toISOString() };
  await saveSession(next);
  return next;
};

export const getCurrentUserSync = (): SecurityUser | null => {
  const session = readSessionSync();
  if (!session) return null;
  return cachedUsers.find((user) => user.id === session.userId && user.active) ?? null;
};

export const loadAuditEntries = (): AuditEntry[] => parseArray<AuditEntry>(window.localStorage.getItem(AUDIT_KEY));

export const appendAuditEntry = async (
  entry: Omit<AuditEntry, 'id' | 'occurredAt'> & Partial<Pick<AuditEntry, 'id' | 'occurredAt'>>,
) => {
  const value: AuditEntry = {
    ...entry,
    id: entry.id ?? `audit-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
    occurredAt: entry.occurredAt ?? new Date().toISOString(),
  };
  const entries = [value, ...loadAuditEntries()].slice(0, MAX_AUDIT_ENTRIES);
  await writePreference(AUDIT_KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent<AuditEntry>('isivolt:audit-recorded', { detail: value }));
  return value;
};

export const clearAuditEntries = async () => {
  await writePreference(AUDIT_KEY, '[]');
};
