import type { StationPresenceConfig } from './config';
import type { StationPass } from './token';

export type StationRedemptionResult =
  | { accepted: true; required: false }
  | {
      accepted: true;
      required: true;
      stationId: string;
      nonce: string;
      operationId: string;
      verifiedAt: string;
    }
  | {
      accepted: false;
      required: true;
      code: string;
      message: string;
    };

const parseJson = async (response: Response): Promise<Record<string, unknown>> => {
  try {
    const value = await response.json() as unknown;
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

export const redeemStationPass = async (
  pass: StationPass,
  operationId: string,
  config: Extract<StationPresenceConfig, { enabled: true }>,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<StationRedemptionResult> => {
  if (!config.redeemUrl) return { accepted: true, required: false };
  if (typeof fetcher !== 'function') {
    return {
      accepted: false,
      required: true,
      code: 'network-unavailable',
      message: 'Este dispositivo no puede contactar con el punto de almacén.',
    };
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetcher(config.redeemUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: pass.token, operationId }),
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
    });
    const body = await parseJson(response);
    if (!response.ok || body.accepted !== true) {
      return {
        accepted: false,
        required: true,
        code: typeof body.code === 'string' ? body.code : `http-${response.status}`,
        message: typeof body.message === 'string'
          ? body.message
          : 'El mini PC ha rechazado este pase presencial.',
      };
    }

    if (
      body.stationId !== pass.stationId
      || body.nonce !== pass.nonce
      || body.operationId !== operationId
      || typeof body.verifiedAt !== 'string'
    ) {
      return {
        accepted: false,
        required: true,
        code: 'response-mismatch',
        message: 'La respuesta del punto de almacén no coincide con la operación preparada.',
      };
    }

    return {
      accepted: true,
      required: true,
      stationId: body.stationId,
      nonce: body.nonce,
      operationId: body.operationId,
      verifiedAt: body.verifiedAt,
    };
  } catch (error) {
    return {
      accepted: false,
      required: true,
      code: error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network-error',
      message: error instanceof DOMException && error.name === 'AbortError'
        ? 'El mini PC no respondió dentro del tiempo permitido.'
        : 'No se ha podido contactar con el mini PC. Comprueba la red del almacén.',
    };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};
