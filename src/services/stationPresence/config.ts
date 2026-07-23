export type StationPresenceConfig =
  | {
      enabled: false;
      reason: 'disabled' | 'missing-station-id' | 'missing-public-key' | 'invalid-public-key';
      stationId?: string;
    }
  | {
      enabled: true;
      stationId: string;
      publicKey: JsonWebKey;
      clockSkewSeconds: number;
      maxTokenLifetimeSeconds: number;
    };

const clean = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const positiveInteger = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parsePublicKey = (raw: string | undefined): JsonWebKey | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as JsonWebKey;
    if (
      parsed.kty !== 'EC'
      || parsed.crv !== 'P-256'
      || typeof parsed.x !== 'string'
      || typeof parsed.y !== 'string'
    ) {
      return null;
    }
    return { ...parsed, key_ops: ['verify'], ext: true };
  } catch {
    return null;
  }
};

export const resolveStationPresenceConfig = (
  environment: Record<string, unknown>,
): StationPresenceConfig => {
  const mode = clean(environment.VITE_ISIVOLT_STATION_MODE)?.toLowerCase();
  if (mode !== 'signed-qr') return { enabled: false, reason: 'disabled' };

  const stationId = clean(environment.VITE_ISIVOLT_STATION_ID);
  if (!stationId) return { enabled: false, reason: 'missing-station-id' };

  const publicKeyRaw = clean(environment.VITE_ISIVOLT_STATION_PUBLIC_KEY_JWK);
  if (!publicKeyRaw) return { enabled: false, reason: 'missing-public-key', stationId };

  const publicKey = parsePublicKey(publicKeyRaw);
  if (!publicKey) return { enabled: false, reason: 'invalid-public-key', stationId };

  return {
    enabled: true,
    stationId,
    publicKey,
    clockSkewSeconds: positiveInteger(environment.VITE_ISIVOLT_STATION_CLOCK_SKEW_SECONDS, 10),
    maxTokenLifetimeSeconds: positiveInteger(environment.VITE_ISIVOLT_STATION_MAX_TOKEN_SECONDS, 90),
  };
};

export const getStationPresenceConfig = (): StationPresenceConfig =>
  resolveStationPresenceConfig(import.meta.env as unknown as Record<string, unknown>);
