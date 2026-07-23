import type { StationPresenceConfig } from './config';

const PREFIX = 'ISIVOLT:STATION:';

export type StationTokenPayload = {
  v: 1;
  stationId: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
};

export type StationPass = StationTokenPayload & {
  token: string;
  verifiedAt: string;
};

export type StationVerificationResult =
  | { valid: true; pass: StationPass }
  | {
      valid: false;
      code:
        | 'station-disabled'
        | 'invalid-format'
        | 'invalid-payload'
        | 'wrong-station'
        | 'not-yet-valid'
        | 'expired'
        | 'lifetime-too-long'
        | 'signature-invalid'
        | 'crypto-unavailable';
      message: string;
    };

const decodeBase64Url = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = globalThis.atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const decodeText = (value: string): string =>
  new TextDecoder().decode(decodeBase64Url(value));

const isPayload = (value: unknown): value is StationTokenPayload => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StationTokenPayload>;
  return candidate.v === 1
    && typeof candidate.stationId === 'string'
    && candidate.stationId.length > 0
    && typeof candidate.nonce === 'string'
    && candidate.nonce.length >= 8
    && typeof candidate.issuedAt === 'string'
    && typeof candidate.expiresAt === 'string';
};

export const parseStationToken = (token: string) => {
  const normalized = token.trim();
  if (!normalized.startsWith(PREFIX)) return null;
  const compact = normalized.slice(PREFIX.length);
  const [payloadSegment, signatureSegment, extra] = compact.split('.');
  if (!payloadSegment || !signatureSegment || extra !== undefined) return null;

  try {
    const payload = JSON.parse(decodeText(payloadSegment)) as unknown;
    if (!isPayload(payload)) return null;
    return {
      token: normalized,
      payload,
      payloadSegment,
      signature: decodeBase64Url(signatureSegment),
    };
  } catch {
    return null;
  }
};

export const validateStationPayload = (
  payload: StationTokenPayload,
  config: Extract<StationPresenceConfig, { enabled: true }>,
  now = new Date(),
): Exclude<StationVerificationResult, { valid: true }> | null => {
  if (payload.stationId !== config.stationId) {
    return {
      valid: false,
      code: 'wrong-station',
      message: `El QR pertenece a otro punto de entrega (${payload.stationId}).`,
    };
  }

  const issuedAt = new Date(payload.issuedAt).getTime();
  const expiresAt = new Date(payload.expiresAt).getTime();
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) {
    return { valid: false, code: 'invalid-payload', message: 'El QR de estación contiene fechas no válidas.' };
  }

  const lifetimeSeconds = (expiresAt - issuedAt) / 1_000;
  if (lifetimeSeconds > config.maxTokenLifetimeSeconds) {
    return {
      valid: false,
      code: 'lifetime-too-long',
      message: 'El QR de estación tiene una duración superior a la permitida.',
    };
  }

  const skew = config.clockSkewSeconds * 1_000;
  if (now.getTime() < issuedAt - skew) {
    return { valid: false, code: 'not-yet-valid', message: 'El QR todavía no es válido. Revisa la hora del dispositivo.' };
  }
  if (now.getTime() > expiresAt + skew) {
    return { valid: false, code: 'expired', message: 'El QR ha caducado. Escanea el código nuevo del mini PC.' };
  }

  return null;
};

export const verifyStationToken = async (
  token: string,
  config: StationPresenceConfig,
  now = new Date(),
): Promise<StationVerificationResult> => {
  if (!config.enabled) {
    return { valid: false, code: 'station-disabled', message: 'El punto de entrega no está configurado.' };
  }

  const parsed = parseStationToken(token);
  if (!parsed) {
    return { valid: false, code: 'invalid-format', message: 'Este código no es un QR válido del punto de entrega.' };
  }

  const payloadError = validateStationPayload(parsed.payload, config, now);
  if (payloadError) return payloadError;

  if (!globalThis.crypto?.subtle) {
    return { valid: false, code: 'crypto-unavailable', message: 'Este dispositivo no puede verificar la firma del punto de entrega.' };
  }

  try {
    const publicKey = await globalThis.crypto.subtle.importKey(
      'jwk',
      config.publicKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const valid = await globalThis.crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      parsed.signature,
      new TextEncoder().encode(parsed.payloadSegment),
    );
    if (!valid) {
      return { valid: false, code: 'signature-invalid', message: 'La firma del QR no pertenece al mini PC autorizado.' };
    }

    return {
      valid: true,
      pass: {
        ...parsed.payload,
        token: parsed.token,
        verifiedAt: now.toISOString(),
      },
    };
  } catch {
    return { valid: false, code: 'signature-invalid', message: 'No se ha podido comprobar la firma del QR de estación.' };
  }
};
