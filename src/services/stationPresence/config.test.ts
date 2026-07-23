import { describe, expect, it } from 'vitest';
import { resolveStationPresenceConfig } from './config';

const publicKey = JSON.stringify({
  kty: 'EC',
  crv: 'P-256',
  x: 'public-x',
  y: 'public-y',
});

describe('configuración del punto físico', () => {
  it('permanece desactivado por defecto', () => {
    expect(resolveStationPresenceConfig({})).toEqual({ enabled: false, reason: 'disabled' });
  });

  it('activa firma local sin exigir canje remoto', () => {
    expect(resolveStationPresenceConfig({
      VITE_ISIVOLT_STATION_MODE: 'signed-qr',
      VITE_ISIVOLT_STATION_ID: 'ALMACEN-PTS',
      VITE_ISIVOLT_STATION_PUBLIC_KEY_JWK: publicKey,
    })).toMatchObject({
      enabled: true,
      stationId: 'ALMACEN-PTS',
      redeemUrl: undefined,
    });
  });

  it('acepta canje HTTPS y rutas del mismo origen', () => {
    expect(resolveStationPresenceConfig({
      VITE_ISIVOLT_STATION_MODE: 'signed-qr',
      VITE_ISIVOLT_STATION_ID: 'ALMACEN-PTS',
      VITE_ISIVOLT_STATION_PUBLIC_KEY_JWK: publicKey,
      VITE_ISIVOLT_STATION_REDEEM_URL: 'https://almacen.example/api/redeem',
    })).toMatchObject({ enabled: true, redeemUrl: 'https://almacen.example/api/redeem' });

    expect(resolveStationPresenceConfig({
      VITE_ISIVOLT_STATION_MODE: 'signed-qr',
      VITE_ISIVOLT_STATION_ID: 'ALMACEN-PTS',
      VITE_ISIVOLT_STATION_PUBLIC_KEY_JWK: publicKey,
      VITE_ISIVOLT_STATION_REDEEM_URL: '/api/redeem',
    })).toMatchObject({ enabled: true, redeemUrl: '/api/redeem' });
  });

  it('rechaza una URL HTTP de red local para evitar contenido mixto', () => {
    expect(resolveStationPresenceConfig({
      VITE_ISIVOLT_STATION_MODE: 'signed-qr',
      VITE_ISIVOLT_STATION_ID: 'ALMACEN-PTS',
      VITE_ISIVOLT_STATION_PUBLIC_KEY_JWK: publicKey,
      VITE_ISIVOLT_STATION_REDEEM_URL: 'http://192.168.4.1:8787/api/redeem',
    })).toEqual({
      enabled: false,
      reason: 'invalid-redeem-url',
      stationId: 'ALMACEN-PTS',
    });
  });
});
