import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createStationRequestHandler } from '../src/server.mjs';
import { StationRedemptionStore, StationTokenIssuer } from '../src/station.mjs';
import { ensureStationKeyPair } from '../src/token.mjs';

test('sirve QR y consume cada nonce una sola vez', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'isivolt-station-server-'));
  const auditPath = path.join(directory, 'audit', 'redemptions.jsonl');
  const keys = await ensureStationKeyPair(path.join(directory, 'keys'));
  const config = {
    stationId: 'ALMACEN-PTS',
    allowedOrigins: new Set(['https://izc05.github.io']),
    tlsCertificate: undefined,
    tlsPrivateKey: undefined,
  };
  const issuer = new StationTokenIssuer({
    stationId: config.stationId,
    privateKey: keys.privateKey,
    ttlSeconds: 60,
    rotationSeconds: 30,
  });
  const redemptionStore = new StationRedemptionStore({
    stationId: config.stationId,
    publicKey: keys.publicKey,
    auditPath,
    clockSkewSeconds: 10,
    maxLifetimeSeconds: 90,
  });
  const server = createServer(createStationRequestHandler({
    config,
    issuer,
    redemptionStore,
    publicJwk: keys.publicJwk,
  }));

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    assert.equal(typeof address, 'object');
    const base = `http://127.0.0.1:${address.port}`;

    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).stationId, 'ALMACEN-PTS');

    const tokenResponse = await fetch(`${base}/api/token`, {
      headers: { Origin: 'https://izc05.github.io' },
    });
    assert.equal(tokenResponse.status, 200);
    assert.equal(tokenResponse.headers.get('access-control-allow-origin'), 'https://izc05.github.io');
    const tokenData = await tokenResponse.json();
    assert.ok(tokenData.token.startsWith('ISIVOLT:STATION:'));

    const qr = await fetch(`${base}/qr.svg`);
    assert.equal(qr.status, 200);
    assert.match(await qr.text(), /<svg/);

    const redeem = async (operationId) => fetch(`${base}/api/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://izc05.github.io',
      },
      body: JSON.stringify({ token: tokenData.token, operationId }),
    });

    const first = await redeem('operation-1');
    assert.equal(first.status, 200);
    assert.equal((await first.json()).accepted, true);

    const repeated = await redeem('operation-1');
    assert.equal(repeated.status, 409);
    assert.equal((await repeated.json()).code, 'already-redeemed');

    const stolen = await redeem('operation-2');
    assert.equal(stolen.status, 409);
    assert.equal((await stolen.json()).code, 'nonce-reused');

    const audit = (await readFile(auditPath, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(audit[0].result, 'accepted');
    assert.equal(audit[1].result, 'already-redeemed');
    assert.equal(audit[2].result, 'nonce-reused');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
