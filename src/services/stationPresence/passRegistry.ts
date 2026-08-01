import type { StationPass } from './token';

const passes = new Map<string, StationPass>();

const active = (pass: StationPass, now = new Date()) =>
  now.getTime() <= new Date(pass.expiresAt).getTime();

export const registerStationPass = (operationId: string, pass: StationPass) => {
  passes.set(operationId, pass);
};

export const consumeStationPass = (operationId: string, now = new Date()): StationPass | null => {
  const pass = passes.get(operationId);
  passes.delete(operationId);
  return pass && active(pass, now) ? pass : null;
};

export const clearStationPass = (operationId: string) => {
  passes.delete(operationId);
};

export const resetStationPassRegistryForTests = () => {
  passes.clear();
};
