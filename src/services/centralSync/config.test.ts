import { describe, expect, it } from 'vitest';
import { resolveCentralSyncConfig } from './config';

describe('configuración PocketBase central', () => {
  it('permanece en modo local sin variables de entorno', () => {
    expect(resolveCentralSyncConfig({})).toEqual({
      provider: 'pocketbase',
      enabled: false,
      reason: 'missing-url',
    });
  });

  it('rechaza HTTP de red local para no mezclarlo con una web HTTPS', () => {
    expect(resolveCentralSyncConfig({
      VITE_POCKETBASE_URL: 'http://192.168.10.20:8090',
      VITE_ISIVOLT_WORKSPACE_ID: 'workspace-1',
    })).toEqual({
      provider: 'pocketbase',
      enabled: false,
      reason: 'insecure-url',
    });
  });

  it('permite HTTP únicamente en localhost para desarrollo', () => {
    expect(resolveCentralSyncConfig({
      VITE_POCKETBASE_URL: 'http://127.0.0.1:8090',
      VITE_ISIVOLT_WORKSPACE_ID: 'workspace-1',
    })).toEqual({
      provider: 'pocketbase',
      enabled: true,
      serverUrl: 'http://127.0.0.1:8090',
      workspaceId: 'workspace-1',
    });
  });

  it('acepta HTTPS sin ninguna clave pública en el navegador', () => {
    expect(resolveCentralSyncConfig({
      VITE_POCKETBASE_URL: 'https://almacen.isivolt.local',
      VITE_ISIVOLT_WORKSPACE_ID: 'workspace-1',
    })).toEqual({
      provider: 'pocketbase',
      enabled: true,
      serverUrl: 'https://almacen.isivolt.local',
      workspaceId: 'workspace-1',
    });
  });

  it('resuelve same-origin cuando la aplicación se sirve desde el mini PC', () => {
    expect(resolveCentralSyncConfig({
      VITE_POCKETBASE_URL: 'same-origin',
      VITE_ISIVOLT_WORKSPACE_ID: 'workspace-1',
    }, 'https://almacen.isivolt.local')).toEqual({
      provider: 'pocketbase',
      enabled: true,
      serverUrl: 'https://almacen.isivolt.local',
      workspaceId: 'workspace-1',
    });
  });
});
