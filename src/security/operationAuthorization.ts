import type { AppData, Technician } from '../domain/types';
import { hasPermission } from './permissions';
import type { SecurityUser } from './types';

let trustedRemoteDepth = 0;

export type OperationAuthorizationCode =
  | 'operation-not-allowed'
  | 'technician-link-required'
  | 'technician-link-invalid'
  | 'technician-identity-mismatch';

export class OperationAuthorizationError extends Error {
  constructor(
    public readonly code: OperationAuthorizationCode,
    message: string,
  ) {
    super(message);
    this.name = 'OperationAuthorizationError';
  }
}

export const isTrustedRemoteChange = () => trustedRemoteDepth > 0;

export const runTrustedRemoteChange = <T,>(change: () => T): T => {
  trustedRemoteDepth += 1;
  try {
    return change();
  } finally {
    trustedRemoteDepth = Math.max(0, trustedRemoteDepth - 1);
  }
};

export const resolveLinkedTechnician = (
  data: AppData,
  user: SecurityUser | null,
): Technician | null => {
  if (!user?.active || user.role !== 'technician') return null;
  if (!user.technicianId) {
    throw new OperationAuthorizationError(
      'technician-link-required',
      'Tu usuario técnico no está vinculado a una ficha de técnico. Solicita al administrador que complete la vinculación.',
    );
  }

  const technician = data.technicians.find((item) => item.id === user.technicianId);
  if (!technician?.active) {
    throw new OperationAuthorizationError(
      'technician-link-invalid',
      'La ficha técnica vinculada no existe o está inactiva. No se pueden registrar movimientos.',
    );
  }
  return technician;
};

export const assertAuthorizedDataChange = (
  previous: AppData | null,
  next: AppData,
  user: SecurityUser | null,
): void => {
  if (isTrustedRemoteChange() || !user?.active || !previous) return;

  const previousMovementIds = new Set(previous.movements.map((movement) => movement.id));
  const newMovements = next.movements.filter((movement) => !previousMovementIds.has(movement.id));
  if (newMovements.length === 0) return;

  if (!hasPermission('operations.execute', user)) {
    throw new OperationAuthorizationError(
      'operation-not-allowed',
      'Tu perfil es de consulta y no puede registrar préstamos, devoluciones ni ajustes.',
    );
  }

  if (user.role !== 'technician') return;
  const linkedTechnician = resolveLinkedTechnician(next, user);
  const mismatched = newMovements.find((movement) => movement.technicianId !== linkedTechnician?.id);
  if (mismatched) {
    throw new OperationAuthorizationError(
      'technician-identity-mismatch',
      `Un técnico solo puede registrar movimientos a su propio nombre (${linkedTechnician?.name}).`,
    );
  }
};
