import type { AppData, Movement } from '../../domain/types';
import {
  getStationPresenceConfig,
  type StationPresenceConfig,
} from './config';
import { consumeStationPass } from './passRegistry';

export class StationPresenceRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StationPresenceRequiredError';
  }
}

const configurationError = (config: Extract<StationPresenceConfig, { enabled: false }>) => {
  if (config.reason === 'missing-station-id') return 'El modo presencial está activo, pero falta identificar el punto de almacén.';
  if (config.reason === 'missing-public-key') return 'El modo presencial está activo, pero falta la clave pública del mini PC.';
  if (config.reason === 'invalid-public-key') return 'La clave pública del punto de almacén no es válida.';
  return 'El punto de almacén no está disponible.';
};

const physicalMovement = (movement: Movement) =>
  movement.type === 'delivery' || movement.type === 'return' || movement.type === 'incident';

export const attachStationProofToNewMovements = (
  previous: AppData | null,
  next: AppData,
  config: StationPresenceConfig = getStationPresenceConfig(),
): AppData => {
  if (!previous) return next;
  if (!config.enabled) {
    if (config.reason === 'disabled') return next;
    throw new StationPresenceRequiredError(configurationError(config));
  }

  const previousIds = new Set(previous.movements.map((movement) => movement.id));
  const newPhysicalMovements = next.movements.filter(
    (movement) => !previousIds.has(movement.id) && physicalMovement(movement),
  );
  if (newPhysicalMovements.length === 0) return next;

  const operationIds = new Set<string>();
  for (const movement of newPhysicalMovements) {
    if (!movement.operationId) {
      throw new StationPresenceRequiredError('La operación física no tiene identificador y no puede validar su presencia.');
    }
    operationIds.add(movement.operationId);
  }

  const proofByOperation = new Map<string, ReturnType<typeof consumeStationPass>>();
  for (const operationId of operationIds) {
    const pass = consumeStationPass(operationId);
    if (!pass) {
      throw new StationPresenceRequiredError(
        `La operación ${operationId} necesita escanear de nuevo el QR vigente del punto ${config.stationId}.`,
      );
    }
    proofByOperation.set(operationId, pass);
  }

  return {
    ...next,
    movements: next.movements.map((movement) => {
      if (previousIds.has(movement.id) || !physicalMovement(movement) || !movement.operationId) return movement;
      const pass = proofByOperation.get(movement.operationId);
      if (!pass) return movement;
      return {
        ...movement,
        stationId: pass.stationId,
        stationNonce: pass.nonce,
        stationVerifiedAt: pass.verifiedAt,
      };
    }),
  };
};
