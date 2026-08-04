import { activeStorageKey, loadData, saveData } from '../storage';
import type {
  AppData,
  BatchOperation,
  BatchTransaction,
  IdentificationMethod,
  OperatorMode,
  ScanMethod,
  Technician,
  Tool,
} from '../types';

type WorkspaceLockManager = {
  request<T>(
    name: string,
    options: { mode: 'exclusive' },
    callback: () => Promise<T> | T,
  ): Promise<T>;
};

type WorkspaceNavigator = Navigator & { locks?: WorkspaceLockManager };

type MutationSuccess<T> = { ok: true; data: AppData; value: T };
type MutationFailure = {
  ok: false;
  data: AppData;
  message: string;
  invalidToolIds?: string[];
};
export type WorkspaceTransactionResult<T> = MutationSuccess<T> | MutationFailure;

type MutationDecision<T> =
  | { ok: true; data: AppData; value: T }
  | { ok: false; message: string; invalidToolIds?: string[] };

const uid = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const now = () => new Date().toISOString();

const nextCode = (items: Array<{ code: string }>, prefix: string): string => {
  const highest = items.reduce((max, item) => {
    if (!item.code.startsWith(`${prefix}-`)) return max;
    const number = Number(item.code.split('-').at(-1));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(3, '0')}`;
};

const technicianIsOperational = (technician: Technician): boolean => {
  const status = technician.status ?? (technician.active ? 'active' : 'inactive');
  return technician.active && status === 'active';
};

const toolIsLoanable = (tool: Tool): boolean => (
  tool.status === 'available' && (tool.serviceState ?? 'ready') === 'ready'
);

async function mutateWorkspace<T>(
  mutation: (current: AppData) => MutationDecision<T>,
): Promise<WorkspaceTransactionResult<T>> {
  const execute = async (): Promise<WorkspaceTransactionResult<T>> => {
    const current = loadData();
    const decision = mutation(current);
    if (!decision.ok) return { ...decision, data: current };
    saveData(decision.data);
    return decision;
  };

  try {
    const locks = (navigator as WorkspaceNavigator).locks;
    if (locks) {
      return await locks.request(
        `isivoltpro-workspace:${activeStorageKey()}`,
        { mode: 'exclusive' },
        execute,
      );
    }
    return await execute();
  } catch (error) {
    return {
      ok: false,
      data: loadData(),
      message: error instanceof Error
        ? `No se pudo guardar la operación: ${error.message}`
        : 'No se pudo guardar la operación.',
    };
  }
}

export async function createToolRecord(input: {
  name: string;
  category: string;
  location: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  prefix: string;
}): Promise<WorkspaceTransactionResult<Tool>> {
  return mutateWorkspace((current) => {
    const name = input.name.trim();
    if (!name) return { ok: false, message: 'Indica el nombre de la herramienta.' };
    const timestamp = now();
    const code = nextCode(current.tools, input.prefix || 'HER');
    const tool: Tool = {
      id: uid('tool'),
      code,
      name,
      category: input.category.trim() || 'Sin categoría',
      location: input.location.trim() || 'Sin ubicación',
      brand: input.brand?.trim() || undefined,
      model: input.model?.trim() || undefined,
      serialNumber: input.serialNumber?.trim() || undefined,
      kind: 'returnable-tool',
      serviceState: 'ready',
      qrPayload: `ISIVOLTPRO:TOOL:${code}`,
      status: 'available',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const data: AppData = {
      ...current,
      tools: [tool, ...current.tools],
      movements: [{
        id: uid('mov'),
        type: 'tool_created',
        occurredAt: timestamp,
        toolId: tool.id,
        detail: `${tool.name} · ${tool.code}`,
      }, ...current.movements],
    };
    return { ok: true, data, value: tool };
  });
}

export async function createTechnicianRecord(input: {
  name: string;
  category: string;
  phone?: string;
  email?: string;
}): Promise<WorkspaceTransactionResult<Technician>> {
  return mutateWorkspace((current) => {
    const name = input.name.trim();
    if (!name) return { ok: false, message: 'Indica el nombre del técnico.' };
    const timestamp = now();
    const code = nextCode(current.technicians, 'TEC');
    const technician: Technician = {
      id: uid('tech'),
      code,
      name,
      category: input.category.trim() || 'Sin categoría',
      phone: input.phone?.trim() || undefined,
      email: input.email?.trim() || undefined,
      status: 'active',
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const data: AppData = {
      ...current,
      technicians: [technician, ...current.technicians],
      movements: [{
        id: uid('mov'),
        type: 'technician_created',
        occurredAt: timestamp,
        technicianId: technician.id,
        detail: `${technician.name} · ${technician.code}`,
      }, ...current.movements],
    };
    return { ok: true, data, value: technician };
  });
}

export async function createQuickToolRecord(input: {
  code: string;
  name: string;
  categoryId: string;
  locationId?: string;
}): Promise<WorkspaceTransactionResult<Tool>> {
  return mutateWorkspace((current) => {
    const code = input.code.trim().toLocaleUpperCase('es-ES');
    const name = input.name.trim();
    const category = (current.toolCategories ?? []).find((entry) => entry.id === input.categoryId && entry.active);
    const location = input.locationId
      ? (current.locations ?? []).find((entry) => entry.id === input.locationId && entry.active)
      : undefined;
    if (!code || !name || !category) {
      return { ok: false, message: 'Código, nombre y categoría activa son obligatorios.' };
    }
    if (input.locationId && !location) {
      return { ok: false, message: 'La ubicación seleccionada ya no está disponible.' };
    }
    if (current.tools.some((tool) => tool.code.toLocaleUpperCase('es-ES') === code)) {
      return { ok: false, message: `El código ${code} ya está registrado.` };
    }
    const timestamp = now();
    const tool: Tool = {
      id: uid('tool'),
      code,
      name,
      category: category.name,
      categoryId: category.id,
      location: location?.name ?? 'Sin ubicación',
      locationId: location?.id,
      kind: 'returnable-tool',
      serviceState: 'ready',
      qrPayload: `ISIVOLTPRO:TOOL:${code}`,
      status: 'available',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const data: AppData = { ...current, tools: [tool, ...current.tools] };
    return { ok: true, data, value: tool };
  });
}

export async function linkToolNfc(
  toolId: string,
  tag: string,
): Promise<WorkspaceTransactionResult<Tool>> {
  return mutateWorkspace((current) => {
    const normalizedTag = tag.trim();
    if (!normalizedTag) return { ok: false, message: 'Indica la referencia de la etiqueta NFC.' };
    const tool = current.tools.find((item) => item.id === toolId);
    if (!tool) return { ok: false, message: 'La herramienta ya no existe.' };
    const comparable = normalizedTag.toLocaleUpperCase('es-ES');
    const duplicateTool = current.tools.find((item) => (
      item.id !== tool.id && item.nfcTag?.trim().toLocaleUpperCase('es-ES') === comparable
    ));
    const duplicateTechnician = current.technicians.find((item) => (
      item.nfcTag?.trim().toLocaleUpperCase('es-ES') === comparable
    ));
    if (duplicateTool || duplicateTechnician) {
      const owner = duplicateTool
        ? `${duplicateTool.code} · ${duplicateTool.name}`
        : `${duplicateTechnician?.code} · ${duplicateTechnician?.name}`;
      return { ok: false, message: `La etiqueta NFC ya está vinculada a ${owner}.` };
    }
    const timestamp = now();
    const updated: Tool = { ...tool, nfcTag: normalizedTag, updatedAt: timestamp };
    const data: AppData = {
      ...current,
      tools: current.tools.map((item) => item.id === tool.id ? updated : item),
      movements: [{
        id: uid('mov'),
        type: 'nfc_linked',
        occurredAt: timestamp,
        toolId: tool.id,
        detail: `${tool.name} · ${normalizedTag}`,
      }, ...current.movements],
    };
    return { ok: true, data, value: updated };
  });
}

export async function commitBatchOperation(input: {
  operation: BatchOperation;
  technicianId: string;
  toolIds: string[];
  operatorMode: OperatorMode;
  identificationMethod: IdentificationMethod;
  scanMethod: ScanMethod;
  startedAt: string;
}): Promise<WorkspaceTransactionResult<BatchTransaction>> {
  return mutateWorkspace((current) => {
    const technician = current.technicians.find((item) => item.id === input.technicianId);
    if (!technician || !technicianIsOperational(technician)) {
      return { ok: false, message: 'El técnico ya no está activo o disponible para recibir material.' };
    }
    const uniqueToolIds = [...new Set(input.toolIds.filter(Boolean))];
    if (uniqueToolIds.length === 0) return { ok: false, message: 'No hay artículos para confirmar.' };

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
        invalidToolIds,
        message: `No se ha guardado la operación porque cambió el estado de: ${labels.join(', ')} . Revisa el lote.`,
      };
    }

    const completedAt = now();
    const batchId = uid('batch');
    const selectedTools = uniqueToolIds.map((id) => toolById.get(id)).filter((tool): tool is Tool => Boolean(tool));
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
    const data: AppData = {
      ...current,
      tools: current.tools.map((tool) => {
        if (!uniqueToolIds.includes(tool.id)) return tool;
        return input.operation === 'loan'
          ? { ...tool, status: 'loaned', technicianId: technician.id, updatedAt: completedAt }
          : { ...tool, status: 'available', technicianId: undefined, updatedAt: completedAt };
      }),
      movements: [
        ...selectedTools.map((tool) => ({
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
        } as const)),
        ...current.movements,
      ],
      batches: [batch, ...current.batches],
    };
    return { ok: true, data, value: batch };
  });
}
