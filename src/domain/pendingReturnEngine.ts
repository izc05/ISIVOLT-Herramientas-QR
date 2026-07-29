import type {
  AccessoryCondition,
  AppData,
  Movement,
  MovementAccessoryCheck,
  ReturnCondition,
  Tool,
  ToolStatus,
} from './types';
import { createMovementId, createOperationId, MovementRuleError, type AccessoryChecksByTool } from './movementEngine';

export type PendingReturnRequest = {
  tool: Tool;
  movement: Movement;
  technicianName: string;
};

export type RequestTechnicianReturnInput = {
  operationId?: string;
  toolId: string;
  technicianId: string;
  condition: ReturnCondition;
  accessoryChecks?: AccessoryChecksByTool;
  notes?: string;
  operatorName: string;
  occurredAt?: string;
};

export type ReviewPendingReturnInput = {
  toolId: string;
  approve: boolean;
  condition?: ReturnCondition;
  notes?: string;
  operatorName: string;
  occurredAt?: string;
};

const optionalText = (value?: string) => value?.trim() || undefined;

const activeAccessoriesFor = (data: AppData, toolId: string) => (data.accessories ?? [])
  .filter((accessory) => accessory.active && accessory.toolId === toolId);

const buildChecks = (
  data: AppData,
  toolId: string,
  values: AccessoryChecksByTool = {},
): MovementAccessoryCheck[] => {
  const accessories = activeAccessoriesFor(data, toolId);
  const checks = accessories.map((accessory) => ({
    accessoryId: accessory.id,
    condition: values[toolId]?.[accessory.id] ?? 'not_checked' as AccessoryCondition,
  }));
  const unchecked = accessories.find((accessory) => accessory.required
    && checks.find((check) => check.accessoryId === accessory.id)?.condition === 'not_checked');
  if (unchecked) {
    throw new MovementRuleError('accessory-check-required', `Comprueba el accesorio obligatorio «${unchecked.name}».`);
  }
  return checks;
};

const hasAccessoryIncident = (checks: MovementAccessoryCheck[]) => checks.some(
  (check) => check.condition === 'missing' || check.condition === 'damaged',
);

const pendingMovementFor = (data: AppData, tool: Tool) => data.movements.find((movement) => (
  movement.toolId === tool.id
  && movement.technicianId === tool.holderTechnicianId
  && movement.nextStatus === 'review'
  && (movement.type === 'return' || movement.type === 'incident')
  && !data.movements.some((review) => review.reversedMovementId === movement.id)
));

export const getPendingReturnRequests = (data: AppData): PendingReturnRequest[] => data.tools
  .filter((tool) => tool.status === 'review' && Boolean(tool.holderTechnicianId))
  .map((tool) => {
    const movement = pendingMovementFor(data, tool);
    if (!movement) return null;
    const technician = data.technicians.find((item) => item.id === tool.holderTechnicianId);
    return {
      tool,
      movement,
      technicianName: technician?.name ?? 'Técnico sin identificar',
    };
  })
  .filter((value): value is PendingReturnRequest => Boolean(value));

export const requestTechnicianReturn = (
  source: AppData,
  input: RequestTechnicianReturnInput,
): { data: AppData; movement: Movement } => {
  const operationId = input.operationId ?? createOperationId();
  if (source.movements.some((movement) => movement.operationId === operationId)) {
    throw new MovementRuleError('operation-already-applied', 'Esta devolución ya fue registrada.');
  }
  const tool = source.tools.find((item) => item.id === input.toolId);
  if (!tool) throw new MovementRuleError('tool-not-found', 'La herramienta ya no existe.');
  if (tool.status !== 'loaned') {
    throw new MovementRuleError('tool-not-loaned', `${tool.name} no figura como prestada.`);
  }
  if (tool.holderTechnicianId !== input.technicianId) {
    throw new MovementRuleError('tool-holder-mismatch', `${tool.name} no está asociada a este técnico.`);
  }

  const checks = buildChecks(source, tool.id, input.accessoryChecks);
  const accessoryIncident = hasAccessoryIncident(checks);
  const effectiveCondition: ReturnCondition = input.condition === 'ok' && accessoryIncident ? 'review' : input.condition;
  const notes = optionalText(input.notes);
  if ((effectiveCondition !== 'ok' || accessoryIncident) && !notes) {
    throw new MovementRuleError('incident-notes-required', 'Describe el problema antes de solicitar la devolución.');
  }
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const movement: Movement = {
    id: createMovementId(),
    operationId,
    type: effectiveCondition === 'ok' ? 'return' : 'incident',
    toolId: tool.id,
    technicianId: input.technicianId,
    operatorName: input.operatorName,
    occurredAt,
    previousStatus: 'loaned',
    nextStatus: 'review',
    condition: effectiveCondition,
    notes,
    accessoryChecks: checks,
  };

  return {
    movement,
    data: {
      ...source,
      tools: source.tools.map((item) => item.id === tool.id ? {
        ...item,
        status: 'review' as ToolStatus,
        holderTechnicianId: input.technicianId,
        loanedAt: item.loanedAt,
        updatedAt: occurredAt,
        notes: notes ?? item.notes,
      } : item),
      movements: [movement, ...source.movements],
    },
  };
};

export const reviewPendingReturn = (
  source: AppData,
  input: ReviewPendingReturnInput,
): { data: AppData; movement: Movement } => {
  const tool = source.tools.find((item) => item.id === input.toolId);
  if (!tool || tool.status !== 'review' || !tool.holderTechnicianId) {
    throw new MovementRuleError('tool-not-loaned', 'La devolución ya no está pendiente de validación.');
  }
  const pending = pendingMovementFor(source, tool);
  if (!pending) throw new MovementRuleError('tool-not-found', 'No se encuentra la solicitud de devolución.');

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const notes = optionalText(input.notes);
  if (!input.approve && !notes) {
    throw new MovementRuleError('incident-notes-required', 'Indica el motivo por el que rechazas la devolución.');
  }
  const condition = input.condition ?? pending.condition ?? 'ok';
  const nextStatus: ToolStatus = input.approve
    ? condition === 'ok' ? 'available' : condition === 'review' ? 'review' : 'damaged'
    : 'loaned';
  const movement: Movement = {
    id: createMovementId(),
    operationId: createOperationId(),
    type: 'adjustment',
    toolId: tool.id,
    technicianId: tool.holderTechnicianId,
    operatorName: input.operatorName,
    occurredAt,
    previousStatus: 'review',
    nextStatus,
    condition: input.approve ? condition : pending.condition,
    notes: input.approve
      ? notes ?? `Devolución validada. Solicitud ${pending.id}.`
      : `Devolución rechazada: ${notes}`,
    reversedMovementId: pending.id,
  };

  return {
    movement,
    data: {
      ...source,
      tools: source.tools.map((item) => item.id === tool.id ? {
        ...item,
        status: nextStatus,
        serviceStatus: input.approve
          ? condition === 'ok' ? 'none' : 'out_of_service'
          : item.serviceStatus,
        holderTechnicianId: input.approve ? undefined : item.holderTechnicianId,
        loanedAt: input.approve ? undefined : item.loanedAt,
        updatedAt: occurredAt,
        notes: notes ?? item.notes,
      } : item),
      movements: [movement, ...source.movements],
    },
  };
};
