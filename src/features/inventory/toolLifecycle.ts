import type {
  AppData,
  MaintenanceRecord,
  Movement,
  Tool,
  ToolServiceStatus,
  ToolStatus,
} from '../../domain/types';

export type ToolLifecycleKey = 'available' | 'loaned' | 'review' | 'damaged' | 'blocked' | 'retired';
export type ToolLifecycleAction = 'review' | 'damage' | 'block' | 'retire' | 'reactivate';

export type ToolLifecyclePresentation = {
  key: ToolLifecycleKey;
  label: string;
  restricted: boolean;
};

export type ToolLifecycleActionMeta = {
  action: ToolLifecycleAction;
  label: string;
  detail: string;
  restrictive: boolean;
};

const actionMeta: Record<ToolLifecycleAction, ToolLifecycleActionMeta> = {
  review: {
    action: 'review',
    label: 'Marcar en revisión',
    detail: 'Bloquea las entregas mientras se comprueba el equipo.',
    restrictive: true,
  },
  damage: {
    action: 'damage',
    label: 'Marcar averiada',
    detail: 'Declara el equipo fuera de uso por una avería.',
    restrictive: true,
  },
  block: {
    action: 'block',
    label: 'Bloquear herramienta',
    detail: 'Impide cualquier entrega por una decisión de almacén.',
    restrictive: true,
  },
  retire: {
    action: 'retire',
    label: 'Retirar del inventario',
    detail: 'Da de baja operativa el equipo conservando su historial.',
    restrictive: true,
  },
  reactivate: {
    action: 'reactivate',
    label: 'Reactivar herramienta',
    detail: 'Devuelve el equipo a Disponible tras su comprobación.',
    restrictive: false,
  },
};

const actionTarget: Record<ToolLifecycleAction, ToolLifecycleKey> = {
  review: 'review',
  damage: 'damaged',
  block: 'blocked',
  retire: 'retired',
  reactivate: 'available',
};

const createId = (prefix: string) => {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
};

export const resolveToolLifecyclePresentation = (tool: Pick<Tool, 'status' | 'serviceStatus'>): ToolLifecyclePresentation => {
  if (tool.status === 'review' && tool.serviceStatus === 'out_of_service') {
    return { key: 'blocked', label: 'Bloqueada', restricted: true };
  }
  if (tool.status === 'available') return { key: 'available', label: 'Disponible', restricted: false };
  if (tool.status === 'loaned') return { key: 'loaned', label: 'Prestada', restricted: false };
  if (tool.status === 'review') return { key: 'review', label: 'En revisión', restricted: true };
  if (tool.status === 'damaged') return { key: 'damaged', label: 'Averiada', restricted: true };
  return { key: 'retired', label: 'Retirada', restricted: true };
};

export const listToolLifecycleActions = (tool: Tool): ToolLifecycleActionMeta[] => {
  if (tool.status === 'loaned') return [];
  const current = resolveToolLifecyclePresentation(tool).key;
  if (current === 'available') {
    return [actionMeta.review, actionMeta.damage, actionMeta.block, actionMeta.retire];
  }
  if (current === 'retired') return [actionMeta.reactivate];
  return [actionMeta.reactivate, actionMeta.review, actionMeta.damage, actionMeta.block, actionMeta.retire]
    .filter((item) => actionTarget[item.action] !== current);
};

const targetForAction = (action: ToolLifecycleAction): {
  status: ToolStatus;
  serviceStatus: ToolServiceStatus;
  active: boolean;
  movementTitle: string;
} => {
  if (action === 'review') {
    return { status: 'review', serviceStatus: 'repair', active: true, movementTitle: 'Herramienta marcada en revisión' };
  }
  if (action === 'damage') {
    return { status: 'damaged', serviceStatus: 'out_of_service', active: true, movementTitle: 'Herramienta marcada como averiada' };
  }
  if (action === 'block') {
    return { status: 'review', serviceStatus: 'out_of_service', active: true, movementTitle: 'Herramienta bloqueada manualmente' };
  }
  if (action === 'retire') {
    return { status: 'retired', serviceStatus: 'out_of_service', active: false, movementTitle: 'Herramienta retirada del inventario' };
  }
  return { status: 'available', serviceStatus: 'none', active: true, movementTitle: 'Herramienta reactivada' };
};

export const applyToolLifecycleAction = (
  data: AppData,
  toolId: string,
  action: ToolLifecycleAction,
  reason: string,
  operatorName = 'Isi',
  occurredAt = new Date().toISOString(),
): { data: AppData; tool: Tool; movement: Movement; maintenance: MaintenanceRecord } => {
  const current = data.tools.find((tool) => tool.id === toolId);
  if (!current) throw new Error('No se ha encontrado la herramienta.');
  if (current.status === 'loaned') {
    throw new Error('La herramienta está prestada. Registra primero su devolución.');
  }

  const normalizedReason = reason.trim();
  if (!normalizedReason) throw new Error('Indica el motivo del cambio de estado.');

  const allowed = listToolLifecycleActions(current).some((item) => item.action === action);
  if (!allowed) throw new Error('Este cambio de estado no está permitido desde la situación actual.');

  const target = targetForAction(action);
  const updated: Tool = {
    ...current,
    status: target.status,
    serviceStatus: target.serviceStatus,
    active: target.active,
    reservedTechnicianId: undefined,
    holderTechnicianId: undefined,
    loanedAt: undefined,
    updatedAt: occurredAt,
  };

  const movement: Movement = {
    id: createId('mov-state'),
    operationId: createId('op-state'),
    type: 'adjustment',
    toolId,
    operatorName,
    occurredAt,
    previousStatus: current.status,
    nextStatus: target.status,
    notes: `${target.movementTitle}. Motivo: ${normalizedReason}`,
    syncStatus: 'pending',
  };

  const maintenance: MaintenanceRecord = {
    id: createId('maintenance-state'),
    toolId,
    type: 'status_change',
    status: 'completed',
    title: target.movementTitle,
    description: normalizedReason,
    resolution: action === 'reactivate' ? 'Herramienta comprobada y reactivada.' : undefined,
    operatorName,
    openedAt: occurredAt,
    completedAt: occurredAt,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };

  return {
    tool: updated,
    movement,
    maintenance,
    data: {
      ...data,
      tools: data.tools.map((tool) => tool.id === toolId ? updated : tool),
      movements: [movement, ...data.movements],
      maintenanceRecords: [maintenance, ...(data.maintenanceRecords ?? [])],
    },
  };
};
