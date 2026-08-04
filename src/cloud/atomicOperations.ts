import type { BatchTransaction, Movement } from '../types';
import { getCloudProfile, getPocketBaseToken, getPocketBaseUrl } from './config';
import { pocketBaseRequest, PocketBaseRequestError } from './pocketbaseClient';

export type AtomicToolSnapshot = {
  external_id: string;
  code: string;
  name: string;
  status: string;
  technician_external_id: string;
  service_state: string;
  source_updated: string;
};

export type AtomicOperationResponse = {
  ok: true;
  duplicate: boolean;
  batch_external_id: string;
  tools: AtomicToolSnapshot[];
};

export type AtomicOperationResult =
  | { status: 'local' }
  | { status: 'confirmed'; response: AtomicOperationResponse }
  | { status: 'pending'; message: string }
  | { status: 'conflict'; message: string }
  | { status: 'rejected'; message: string };

export type AtomicOperationPayload = {
  batch: BatchTransaction;
  movements: Movement[];
};

const movementPayload = (movement: Movement) => ({
  external_id: movement.id,
  tool_external_id: movement.toolId ?? '',
  detail: movement.detail,
});

export async function submitAtomicOperation(
  payload: AtomicOperationPayload,
  options: { requireCloud?: boolean } = {},
): Promise<AtomicOperationResult> {
  const profile = getCloudProfile();
  const token = getPocketBaseToken();
  const url = getPocketBaseUrl();
  if (!profile || !token || !url) {
    return options.requireCloud
      ? { status: 'pending', message: 'La operación queda pendiente hasta conectar con el servidor central.' }
      : { status: 'local' };
  }

  try {
    const response = await pocketBaseRequest<AtomicOperationResponse>('/api/isivolt/operations', {
      method: 'POST',
      body: JSON.stringify({
        batch_external_id: payload.batch.id,
        operation: payload.batch.operation,
        technician_external_id: payload.batch.technicianId,
        tool_ids: payload.batch.toolIds,
        operator_mode: payload.batch.operatorMode,
        identification_method: payload.batch.identificationMethod,
        scan_method: payload.batch.scanMethod,
        started_at: payload.batch.startedAt,
        completed_at: payload.batch.completedAt,
        movements: payload.movements.map(movementPayload),
      }),
    });
    return { status: 'confirmed', response };
  } catch (error) {
    if (!(error instanceof PocketBaseRequestError)) {
      return { status: 'pending', message: 'No se pudo contactar con el servidor central.' };
    }
    if (error.status === 0 || error.status === 404) {
      return {
        status: 'pending',
        message: error.status === 404
          ? 'La operación queda pendiente: faltan datos centrales o el servidor necesita actualizarse.'
          : 'Sin conexión. La operación se guardará localmente y se validará al recuperar la red.',
      };
    }
    if (error.status === 409) return { status: 'conflict', message: error.message };
    return { status: 'rejected', message: error.message };
  }
}
