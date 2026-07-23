import { describe, expect, it } from 'vitest';
import { resolveCentralSyncConfig } from './config';

describe('configuración de sincronización central', () => {
  it('permanece en modo local sin variables de entorno', () => {
    expect(resolveCentralSyncConfig({})).toEqual({
      enabled: false,
      reason: 'missing-url',
    });
  });

  it('rechaza URLs que no utilicen HTTPS', () => {
    expect(resolveCentralSyncConfig({
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      VITE_ISIVOLT_WORKSPACE_ID: 'workspace-1',
    })).toEqual({
      enabled: false,
      reason: 'missing-url',
    });
  });

  it('solo se activa con URL, clave publicable y espacio de trabajo', () => {
    expect(resolveCentralSyncConfig({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      VITE_ISIVOLT_WORKSPACE_ID: 'workspace-1',
    })).toEqual({
      enabled: true,
      supabaseUrl: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_test',
      workspaceId: 'workspace-1',
    });
  });
});
