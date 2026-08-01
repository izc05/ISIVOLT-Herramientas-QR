import { describe, expect, it } from 'vitest';
import type { StationPresenceConfig } from './config';
import {
  parseStationToken,
  validateStationPayload,
  verifyStationToken,
  type StationTokenPayload,
} from './token';

const encodeBase64Url = (value: Uint8Array): string => {
  let binary = '';
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return globalThis.btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

const payload: StationTokenPayload = {
  v: 1,
  stationId: 'ALMACEN-PTS',
  nonce: 'nonce-123456789',
  issuedAt: '2026-07-23T12:00:00.000Z',
  expiresAt: '2026-07-23T12:00:45.000Z',
};

const baseConfig = (publicKey: JsonWebKey): Extract<StationPresenceConfig, { enabled: true }> => ({
  enabled: true,
  stationId: 'ALMACEN-PTS',
  publicKey,
  clockSkewSeconds: 5,
  maxTokenLifetimeSeconds: 90,
});

describe('QR firmado del punto de entrega', () => {
  it('rechaza códigos que no usan el formato de estación', () => {
    expect(parseStationToken('ISIVOLT:TOOL:HER-001')).toBeNull();
  });

  it('rechaza un QR caducado', () => {
    const error = validateStationPayload(
      payload,
      baseConfig({ kty: 'EC', crv: 'P-256', x: 'x', y: 'y' }),
      new Date('2026-07-23T12:02:00.000Z'),
    );
    expect(error).toMatchObject({ valid: false, code: 'expired' });
  });

  it('rechaza un QR de otra estación', () => {
    const error = validateStationPayload(
      { ...payload, stationId: 'OTRO-ALMACEN' },
      baseConfig({ kty: 'EC', crv: 'P-256', x: 'x', y: 'y' }),
      new Date('2026-07-23T12:00:20.000Z'),
    );
    expect(error).toMatchObject({ valid: false, code: 'wrong-station' });
  });

  it('verifica una firma ECDSA P-256 válida y rechaza la manipulación', async () => {
    const keyPair = await globalThis.crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    ) as CryptoKeyPair;
    const publicKey = await globalThis.crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const payloadSegment = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
    const signature = new Uint8Array(await globalThis.crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      new TextEncoder().encode(payloadSegment),
    ));
    const token = `ISIVOLT:STATION:${payloadSegment}.${encodeBase64Url(signature)}`;

    const valid = await verifyStationToken(
      token,
      baseConfig(publicKey),
      new Date('2026-07-23T12:00:20.000Z'),
    );
    expect(valid.valid).toBe(true);

    const parsed = parseStationToken(token);
    expect(parsed).not.toBeNull();
    const manipulatedPayload = { ...payload, stationId: 'OTRO-ALMACEN' };
    const manipulatedSegment = encodeBase64Url(new TextEncoder().encode(JSON.stringify(manipulatedPayload)));
    const manipulatedToken = `ISIVOLT:STATION:${manipulatedSegment}.${encodeBase64Url(signature)}`;
    const invalid = await verifyStationToken(
      manipulatedToken,
      { ...baseConfig(publicKey), stationId: 'OTRO-ALMACEN' },
      new Date('2026-07-23T12:00:20.000Z'),
    );
    expect(invalid).toMatchObject({ valid: false, code: 'signature-invalid' });
  });
});
