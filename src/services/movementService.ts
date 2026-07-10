import { Capacitor } from '@capacitor/core';
import {
  applyMovementCommand,
  type MovementCommand,
  type MovementEngineResult,
} from '../domain/movementEngine';
import { getDeviceId } from './deviceIdentity';
import { loadAppData, saveAppData } from './storage';
import { readNativeAppData, writeNativeAppData } from './nativeDatabase';

export type ExecuteMovementOptions = {
  source?: 'manual' | 'qr' | 'system';
};

export const executeMovement = async (
  command: MovementCommand,
  _options: ExecuteMovementOptions = {},
): Promise<MovementEngineResult> => {
  const native = Capacitor.isNativePlatform();
  const current = native
    ? await readNativeAppData() ?? loadAppData()
    : loadAppData();
  const deviceId = native ? await getDeviceId() : undefined;

  const result = applyMovementCommand(current, command);
  const movements = result.movements.map((movement) => ({
    ...movement,
    deviceId: movement.deviceId ?? deviceId,
    syncStatus: movement.syncStatus ?? 'local' as const,
  }));
  const movementIds = new Set(movements.map((movement) => movement.id));
  const data = {
    ...result.data,
    movements: result.data.movements.map((movement) =>
      movementIds.has(movement.id)
        ? movements.find((candidate) => candidate.id === movement.id) ?? movement
        : movement,
    ),
  };

  if (native) {
    await writeNativeAppData(data);
  }

  saveAppData(data);
  return { ...result, data, movements };
};

export const canUseToolCode = (code: string, exceptToolId?: string) => {
  const normalized = code.trim().toUpperCase();
  return !loadAppData().tools.some(
    (tool) => tool.id !== exceptToolId && tool.code.trim().toUpperCase() === normalized,
  );
};

export const canUseTechnicianCode = (code: string, exceptTechnicianId?: string) => {
  const normalized = code.trim().toUpperCase();
  return !loadAppData().technicians.some(
    (technician) => technician.id !== exceptTechnicianId
      && technician.code.trim().toUpperCase() === normalized,
  );
};
