import type {
  MaintenanceRecord,
  Movement,
  MovementAccessoryCheck,
  Technician,
  Tool,
  ToolAccessory,
} from '../../domain/types';

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
  tool.photoUri ?? null,
  tool.thumbnailUri ?? null,
  tool.imageDataUrl ?? null,
  tool.imageUpdatedAt ?? null,
  tool.active === false || tool.status === 'retired' ? 0 : 1,
  tool.createdAt,
  tool.updatedAt,
  tool.serviceStatus ?? 'none',
  tool.reservedTechnicianId ?? null,
  tool.purchaseDate ?? null,
  tool.purchaseCost ?? null,
  tool.supplier ?? null,
  tool.nextReviewDate ?? null,
  tool.nextCalibrationDate ?? null,
  tool.maxLoanDays ?? null,
  tool.nfcUid ?? null,
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
  technician.nfcUid ?? null,
  technician.active ? 1 : 0,
  technician.createdAt,
  technician.updatedAt,
  technician.barcodeValue ?? null,
];

export const movementToSqlValues = (
  movement: Movement,
  sequenceNumber: number,
  fallbackDeviceId?: string,
) => [
  movement.id,
  movement.operationId ?? null,
  movement.sequenceNumber ?? sequenceNumber,
  movement.type,
  movement.toolId,
  movement.technicianId ?? null,
  movement.operatorName,
  movement.previousStatus,
  movement.nextStatus,
  movement.condition ?? null,
  movement.notes ?? null,
  movement.expectedReturnAt ?? null,
  movement.workOrder ?? null,
  movement.workLocation ?? null,
  movement.occurredAt,
  movement.deviceId ?? fallbackDeviceId ?? null,
  movement.reversedMovementId ?? null,
  movement.syncStatus ?? 'local',
  movement.occurredAt,
];

export const movementAccessoryCheckToSqlValues = (
  movementId: string,
  check: MovementAccessoryCheck,
) => [
  movementId,
  check.accessoryId,
  check.condition === 'ok' || check.condition === 'damaged' ? 1 : 0,
  check.condition,
  check.notes ?? null,
];

export const accessoryToSqlValues = (accessory: ToolAccessory) => [
  accessory.id,
  accessory.toolId,
  accessory.name,
  accessory.required ? 1 : 0,
  accessory.active ? 1 : 0,
  accessory.createdAt,
  accessory.updatedAt,
  accessory.condition ?? 'not_checked',
  accessory.notes ?? null,
];

export const maintenanceToSqlValues = (record: MaintenanceRecord) => [
  record.id,
  record.toolId,
  record.type,
  record.status,
  record.title,
  record.description,
  record.resolution ?? null,
  record.operatorName,
  record.assignedTo ?? null,
  record.openedAt,
  record.dueAt ?? null,
  record.completedAt ?? null,
  record.cost ?? null,
  record.parts ?? null,
  record.notes ?? null,
  record.createdAt,
  record.updatedAt,
];

const stringValue = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const optionalString = (value: unknown) => typeof value === 'string' && value.length > 0 ? value : undefined;
const optionalNumber = (value: unknown) => value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : undefined;

export const rowToTechnician = (row: Record<string, unknown>): Technician => ({
  id: stringValue(row.id),
  code: stringValue(row.code),
  nfcUid: optionalString(row.nfc_uid),
  barcodeValue: optionalString(row.barcode_value),
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
  nfcUid: optionalString(row.nfc_uid),
  name: stringValue(row.name),
  category: stringValue(row.category_name, 'Sin categoría'),
  brand: optionalString(row.brand),
  model: optionalString(row.model),
  serialNumber: optionalString(row.serial_number),
  location: stringValue(row.location_name, 'Sin ubicación'),
  status: stringValue(row.status) as Tool['status'],
  serviceStatus: optionalString(row.service_status) as Tool['serviceStatus'],
  reservedTechnicianId: optionalString(row.reserved_technician_id),
  holderTechnicianId: optionalString(row.holder_technician_id),
  loanedAt: optionalString(row.loaned_at),
  notes: optionalString(row.notes),
  photoUri: optionalString(row.photo_uri),
  thumbnailUri: optionalString(row.thumbnail_uri),
  imageDataUrl: optionalString(row.legacy_image_data_url),
  imageUpdatedAt: optionalString(row.image_updated_at),
  purchaseDate: optionalString(row.purchase_date),
  purchaseCost: optionalNumber(row.purchase_cost),
  supplier: optionalString(row.supplier),
  nextReviewDate: optionalString(row.next_review_date),
  nextCalibrationDate: optionalString(row.next_calibration_date),
  maxLoanDays: optionalNumber(row.max_loan_days),
  active: Number(row.active) === 1,
  createdAt: stringValue(row.created_at),
  updatedAt: stringValue(row.updated_at),
});

export const rowToMovement = (row: Record<string, unknown>): Movement => ({
  id: stringValue(row.id),
  operationId: optionalString(row.operation_id),
  sequenceNumber: optionalNumber(row.sequence_number),
  type: stringValue(row.type) as Movement['type'],
  toolId: stringValue(row.tool_id),
  technicianId: optionalString(row.technician_id),
  operatorName: stringValue(row.operator_name),
  deviceId: optionalString(row.device_id),
  occurredAt: stringValue(row.occurred_at),
  previousStatus: stringValue(row.previous_status) as Movement['previousStatus'],
  nextStatus: stringValue(row.next_status) as Movement['nextStatus'],
  condition: optionalString(row.condition) as Movement['condition'],
  notes: optionalString(row.notes),
  expectedReturnAt: optionalString(row.expected_return_at),
  workOrder: optionalString(row.work_order),
  workLocation: optionalString(row.work_location),
  reversedMovementId: optionalString(row.reversed_movement_id),
  syncStatus: optionalString(row.sync_status) as Movement['syncStatus'],
});

export const rowToMovementAccessoryCheck = (
  row: Record<string, unknown>,
): MovementAccessoryCheck => ({
  accessoryId: stringValue(row.accessory_id),
  condition: stringValue(row.condition, 'not_checked') as MovementAccessoryCheck['condition'],
  notes: optionalString(row.notes),
});

export const rowToAccessory = (row: Record<string, unknown>): ToolAccessory => ({
  id: stringValue(row.id),
  toolId: stringValue(row.tool_id),
  name: stringValue(row.name),
  required: Number(row.required) === 1,
  active: Number(row.active) === 1,
  condition: optionalString(row.condition) as ToolAccessory['condition'],
  notes: optionalString(row.notes),
  createdAt: stringValue(row.created_at),
  updatedAt: stringValue(row.updated_at),
});

export const rowToMaintenance = (row: Record<string, unknown>): MaintenanceRecord => ({
  id: stringValue(row.id),
  toolId: stringValue(row.tool_id),
  type: stringValue(row.type) as MaintenanceRecord['type'],
  status: stringValue(row.status) as MaintenanceRecord['status'],
  title: stringValue(row.title),
  description: stringValue(row.description),
  resolution: optionalString(row.resolution),
  operatorName: stringValue(row.operator_name),
  assignedTo: optionalString(row.assigned_to),
  openedAt: stringValue(row.opened_at),
  dueAt: optionalString(row.due_at),
  completedAt: optionalString(row.completed_at),
  cost: optionalNumber(row.cost),
  parts: optionalString(row.parts),
  notes: optionalString(row.notes),
  createdAt: stringValue(row.created_at),
  updatedAt: stringValue(row.updated_at),
});
