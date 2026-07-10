import type { Movement, Technician, Tool } from '../../domain/types';

const normalizeName = (value: string) => value.trim().toLocaleLowerCase('es-ES');

const hashText = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const stableLookupId = (prefix: 'cat' | 'loc', name: string) =>
  `${prefix}-${hashText(normalizeName(name))}`;

export const toolToSqlValues = (tool: Tool) => [
  tool.id,
  tool.code,
  tool.qrCode,
  tool.name,
  stableLookupId('cat', tool.category),
  tool.brand ?? null,
  tool.model ?? null,
  tool.serialNumber ?? null,
  stableLookupId('loc', tool.location),
  tool.status,
  tool.holderTechnicianId ?? null,
  tool.loanedAt ?? null,
  tool.notes ?? null,
  null,
  null,
  tool.imageDataUrl ?? null,
  tool.imageUpdatedAt ?? null,
  tool.status === 'retired' ? 0 : 1,
  tool.createdAt,
  tool.updatedAt,
];

export const technicianToSqlValues = (technician: Technician) => [
  technician.id,
  technician.code,
  technician.name,
  technician.specialty,
  technician.role ?? null,
  technician.phone ?? null,
  technician.extension ?? null,
  technician.previousPhone ?? null,
  technician.email ?? null,
  technician.active ? 1 : 0,
  technician.createdAt,
  technician.updatedAt,
];

export const movementToSqlValues = (
  movement: Movement,
  sequenceNumber: number,
  deviceId?: string,
) => [
  movement.id,
  sequenceNumber,
  movement.type,
  movement.toolId,
  movement.technicianId ?? null,
  movement.operatorName,
  movement.previousStatus,
  movement.nextStatus,
  movement.condition ?? null,
  movement.notes ?? null,
  movement.occurredAt,
  deviceId ?? null,
  null,
  'local',
  movement.occurredAt,
];

const stringValue = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const optionalString = (value: unknown) => typeof value === 'string' && value.length > 0 ? value : undefined;

export const rowToTechnician = (row: Record<string, unknown>): Technician => ({
  id: stringValue(row.id),
  code: stringValue(row.code),
  name: stringValue(row.name),
  specialty: stringValue(row.specialty),
  role: optionalString(row.role),
  phone: optionalString(row.phone),
  extension: optionalString(row.extension),
  previousPhone: optionalString(row.previous_phone),
  email: optionalString(row.email),
  active: Number(row.active) === 1,
  createdAt: stringValue(row.created_at),
  updatedAt: stringValue(row.updated_at),
});

export const rowToTool = (row: Record<string, unknown>): Tool => ({
  id: stringValue(row.id),
  code: stringValue(row.code),
  qrCode: stringValue(row.qr_code),
  name: stringValue(row.name),
  category: stringValue(row.category_name, 'Sin categoría'),
  brand: optionalString(row.brand),
  model: optionalString(row.model),
  serialNumber: optionalString(row.serial_number),
  location: stringValue(row.location_name, 'Sin ubicación'),
  status: stringValue(row.status) as Tool['status'],
  holderTechnicianId: optionalString(row.holder_technician_id),
  loanedAt: optionalString(row.loaned_at),
  notes: optionalString(row.notes),
  imageDataUrl: optionalString(row.legacy_image_data_url),
  imageUpdatedAt: optionalString(row.image_updated_at),
  createdAt: stringValue(row.created_at),
  updatedAt: stringValue(row.updated_at),
});

export const rowToMovement = (row: Record<string, unknown>): Movement => ({
  id: stringValue(row.id),
  type: stringValue(row.type) as Movement['type'],
  toolId: stringValue(row.tool_id),
  technicianId: optionalString(row.technician_id),
  operatorName: stringValue(row.operator_name),
  occurredAt: stringValue(row.occurred_at),
  previousStatus: stringValue(row.previous_status) as Movement['previousStatus'],
  nextStatus: stringValue(row.next_status) as Movement['nextStatus'],
  condition: optionalString(row.condition) as Movement['condition'],
  notes: optionalString(row.notes),
});
