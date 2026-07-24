import { describe, expect, it, vi } from 'vitest';
import type { StationPresenceConfig } from './config';
import { redeemStationPass } from './redeem';
import type { StationPass } from './token';

const pass: StationPass = {
  v: 1,
  stationId: 'ALMACEN-PTS',
  nonce: 'nonce-redemption-123',
  issuedAt: '2026-07-23T12:00:00.000Z',
  expiresAt: '2026-07-23T12:00:45.000Z',
  verifiedAt: '2026-07-23T12:00:10.000Z',
  token: 'ISIVOLT:STATION:payload.signature',
};

const config = (redeemUrl?: string): Extract<StationPresenceConfig, { enabled: true }> => ({
  enabled: true,
  stationId: 'ALMACEN-PTS',
  publicKey: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
  clockSkewSeconds: 10,
  maxTokenLifetimeSeconds: 90,
  redeemUrl,
});

describe('canje único del punto físico', () => {
  it('mantiene el modo firmado offline cuando no hay URL de canje', async () => {
    await expect(redeemStationPass(pass, 'operation-1', config())).resolves.toEqual({
      accepted: true,
      required: false,
    });
  });

  it('acepta una respuesta que coincide con estación, nonce y operación', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      accepted: true,
      stationId: 'ALMACEN-PTS',
      nonce: 'nonce-redemption-123',
      operationId: 'operation-1',
      verifiedAt: '2026-07-23T12:00:12.000Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await redeemStationPass(
      pass,
      'operation-1',
      config('https://almacen.example/api/redeem'),
      fetcher as typeof fetch,
    );
    expect(result).toMatchObject({ accepted: true, required: true, operationId: 'operation-1' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('rechaza un nonce ya consumido por el mini PC', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      accepted: false,
      code: 'nonce-reused',
      message: 'Este pase ya fue utilizado por otra operación.',
    }), { status: 409, headers: { 'Content-Type': 'application/json' } }));

    await expect(redeemStationPass(
      pass,
      'operation-2',
      config('https://almacen.example/api/redeem'),
      fetcher as typeof fetch,
    )).resolves.toMatchObject({ accepted: false, code: 'nonce-reused' });
  });

  it('rechaza una respuesta válida que no corresponde a la operación', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      accepted: true,
      stationId: 'ALMACEN-PTS',
      nonce: 'otro-nonce',
      operationId: 'operation-1',
      verifiedAt: '2026-07-23T12:00:12.000Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(redeemStationPass(
      pass,
      'operation-1',
      config('https://almacen.example/api/redeem'),
      fetcher as typeof fetch,
    )).resolves.toMatchObject({ accepted: false, code: 'response-mismatch' });
  });
});
