import type {
  AppData,
  Movement,
  OperationMode,
  ReturnCondition,
  Tool,
  ToolStatus,
} from './types';

export type MovementRuleErrorCode =
  | 'operation-already-applied'
  | 'empty-selection'
  | 'duplicate-selection'
  | 'technician-required'
  | 'technician-not-found'
  | 'technician-inactive'
  | 'condition-required'
  | 'incident-notes-required'
  | 'tool-not-found'
  | 'tool-inactive'
  | 'tool-not-available'
  | 'tool-service-blocked'
  | 'tool-reserved-for-another'
  | 'tool-not-loaned'
  | 'tool-holder-mismatch';

export class MovementRuleError extends Error {
  readonly code: MovementRuleErrorCode;

  constructor(code: MovementRuleErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'MovementRuleError';
  }
}

export type MovementCommand = {
  operationId?: string;
  mode: OperationMode;
  toolIds: string[];
  technicianId?: string;
  condition?: ReturnCondition;
  returnConditions?: Record<string, ReturnCondition>;
  notes?: string;
  operatorName: string;
  occurredAt?: string;
};

export type MovementEngineResult = {
  data: AppData;
  movements: Movement[];
  affectedToolIds: string[];
};

const randomId = (prefix: string) => {
  const value = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`;
};

export const createMovementId = () => randomId('mov');
export const createOperationId = () => randomId('op');

const getReturnCondition = (
  command: MovementCommand,
  toolId: string,
): ReturnCondition | undefined => command.returnConditions?.[toolId] ?? command.condition;

const requireTool = (data: AppData, toolId: string): Tool => {
  const tool = data.tools.find((item) => item.id === toolId);
  if (!tool) {
    throw new MovementRuleError('tool-not-found', `No existe la herramienta ${toolId}.`);
  }
  return tool;
};

const validateDeliveryTechnician = (data: AppData, technicianId?: string) => {
  if (!technicianId) {
    throw new MovementRuleError(
      'technician-required',
      'La entrega necesita un técnico responsable.',
    );
  }

  const technician = data.technicians.find((item) => item.id === technicianId);
  if (!technician) {
    throw new MovementRuleError(
      'technician-not-found',
      'El técnico seleccionado no existe.',
    );
  }
  if (!technician.active) {
    throw new MovementRuleError(
      'technician-inactive',
      'El técnico seleccionado está inactivo.',
    );
  }
};

const validateDeliveryTool = (data: AppData, tool: Tool, technicianId?: string) => {
  if (tool.status !== 'available') {
    throw new MovementRuleError(
      'tool-not-available',
      `${tool.name} no está disponible para entregar.`,
    );
  }

  if (tool.serviceStatus && !['none', 'reserved'].includes(tool.serviceStatus)) {
    throw new MovementRuleError(
      'tool-service-blocked',
      `${tool.name} está bloqueada por ${tool.serviceStatus.replaceAll('_', ' ')}.`,
    );
  }

  if (tool.serviceStatus === 'reserved' && tool.reservedTechnicianId !== technicianId) {
    const reservedFor = data.technicians.find(
      (item) => item.id === tool.reservedTechnicianId,
    )?.name;
    throw new MovementRuleError(
      'tool-reserved-for-another',
      `${tool.name} está reservada${reservedFor ? ` para ${reservedFor}` : ''}.`,
    );
  }
};

const validateReturnTool = (tool: Tool, technicianId?: string) => {
  if (tool.status !== 'loaned') {
    throw new MovementRuleError(
      'tool-not-loaned',
      `${tool.name} no figura como prestada.`,
    );
  }
  if (!tool.holderTechnicianId) {
    throw new MovementRuleError(
      'technician-required',
      `${tool.name} no tiene técnico responsable asignado.`,
    );
  }
  if (technicianId && tool.holderTechnicianId !== technicianId) {
    throw new MovementRuleError(
      'tool-holder-mismatch',
      `${tool.name} no está prestada al técnico seleccionado.`,
    );
  }
};

export const applyMovementCommand = (
  source: AppData,
  command: MovementCommand,
  idFactory: () => string = createMovementId,
): MovementEngineResult => {
  if (
    command.operationId
    && source.movements.some((movement) => movement.operationId === command.operationId)
  ) {
    throw new MovementRuleError(
      'operation-already-applied',
      'Esta operación ya fue registrada. No se ha duplicado ningún movimiento.',
    );
  }

  const selectedIds = [...new Set(command.toolIds)];
  if (selectedIds.length === 0) {
    throw new MovementRuleError('empty-selection', 'Selecciona al menos una herramienta.');
  }
  if (selectedIds.length !== command.toolIds.length) {
    throw new MovementRuleError(
      'duplicate-selection',
      'Una herramienta aparece repetida en la operación.',
    );
  }

  const occurredAt = command.occurredAt ?? new Date().toISOString();
  const notes = command.notes?.trim() || undefined;

  if (command.mode === 'delivery') {
    validateDeliveryTechnician(source, command.technicianId);
  }

  if (
    command.mode === 'return'
    && selectedIds.some((toolId) => !getReturnCondition(command, toolId))
  ) {
    throw new MovementRuleError(
      'condition-required',
      'Asigna una condición a cada herramienta antes de devolver.',
    );
  }

  if (
    command.mode === 'return'
    && selectedIds.some((toolId) => getReturnCondition(command, toolId) !== 'ok')
    && !notes
  ) {
    throw new MovementRuleError(
      'incident-notes-required',
      'Describe la incidencia antes de devolver una herramienta para revisión o como averiada.',
    );
  }

  const selectedTools = selectedIds.map((toolId) => {
    const tool = requireTool(source, toolId);

    if (tool.active === false || tool.status === 'retired') {
      throw new MovementRuleError(
        'tool-inactive',
        `${tool.name} está de baja y no puede utilizarse.`,
      );
    }

    if (command.mode === 'delivery') {
      validateDeliveryTool(source, tool, command.technicianId);
    } else {
      validateReturnTool(tool, command.technicianId);
    }

    return tool;
  });

  const selectedSet = new Set(selectedIds);
  const movements: Movement[] = [];

  const tools = source.tools.map((tool) => {
    if (!selectedSet.has(tool.id)) return tool;

    if (command.mode === 'delivery') {
      movements.push({
        id: idFactory(),
        operationId: command.operationId,
        type: 'delivery',
        toolId: tool.id,
        technicianId: command.technicianId,
        operatorName: command.operatorName,
        occurredAt,
        previousStatus: tool.status,
        nextStatus: 'loaned',
        notes,
      });

      return {
        ...tool,
        status: 'loaned' as ToolStatus,
        serviceStatus: 'none' as const,
        reservedTechnicianId: undefined,
        holderTechnicianId: command.technicianId,
        loanedAt: occurredAt,
        updatedAt: occurredAt,
      };
    }

    const condition = getReturnCondition(command, tool.id);
    if (!condition) {
      throw new MovementRuleError(
        'condition-required',
        `Falta indicar el estado de devolución de ${tool.name}.`,
      );
    }

    const nextStatus: ToolStatus = condition === 'ok'
      ? 'available'
      : condition === 'review'
        ? 'review'
        : 'damaged';

    movements.push({
      id: idFactory(),
      operationId: command.operationId,
      type: condition === 'ok' ? 'return' : 'incident',
      toolId: tool.id,
      technicianId: tool.holderTechnicianId,
      operatorName: command.operatorName,
      occurredAt,
      previousStatus: tool.status,
      nextStatus,
      condition,
      notes,
    });

    return {
      ...tool,
      status: nextStatus,
      serviceStatus: condition === 'ok' ? tool.serviceStatus : 'out_of_service' as const,
      holderTechnicianId: undefined,
      loanedAt: undefined,
      updatedAt: occurredAt,
      notes: notes ?? tool.notes,
    };
  });

  if (movements.length !== selectedTools.length) {
    throw new MovementRuleError(
      'tool-not-found',
      'No se han podido preparar todos los movimientos solicitados.',
    );
  }

  return {
    data: {
      ...source,
      tools,
      movements: [...movements, ...source.movements],
    },
    movements,
    affectedToolIds: selectedIds,
  };
};
