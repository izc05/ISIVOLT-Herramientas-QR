import type { CentralSyncConfig } from './types';

const clean = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const validUrl = (value: string | undefined): value is string => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const resolveCentralSyncConfig = (
  environment: Record<string, unknown>,
): CentralSyncConfig => {
  const supabaseUrl = clean(environment.VITE_SUPABASE_URL);
  const publishableKey = clean(environment.VITE_SUPABASE_PUBLISHABLE_KEY);
  const workspaceId = clean(environment.VITE_ISIVOLT_WORKSPACE_ID);

  if (!validUrl(supabaseUrl)) {
    return { enabled: false, reason: 'missing-url' };
  }
  if (!publishableKey) {
    return { enabled: false, supabaseUrl, reason: 'missing-key' };
  }
  if (!workspaceId) {
    return {
      enabled: false,
      supabaseUrl,
      publishableKey,
      reason: 'missing-workspace',
    };
  }

  return {
    enabled: true,
    supabaseUrl,
    publishableKey,
    workspaceId,
  };
};

export const getCentralSyncConfig = (): CentralSyncConfig =>
  resolveCentralSyncConfig(import.meta.env as unknown as Record<string, unknown>);
