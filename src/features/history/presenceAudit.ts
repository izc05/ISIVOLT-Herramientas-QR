import type { Movement } from '../../domain/types';

export type PresenceFilter = 'all' | 'verified' | 'without-proof' | 'not-applicable';
export type MovementPresenceState = 'verified' | 'missing' | 'partial' | 'not-applicable';

export const isPhysicalMovement = (movement: Movement): boolean =>
  movement.type === 'delivery' || movement.type === 'return' || movement.type === 'incident';

export const getMovementPresenceState = (movement: Movement): MovementPresenceState => {
  if (!isPhysicalMovement(movement)) return 'not-applicable';

  const fields = [movement.stationId, movement.stationNonce, movement.stationVerifiedAt];
  const completed = fields.filter((value) => typeof value === 'string' && value.trim().length > 0).length;
  if (completed === 3) return 'verified';
  if (completed === 0) return 'missing';
  return 'partial';
};

export const matchesPresenceFilter = (
  movement: Movement,
  filter: PresenceFilter,
): boolean => {
  if (filter === 'all') return true;
  const state = getMovementPresenceState(movement);
  if (filter === 'verified') return state === 'verified';
  if (filter === 'without-proof') return state === 'missing' || state === 'partial';
  return state === 'not-applicable';
};

export const presenceLabel = (movement: Movement): string => {
  const state = getMovementPresenceState(movement);
  if (state === 'verified') return 'Presencia validada';
  if (state === 'partial') return 'Evidencia presencial incompleta';
  if (state === 'missing') return 'Sin evidencia presencial';
  return 'No aplica';
};
