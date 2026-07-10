import type {
  AppData,
  Movement,
  OperationMode,
  ReturnCondition,
  ToolStatus,
} from './types';

export type MovementCommand = {
  mode: OperationMode;
  toolIds: string[];
  technicianId?: string;
  condition?: ReturnCondition;
  notes?: string;
  operatorName: string;
  occurredAt?: string;
};

export type MovementEngineResult = {
  data: AppData;
  movements: Movement[];
  affectedToolIds: string[];
};

export class MovementRuleError extends Error {
  constructor(
    public readonly code:
      | 'empty-selection'
      | 'duplicate-selection'
      | 'technician-required'
      | 'technician-not-found'
      | 'technician-inactive'
      | 'tool-not-found'
      | 'tool-not-available'
      | 'tool-not-loaned'
      | 'incident-notes-required',
    message: string,
  ) {
    super(message);
    this.name = 'MovementRuleError';
  }
}

const defaultIdFactory = () => {
  const value = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `mov-${value}`;
};

export const applyMovementCommand = (
  source: AppData,
  command: MovementCommand,
  idFactory: () => string = defaultIdFactory,
): MovementEngineResult => {
  const selectedIds = [...new Set(command.toolIds)];
  if (selectedIds.length === 0) {
    throw new MovementRuleError('empty-selection', 'Selecciona al menos una herramienta.');
  }
  if (selectedIds.length !== command.toolIds.length) {
    throw new MovementRuleError('duplicate-selection', 'Una herramienta aparece repetida en la operación.');
  }

  const occurredAt = command.occurredAt ?? new Date().toISOString();
  const notes = command.notes?.trim() || undefined;
  const condition = command.condition ?? 'ok';

  let technicianId = command.technicianId;
  if (command.mode === 'delivery') {
    if (!technicianId) {
      throw new MovementRuleError('technician-required', 'La entrega necesita un técnico responsable.');
    }
    const technician = source.technicians.find((item) => item.id === technicianId);
    if (!technician) {
      throw new MovementRuleError('technician-not-found', 'El técnico seleccionado no existe.');
    }
    if (!technician.active) {
      throw new MovementRuleError('technician-inactive', 'El técnico seleccionado está inactivo.');
    }
  }

  if (command.mode === 'return' && condition !== 'ok' && !notes) {
    throw new MovementRuleError(
      'incident-notes-required',
      'Describe la incidencia antes de devolver una herramienta para revisión o como averiada.',
    );
  }

  const selectedTools = selectedIds.map((toolId) => {
    const tool = source.tools.find((item) => item.id === toolId);
    if (!tool) {
      throw new MovementRuleError('tool-not-found', `No existe la herramienta ${toolId}.`);
    }
    if (command.mode === 'delivery' && tool.status !== 'available') {
      throw new MovementRuleError('tool-not-available', `${tool.name} no está disponible para entregar.`);
    }
    if (command.mode === 'return' && tool.status !== 'loaned') {
      throw new MovementRuleError('tool-not-loaned', `${tool.name} no figura como prestada.`);
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
        type: 'delivery',
        toolId: tool.id,
        technicianId,
        operatorName: command.operatorName,
        occurredAt,
        previousStatus: tool.status,
        nextStatus: 'loaned',
        notes,
      });
      return {
        ...tool,
        status: 'loaned' as ToolStatus,
        holderTechnicianId: technicianId,
        loanedAt: occurredAt,
        updatedAt: occurredAt,
      };
    }

    const nextStatus: ToolStatus = condition === 'ok'
      ? 'available'
      : condition === 'review'
        ? 'review'
        : 'damaged';

    movements.push({
      id: idFactory(),
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
      holderTechnicianId: undefined,
      loanedAt: undefined,
      updatedAt: occurredAt,
      notes: notes ?? tool.notes,
    };
  });

  if (movements.length !== selectedTools.length) {
    throw new MovementRuleError('tool-not-found', 'No se han podido preparar todos los movimientos solicitados.');
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
