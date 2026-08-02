import { getCloudProfile, type CloudProfile } from '../cloud/config';

const STORAGE_PREFIX = 'isivoltpro:device-security:v1:';
const DEFAULT_ITERATIONS = 180_000;
const DEFAULT_AUTO_LOCK_MINUTES = 5;
const PIN_PATTERN = /^\d{6}$/;

export const DEVICE_SECURITY_CHANGED_EVENT = 'isivoltpro:device-security-changed';
export const DEVICE_LOCK_REQUEST_EVENT = 'isivoltpro:device-lock-request';
export const DEVICE_REAUTH_REQUEST_EVENT = 'isivoltpro:device-reauth-request';

export type SecurityIdentity = {
  key: string;
  label: string;
  detail: string;
  profile: CloudProfile | null;
};

export type DeviceSecurityRecord = {
  version: 1;
  salt: string;
  verifier: string;
  iterations: number;
  autoLockMinutes: number;
  failedAttempts: number;
  lockedUntil?: number;
  createdAt: string;
  updatedAt: string;
};

export type PinVerificationResult = {
  ok: boolean;
  failedAttempts: number;
  remainingAttempts: number;
  lockedUntil?: number;
};

export type ReauthRequestDetail = {
  reason: string;
  resolve(result: boolean): void;
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary);
};

const fromBase64 = (value: string): Uint8Array => {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const timingSafeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
};

const deriveVerifier = async (pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> => {
  if (!window.crypto?.subtle) throw new Error('Este navegador no permite proteger el PIN mediante Web Crypto.');
  const material = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await window.crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material,
    256,
  );
  return new Uint8Array(bits);
};

const storageKey = (identity = getSecurityIdentity()): string => `${STORAGE_PREFIX}${identity.key}`;

const writeRecord = (record: DeviceSecurityRecord, identity = getSecurityIdentity()): void => {
  window.localStorage.setItem(storageKey(identity), JSON.stringify(record));
  window.dispatchEvent(new CustomEvent(DEVICE_SECURITY_CHANGED_EVENT, { detail: identity }));
};

const lockDuration = (failedAttempts: number): number => {
  if (failedAttempts >= 9) return 15 * 60_000;
  if (failedAttempts >= 8) return 5 * 60_000;
  if (failedAttempts >= 7) return 2 * 60_000;
  if (failedAttempts >= 6) return 60_000;
  if (failedAttempts >= 5) return 30_000;
  return 0;
};

export const getSecurityIdentity = (): SecurityIdentity => {
  const profile = getCloudProfile();
  if (!profile) {
    return {
      key: 'local-admin',
      label: 'Administrador local',
      detail: 'Datos guardados únicamente en este dispositivo',
      profile: null,
    };
  }
  return {
    key: `${profile.workspace}:${profile.id}`,
    label: profile.displayName,
    detail: `${profile.email} · ${profile.workspace}`,
    profile,
  };
};

export const readSecurityRecord = (identity = getSecurityIdentity()): DeviceSecurityRecord | null => {
  try {
    const raw = window.localStorage.getItem(storageKey(identity));
    if (!raw) return null;
    const record = JSON.parse(raw) as Partial<DeviceSecurityRecord>;
    if (record.version !== 1 || !record.salt || !record.verifier || !record.iterations) return null;
    return {
      version: 1,
      salt: record.salt,
      verifier: record.verifier,
      iterations: record.iterations,
      autoLockMinutes: record.autoLockMinutes ?? DEFAULT_AUTO_LOCK_MINUTES,
      failedAttempts: record.failedAttempts ?? 0,
      lockedUntil: record.lockedUntil,
      createdAt: record.createdAt ?? new Date().toISOString(),
      updatedAt: record.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

export const hasConfiguredPin = (identity = getSecurityIdentity()): boolean => Boolean(readSecurityRecord(identity));

export const validatePinFormat = (pin: string): boolean => PIN_PATTERN.test(pin);

export const createOrReplacePin = async (
  pin: string,
  autoLockMinutes = DEFAULT_AUTO_LOCK_MINUTES,
  identity = getSecurityIdentity(),
): Promise<DeviceSecurityRecord> => {
  if (!validatePinFormat(pin)) throw new Error('El PIN debe contener exactamente seis cifras.');
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const verifier = await deriveVerifier(pin, salt, DEFAULT_ITERATIONS);
  const previous = readSecurityRecord(identity);
  const timestamp = new Date().toISOString();
  const record: DeviceSecurityRecord = {
    version: 1,
    salt: toBase64(salt),
    verifier: toBase64(verifier),
    iterations: DEFAULT_ITERATIONS,
    autoLockMinutes,
    failedAttempts: 0,
    createdAt: previous?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  writeRecord(record, identity);
  return record;
};

export const verifyPin = async (pin: string, identity = getSecurityIdentity()): Promise<PinVerificationResult> => {
  const record = readSecurityRecord(identity);
  if (!record || !validatePinFormat(pin)) {
    return { ok: false, failedAttempts: record?.failedAttempts ?? 0, remainingAttempts: 5 };
  }

  const currentTime = Date.now();
  if (record.lockedUntil && record.lockedUntil > currentTime) {
    return {
      ok: false,
      failedAttempts: record.failedAttempts,
      remainingAttempts: 0,
      lockedUntil: record.lockedUntil,
    };
  }

  const candidate = await deriveVerifier(pin, fromBase64(record.salt), record.iterations);
  const expected = fromBase64(record.verifier);
  if (timingSafeEqual(candidate, expected)) {
    const next = { ...record, failedAttempts: 0, lockedUntil: undefined, updatedAt: new Date().toISOString() };
    writeRecord(next, identity);
    return { ok: true, failedAttempts: 0, remainingAttempts: 5 };
  }

  const failedAttempts = record.failedAttempts + 1;
  const duration = lockDuration(failedAttempts);
  const lockedUntil = duration ? currentTime + duration : undefined;
  const next = { ...record, failedAttempts, lockedUntil, updatedAt: new Date().toISOString() };
  writeRecord(next, identity);
  return {
    ok: false,
    failedAttempts,
    remainingAttempts: Math.max(0, 5 - failedAttempts),
    lockedUntil,
  };
};

export const updateAutoLockMinutes = (minutes: number, identity = getSecurityIdentity()): DeviceSecurityRecord | null => {
  const record = readSecurityRecord(identity);
  if (!record) return null;
  const allowed = [1, 5, 15, 30];
  const autoLockMinutes = allowed.includes(minutes) ? minutes : DEFAULT_AUTO_LOCK_MINUTES;
  const next = { ...record, autoLockMinutes, updatedAt: new Date().toISOString() };
  writeRecord(next, identity);
  return next;
};

export const requestDeviceLock = (reason = 'manual'): void => {
  window.dispatchEvent(new CustomEvent(DEVICE_LOCK_REQUEST_EVENT, { detail: { reason } }));
};

export const requestSecurityConfirmation = (reason: string): Promise<boolean> => new Promise((resolve) => {
  window.dispatchEvent(new CustomEvent<ReauthRequestDetail>(DEVICE_REAUTH_REQUEST_EVENT, {
    detail: { reason, resolve },
  }));
});
