import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
} from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const STATION_TOKEN_PREFIX = 'ISIVOLT:STATION:';

const asPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeStationId = (value) => {
  const stationId = String(value ?? '').trim();
  if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/i.test(stationId)) {
    throw new Error('STATION_ID debe contener entre 3 y 64 caracteres alfanuméricos, guion o guion bajo.');
  }
  return stationId;
};

export const ensureStationKeyPair = async (keyDirectory) => {
  const directory = path.resolve(keyDirectory);
  const privatePath = path.join(directory, 'station-private.pem');
  const publicJwkPath = path.join(directory, 'station-public.jwk.json');
  await mkdir(directory, { recursive: true, mode: 0o700 });

  let privateKey;
  try {
    privateKey = createPrivateKey(await readFile(privatePath, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    const pair = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    await writeFile(privatePath, pair.privateKey, { mode: 0o600, flag: 'wx' });
    await chmod(privatePath, 0o600);
    privateKey = createPrivateKey(pair.privateKey);
  }

  const publicKey = createPublicKey(privateKey);
  const publicJwk = publicKey.export({ format: 'jwk' });
  delete publicJwk.d;
  publicJwk.key_ops = ['verify'];
  publicJwk.ext = true;
  await writeFile(publicJwkPath, `${JSON.stringify(publicJwk, null, 2)}\n`, { mode: 0o644 });

  return {
    privateKey,
    publicKey,
    publicJwk,
    privatePath,
    publicJwkPath,
  };
};

export const createStationToken = ({
  stationId: rawStationId,
  privateKey,
  ttlSeconds = 45,
  now = new Date(),
  nonce = randomBytes(18).toString('base64url'),
}) => {
  const stationId = normalizeStationId(rawStationId);
  const lifetime = asPositiveInteger(ttlSeconds, 45);
  const issuedAt = new Date(now);
  const expiresAt = new Date(issuedAt.getTime() + lifetime * 1_000);
  const payload = {
    v: 1,
    stationId,
    nonce,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  const payloadSegment = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = sign('sha256', Buffer.from(payloadSegment, 'utf8'), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });

  return {
    token: `${STATION_TOKEN_PREFIX}${payloadSegment}.${signature.toString('base64url')}`,
    payload,
    payloadSegment,
  };
};

export const verifyStationToken = ({
  token,
  publicKey,
  expectedStationId,
  now = new Date(),
  clockSkewSeconds = 10,
  maxLifetimeSeconds = 90,
}) => {
  const normalized = String(token ?? '').trim();
  if (!normalized.startsWith(STATION_TOKEN_PREFIX)) {
    return { valid: false, code: 'invalid-format', message: 'Formato de token no reconocido.' };
  }

  const compact = normalized.slice(STATION_TOKEN_PREFIX.length);
  const [payloadSegment, signatureSegment, extra] = compact.split('.');
  if (!payloadSegment || !signatureSegment || extra !== undefined) {
    return { valid: false, code: 'invalid-format', message: 'Token de estación incompleto.' };
  }

  let payload;
  let signature;
  try {
    payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8'));
    signature = Buffer.from(signatureSegment, 'base64url');
  } catch {
    return { valid: false, code: 'invalid-format', message: 'Token de estación ilegible.' };
  }

  if (
    payload?.v !== 1
    || typeof payload.stationId !== 'string'
    || typeof payload.nonce !== 'string'
    || payload.nonce.length < 8
    || typeof payload.issuedAt !== 'string'
    || typeof payload.expiresAt !== 'string'
  ) {
    return { valid: false, code: 'invalid-payload', message: 'Contenido del token no válido.' };
  }

  const signatureValid = verify('sha256', Buffer.from(payloadSegment, 'utf8'), {
    key: publicKey,
    dsaEncoding: 'ieee-p1363',
  }, signature);
  if (!signatureValid) {
    return { valid: false, code: 'signature-invalid', message: 'Firma de estación no válida.' };
  }

  if (expectedStationId && payload.stationId !== expectedStationId) {
    return { valid: false, code: 'wrong-station', message: 'El token pertenece a otro punto de entrega.' };
  }

  const issuedAt = new Date(payload.issuedAt).getTime();
  const expiresAt = new Date(payload.expiresAt).getTime();
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) {
    return { valid: false, code: 'invalid-payload', message: 'Fechas del token no válidas.' };
  }

  const maxLifetime = asPositiveInteger(maxLifetimeSeconds, 90) * 1_000;
  if (expiresAt - issuedAt > maxLifetime) {
    return { valid: false, code: 'lifetime-too-long', message: 'Duración del token superior a la permitida.' };
  }

  const skew = asPositiveInteger(clockSkewSeconds, 10) * 1_000;
  const timestamp = new Date(now).getTime();
  if (timestamp < issuedAt - skew) {
    return { valid: false, code: 'not-yet-valid', message: 'El token todavía no es válido.' };
  }
  if (timestamp > expiresAt + skew) {
    return { valid: false, code: 'expired', message: 'El token ha caducado.' };
  }

  return { valid: true, payload, token: normalized };
};
