import type { CentralSyncConfig } from './types';

const clean = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const isLoopback = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';

const resolveServerUrl = (
  raw: string | undefined,
  currentOrigin?: string,
): { url?: string; reason?: 'missing-url' | 'insecure-url' } => {
  if (!raw) return { reason: 'missing-url' };
  const candidate = raw.toLowerCase() === 'same-origin' ? currentOrigin : raw;
  if (!candidate) return { reason: 'missing-url' };

  try {
    const url = new URL(candidate);
    if (url.protocol === 'https:') return { url: url.origin };
    if (url.protocol === 'http:' && isLoopback(url.hostname)) return { url: url.origin };
    return { reason: 'insecure-url' };
  } catch {
    return { reason: 'missing-url' };
  }
};

export const resolveCentralSyncConfig = (
  environment: Record<string, unknown>,
  currentOrigin = typeof window === 'undefined' ? undefined : window.location.origin,
): CentralSyncConfig => {
  const resolved = resolveServerUrl(clean(environment.VITE_POCKETBASE_URL), currentOrigin);
  const workspaceId = clean(environment.VITE_ISIVOLT_WORKSPACE_ID);

  if (!resolved.url) {
    return {
      provider: 'pocketbase',
      enabled: false,
      reason: resolved.reason ?? 'missing-url',
    };
  }
  if (!workspaceId) {
    return {
      provider: 'pocketbase',
      enabled: false,
      serverUrl: resolved.url,
      reason: 'missing-workspace',
    };
  }

  return {
    provider: 'pocketbase',
    enabled: true,
    serverUrl: resolved.url,
    workspaceId,
  };
};

export const getCentralSyncConfig = (): CentralSyncConfig =>
  resolveCentralSyncConfig(import.meta.env as unknown as Record<string, unknown>);
