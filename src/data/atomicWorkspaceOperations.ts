import { submitAtomicOperation } from '../cloud/atomicOperations';
import { activeStorageKey, loadData, saveData } from '../storage';
import type {
  AppData,
  BatchOperation,
  BatchTransaction,
  IdentificationMethod,
  Movement,
  OperatorMode,
  ScanMethod,
  Tool,
} from '../types';
import { technicianCanReceiveTools } from './workspaceTransactions';

type WorkspaceLockManager = {
  request<T>(
    name: string,
    options: { mode: 'exclusive' },
    callback: () => Promise<T> | T,
  ): Promise<T>;
};

type WorkspaceNavigator = Navigator & { locks?: WorkspaceLockManager };

type OperationSuccess = {
  ok: true;
  data: AppData;
  value: BatchTransaction;
  message?: string;
};

type OperationFailure = {
  ok: false;
  data: AppData;
  message: string;
  invalidToolIds?: string[];
};

export type AtomicWorkspaceOperationResult = OperationSuccess | OperationFailure;

const uid = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const now = () => new Date().toISOString();

const toolIsLoanable = (tool: Tool): boolean => (
  tool.status === 'available' && (tool.serviceState ?? 'ready') === 'ready'
);

const executeLocked = async (callback: () => Promise<AtomicWorkspaceOperationResult>) => {
  const locks = (navigator as WorkspaceNavigator).locks;
  if (!locks) return callback();
  return locks.request(
    `isivoltpro-workspace:${activeStorageKey()}`,
    { mode: 'exclusive' },
    callback,
  );
};

export async function commitBatchOperation(input: {
  operation: BatchOperation;
  technicianId: string;
  toolIds: string[];
  operatorMode: OperatorMode;
  identificationMethod: IdentificationMethod;
  scanMethod: ScanMethod;
  startedAt: string;
}): Promise<AtomicWorkspaceOperationResult> {
  return executeLocked(async () => {
    const current = loadData();
    const technician = current.technicians.find((item) => item.id === input.technicianId);
    if (!technician) {
      return { ok: false, data: current, message: 'El técnico asociado a la operación ya no existe.' };
    }
    if (input.operation === 'loan' && !technicianCanReceiveTools(technician)) {
      return { ok: false, data: current, message: 'El técnico ya no está activo o disponible para recibir material.' };
    }

    const uniqueToolIds = [...new Set(input.toolIds.filter(Boolean))];
    if (uniqueToolIds.length === 0) {
      return { ok: false, data: current, message: 'No hay artículos para confirmar.' };
    }

    const toolById = new Map(current.tools.map((tool) => [tool.id, tool]));
    const invalidToolIds = uniqueToolIds.filter((id) => {
      const tool = toolById.get(id);
      if (!tool) return true;
      return input.operation === 'loan'
        ? !toolIsLoanable(tool)
        : tool.status !== 'loaned' || tool.technicianId !== technician.id;
    });
    if (invalidToolIds.length > 0) {
      const labels = invalidToolIds.map((id) => {
        const tool = toolById.get(id);
        return tool ? `${tool.code} · ${tool.name}` : id;
      });
      return {
        ok: false,
        data: current,
        invalidToolIds,
        message: `No se ha guardado la operación porque cambió el estado de: ${labels.join(', ')}. Revisa el lote.`,
      };
    }

    const completedAt = now();
    const batchId = uid('batch');
    const selectedTools = uniqueToolIds
      .map((id) => toolById.get(id))
      .filter((tool): tool is Tool => Boolean(tool));
    const batch: BatchTransaction = {
      id: batchId,
      operation: input.operation,
      technicianId: technician.id,
      toolIds: uniqueToolIds,
      operatorMode: input.operatorMode,
      identificationMethod: input.identificationMethod,
      scanMethod: input.scanMethod,
      startedAt: input.startedAt,
      completedAt,
    };
    const movements: Movement[] = selectedTools.map((tool) => ({
      id: uid('mov'),
      type: input.operation,
      occurredAt: completedAt,
      toolId: tool.id,
      technicianId: technician.id,
      batchId,
      identificationMethod: input.identificationMethod,
      scanMethod: input.scanMethod,
      detail: input.operation === 'loan'
        ? `${tool.name} asignada a ${technician.name}`
        : `${tool.name} devuelta por ${technician.name}`,
    }));

    const central = await submitAtomicOperation({ batch, movements });
    if (central.status === 'conflict' || central.status === 'rejected') {
      return { ok: false, data: loadData(), invalidToolIds: uniqueToolIds, message: central.message };
    }

    const latest = loadData();
    const latestToolById = new Map(latest.tools.map((tool) => [tool.id, tool]));
    const changedDuringRequest = uniqueToolIds.filter((id) => {
      const tool = latestToolById.get(id);
      if (!tool) return true;
      return input.operation === 'loan'
        ? !toolIsLoanable(tool)
        : tool.status !== 'loaned' || tool.technicianId !== technician.id;
    });
    if (changedDuringRequest.length > 0 && central.status !== 'confirmed') {
      return {
        ok: false,
        data: latest,
        invalidToolIds: changedDuringRequest,
        message: 'La operación cambió en otra pestaña antes de guardarse. Revisa el lote.',
      };
    }

    const data: AppData = {
      ...latest,
      tools: latest.tools.map((tool) => {
        if (!uniqueToolIds.includes(tool.id)) return tool;
        return input.operation === 'loan'
          ? { ...tool, status: 'loaned', technicianId: technician.id, updatedAt: completedAt }
          : { ...tool, status: 'available', technicianId: undefined, updatedAt: completedAt };
      }),
      movements: [...movements, ...latest.movements.filter((item) => !movements.some((movement) => movement.id === item.id))],
      batches: [batch, ...latest.batches.filter((item) => item.id !== batch.id)],
    };
    saveData(data);

    const message = central.status === 'pending'
      ? central.message
      : central.status === 'confirmed'
        ? 'Operación confirmada por el servidor central.'
        : undefined;
    return { ok: true, data, value: batch, message };
  });
}
