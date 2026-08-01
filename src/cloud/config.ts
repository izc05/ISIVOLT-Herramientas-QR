const URL_STORAGE_KEY = 'isivoltpro:pocketbase-url';
const TOKEN_STORAGE_KEY = 'isivoltpro:pocketbase-token';
const PROFILE_STORAGE_KEY = 'isivoltpro:pocketbase-profile';

const normalizeUrl = (value: string): string => value.trim().replace(/\/+$/, '');

export const getPocketBaseUrl = (): string => {
  const runtime = window.localStorage.getItem(URL_STORAGE_KEY) ?? '';
  const buildTime = import.meta.env.VITE_POCKETBASE_URL ?? '';
  return normalizeUrl(runtime || buildTime);
};

export const savePocketBaseUrl = (value: string): string => {
  const normalized = normalizeUrl(value);
  if (normalized) window.localStorage.setItem(URL_STORAGE_KEY, normalized);
  else window.localStorage.removeItem(URL_STORAGE_KEY);
  return normalized;
};

export const getPocketBaseToken = (): string => window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? '';

export const savePocketBaseToken = (token: string): void => {
  if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
};

export type CloudProfile = {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'coordinator' | 'technician';
  workspace: string;
  technicianExternalId?: string;
};

export const getCloudProfile = (): CloudProfile | null => {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CloudProfile>;
    if (!value.id || !value.email || !value.role || !value.workspace) return null;
    return {
      id: value.id,
      email: value.email,
      displayName: value.displayName ?? value.email,
      role: value.role,
      workspace: value.workspace,
      technicianExternalId: value.technicianExternalId,
    };
  } catch {
    return null;
  }
};

export const saveCloudProfile = (profile: CloudProfile | null): void => {
  if (profile) window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  else window.localStorage.removeItem(PROFILE_STORAGE_KEY);
};

export const clearCloudSession = (): void => {
  savePocketBaseToken('');
  saveCloudProfile(null);
};
