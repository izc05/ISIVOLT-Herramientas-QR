import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createStationToken,
  ensureStationKeyPair,
  STATION_TOKEN_PREFIX,
  verifyStationToken,
} from '../src/token.mjs';

test('genera, persiste y verifica una clave P-256', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'isivolt-station-key-'));
  try {
    const first = await ensureStationKeyPair(directory);
    const second = await ensureStationKeyPair(directory);
    assert.equal(first.publicJwk.kty, 'EC');
    assert.equal(first.publicJwk.crv, 'P-256');
    assert.equal(first.publicJwk.x, second.publicJwk.x);
    assert.equal(first.publicJwk.y, second.publicJwk.y);
    assert.equal(first.publicJwk.d, undefined);

    const token = createStationToken({
      stationId: 'ALMACEN-PTS',
      privateKey: first.privateKey,
      ttlSeconds: 45,
      now: new Date('2026-07-23T12:00:00.000Z'),
      nonce: 'nonce-prueba-123456',
    });
    assert.ok(token.token.startsWith(STATION_TOKEN_PREFIX));

    const result = verifyStationToken({
      token: token.token,
      publicKey: second.publicKey,
      expectedStationId: 'ALMACEN-PTS',
      now: new Date('2026-07-23T12:00:20.000Z'),
    });
    assert.equal(result.valid, true);
    assert.equal(result.payload.nonce, 'nonce-prueba-123456');

    const publicFile = JSON.parse(await readFile(first.publicJwkPath, 'utf8'));
    assert.equal(publicFile.d, undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rechaza contenido manipulado y tokens caducados', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'isivolt-station-tamper-'));
  try {
    const keys = await ensureStationKeyPair(directory);
    const created = createStationToken({
      stationId: 'ALMACEN-PTS',
      privateKey: keys.privateKey,
      ttlSeconds: 30,
      now: new Date('2026-07-23T12:00:00.000Z'),
      nonce: 'nonce-manipulacion',
    });
    const [payloadSegment, signatureSegment] = created.token
      .slice(STATION_TOKEN_PREFIX.length)
      .split('.');
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8'));
    payload.stationId = 'OTRO-ALMACEN';
    const changed = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const manipulated = verifyStationToken({
      token: `${STATION_TOKEN_PREFIX}${changed}.${signatureSegment}`,
      publicKey: keys.publicKey,
      expectedStationId: 'OTRO-ALMACEN',
      now: new Date('2026-07-23T12:00:10.000Z'),
    });
    assert.deepEqual(manipulated.valid, false);
    assert.equal(manipulated.code, 'signature-invalid');

    const expired = verifyStationToken({
      token: created.token,
      publicKey: keys.publicKey,
      expectedStationId: 'ALMACEN-PTS',
      now: new Date('2026-07-23T12:02:00.000Z'),
      clockSkewSeconds: 5,
    });
    assert.equal(expired.valid, false);
    assert.equal(expired.code, 'expired');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
