import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createStationToken, verifyStationToken } from './token.mjs';

const positiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export class StationTokenIssuer {
  constructor({ stationId, privateKey, ttlSeconds = 45, rotationSeconds = 30 }) {
    this.stationId = stationId;
    this.privateKey = privateKey;
    this.ttlSeconds = positiveInteger(ttlSeconds, 45);
    this.rotationSeconds = positiveInteger(rotationSeconds, 30);
    this.currentBucket = null;
    this.currentToken = null;
  }

  issue(now = new Date()) {
    const bucket = Math.floor(new Date(now).getTime() / (this.rotationSeconds * 1_000));
    if (this.currentBucket !== bucket || !this.currentToken) {
      this.currentBucket = bucket;
      this.currentToken = createStationToken({
        stationId: this.stationId,
        privateKey: this.privateKey,
        ttlSeconds: this.ttlSeconds,
        now,
      });
    }
    return {
      ...this.currentToken,
      rotationSeconds: this.rotationSeconds,
      serverTime: new Date(now).toISOString(),
    };
  }
}

export class StationRedemptionStore {
  constructor({
    stationId,
    publicKey,
    auditPath,
    clockSkewSeconds = 10,
    maxLifetimeSeconds = 90,
  }) {
    this.stationId = stationId;
    this.publicKey = publicKey;
    this.auditPath = path.resolve(auditPath);
    this.clockSkewSeconds = positiveInteger(clockSkewSeconds, 10);
    this.maxLifetimeSeconds = positiveInteger(maxLifetimeSeconds, 90);
    this.redeemed = new Map();
  }

  purge(now = new Date()) {
    const timestamp = new Date(now).getTime();
    for (const [nonce, record] of this.redeemed.entries()) {
      if (new Date(record.expiresAt).getTime() + 60_000 < timestamp) {
        this.redeemed.delete(nonce);
      }
    }
  }

  async audit(entry) {
    await mkdir(path.dirname(this.auditPath), { recursive: true });
    await appendFile(this.auditPath, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
  }

  async redeem({ token, operationId, clientIp, userAgent, now = new Date() }) {
    const normalizedOperationId = String(operationId ?? '').trim();
    if (!normalizedOperationId || normalizedOperationId.length > 180) {
      const result = { accepted: false, code: 'invalid-operation', message: 'operationId no válido.' };
      await this.audit({
        occurredAt: new Date(now).toISOString(),
        stationId: this.stationId,
        operationId: normalizedOperationId || null,
        clientIp,
        userAgent,
        result: result.code,
      });
      return result;
    }

    const verification = verifyStationToken({
      token,
      publicKey: this.publicKey,
      expectedStationId: this.stationId,
      now,
      clockSkewSeconds: this.clockSkewSeconds,
      maxLifetimeSeconds: this.maxLifetimeSeconds,
    });
    if (!verification.valid) {
      await this.audit({
        occurredAt: new Date(now).toISOString(),
        stationId: this.stationId,
        operationId: normalizedOperationId,
        clientIp,
        userAgent,
        result: verification.code,
      });
      return { accepted: false, code: verification.code, message: verification.message };
    }

    this.purge(now);
    const existing = this.redeemed.get(verification.payload.nonce);
    if (existing) {
      const sameOperation = existing.operationId === normalizedOperationId;
      const result = {
        accepted: false,
        code: sameOperation ? 'already-redeemed' : 'nonce-reused',
        message: sameOperation
          ? 'Este pase ya fue consumido para la misma operación.'
          : 'Este pase ya fue utilizado por otra operación.',
      };
      await this.audit({
        occurredAt: new Date(now).toISOString(),
        stationId: this.stationId,
        nonce: verification.payload.nonce,
        operationId: normalizedOperationId,
        previousOperationId: existing.operationId,
        clientIp,
        userAgent,
        result: result.code,
      });
      return result;
    }

    const record = {
      stationId: this.stationId,
      nonce: verification.payload.nonce,
      operationId: normalizedOperationId,
      issuedAt: verification.payload.issuedAt,
      expiresAt: verification.payload.expiresAt,
      verifiedAt: new Date(now).toISOString(),
      clientIp,
      userAgent,
    };
    this.redeemed.set(record.nonce, record);
    await this.audit({ ...record, occurredAt: record.verifiedAt, result: 'accepted' });

    return {
      accepted: true,
      code: 'accepted',
      stationId: record.stationId,
      nonce: record.nonce,
      operationId: record.operationId,
      verifiedAt: record.verifiedAt,
      expiresAt: record.expiresAt,
    };
  }
}
