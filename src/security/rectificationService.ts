import type { AppData, Movement, ToolStatus } from '../domain/types';
import { loadAppData, saveAppData } from '../services/storage';
import { assertPermission } from './permissions';
import { getCurrentOperatorId, getCurrentOperatorName } from './session';
import { appendAuditEntry } from './store';

export type RectificationCommand = {
  originalMovementId: string;
  nextStatus: Exclude<ToolStatus, never>;
  technicianId?: string;
  notes: string;
};

const newId = () => `mov-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

export const rectifyMovement = async (command: RectificationCommand): Promise<AppData> => {
  assertPermission('audit.view');
  const notes = command.notes.trim();
  if (!notes) throw new Error('Describe el motivo y el resultado de la rectificación.');

  const data = loadAppData();
  const original = data.movements.find((movement) => movement.id === command.originalMovementId);
  if (!original) throw new Error('El movimiento original ya no está disponible.');
  if (data.movements.some((movement) => movement.reversedMovementId === original.id)) {
    throw new Error('Este movimiento ya tiene una rectificación registrada.');
  }

  const tool = data.tools.find((item) => item.id === original.toolId);
  if (!tool) throw new Error('La herramienta del movimiento no existe.');

  if (command.nextStatus === 'loaned') {
    const technician = data.technicians.find((item) => item.id === command.technicianId && item.active);
    if (!technician) throw new Error('Selecciona un técnico activo para restablecer el préstamo.');
  }

  const occurredAt = new Date().toISOString();
  const movement: Movement = {
    id: newId(),
    type: 'adjustment',
    toolId: tool.id,
    technicianId: command.nextStatus === 'loaned' ? command.technicianId : tool.holderTechnicianId,
    operatorName: getCurrentOperatorName(),
    occurredAt,
    previousStatus: tool.status,
    nextStatus: command.nextStatus,
    notes,
    reversedMovementId: original.id,
    syncStatus: 'local',
  };

  const updatedTool = {
    ...tool,
    status: command.nextStatus,
    serviceStatus: command.nextStatus === 'review' || command.nextStatus === 'damaged'
      ? 'out_of_service' as const
      : command.nextStatus === 'retired'
        ? tool.serviceStatus
        : 'none' as const,
    holderTechnicianId: command.nextStatus === 'loaned' ? command.technicianId : undefined,
    loanedAt: command.nextStatus === 'loaned' ? occurredAt : undefined,
    active: command.nextStatus !== 'retired',
    updatedAt: occurredAt,
  };

  const next: AppData = {
    ...data,
    tools: data.tools.map((item) => item.id === tool.id ? updatedTool : item),
    movements: [movement, ...data.movements],
  };
  saveAppData(next);
  await appendAuditEntry({
    eventType: 'movement.rectified',
    entityType: 'movement',
    entityId: movement.id,
    operatorUserId: getCurrentOperatorId(),
    operatorName: getCurrentOperatorName(),
    detail: `Rectificación de ${original.id}: ${tool.status} → ${command.nextStatus}. ${notes}`,
  });
  return next;
};
