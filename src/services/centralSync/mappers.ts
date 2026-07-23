import type {
  MaintenanceRecord,
  Movement,
  Technician,
  Tool,
  ToolAccessory,
} from '../../domain/types';
import type { SyncEntity } from './types';

const stringValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;
const booleanValue = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;
const optionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const numberValue = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const toRemoteRow = (
  entity: SyncEntity,
  workspaceId: string,
  payload: Record<string, unknown>,
  actorUserId?: string,
): Record<string, unknown> => {
  if (entity === 'technicians') {
    return {
      workspace_id: workspaceId,
      id: payload.id,
      code: payload.code,
      nfc_uid: payload.nfcUid ?? null,
      barcode_value: payload.barcodeValue ?? null,
      name: payload.name,
      specialty: payload.specialty,
      job_role: payload.role ?? null,
      phone: payload.phone ?? null,
      extension: payload.extension ?? null,
      previous_phone: payload.previousPhone ?? null,
      email: payload.email ?? null,
      active: payload.active ?? true,
      created_at: payload.createdAt,
      updated_at: payload.updatedAt,
    };
  }

  if (entity === 'tools') {
    return {
      workspace_id: workspaceId,
      id: payload.id,
      code: payload.code,
      qr_code: payload.qrCode,
      nfc_uid: payload.nfcUid ?? null,
      name: payload.name,
      category: payload.category,
      brand: payload.brand ?? null,
      model: payload.model ?? null,
      serial_number: payload.serialNumber ?? null,
      location: payload.location,
      status: payload.status,
      service_status: payload.serviceStatus ?? null,
      reserved_technician_id: payload.reservedTechnicianId ?? null,
      holder_technician_id: payload.holderTechnicianId ?? null,
      loaned_at: payload.loanedAt ?? null,
      notes: payload.notes ?? null,
      photo_uri: payload.photoUri ?? null,
      thumbnail_uri: payload.thumbnailUri ?? null,
      image_updated_at: payload.imageUpdatedAt ?? null,
      purchase_date: payload.purchaseDate ?? null,
      purchase_cost: payload.purchaseCost ?? null,
      supplier: payload.supplier ?? null,
      next_review_date: payload.nextReviewDate ?? null,
      next_calibration_date: payload.nextCalibrationDate ?? null,
      max_loan_days: payload.maxLoanDays ?? null,
      active: payload.active ?? true,
      created_at: payload.createdAt,
      updated_at: payload.updatedAt,
    };
  }

  if (entity === 'accessories') {
    return {
      workspace_id: workspaceId,
      id: payload.id,
      tool_id: payload.toolId,
      name: payload.name,
      required: payload.required ?? false,
      active: payload.active ?? true,
      condition: payload.condition ?? null,
      notes: payload.notes ?? null,
      created_at: payload.createdAt,
      updated_at: payload.updatedAt,
    };
  }

  if (entity === 'maintenance_records') {
    return {
      workspace_id: workspaceId,
      id: payload.id,
      tool_id: payload.toolId,
      type: payload.type,
      status: payload.status,
      title: payload.title,
      description: payload.description,
      resolution: payload.resolution ?? null,
      operator_name: payload.operatorName,
      assigned_to: payload.assignedTo ?? null,
      opened_at: payload.openedAt,
      due_at: payload.dueAt ?? null,
      completed_at: payload.completedAt ?? null,
      cost: payload.cost ?? null,
      parts: payload.parts ?? null,
      notes: payload.notes ?? null,
      created_at: payload.createdAt,
      updated_at: payload.updatedAt,
    };
  }

  return {
    workspace_id: workspaceId,
    id: payload.id,
    operation_id: payload.operationId ?? payload.id,
    sequence_number: payload.sequenceNumber ?? null,
    type: payload.type,
    tool_id: payload.toolId,
    technician_id: payload.technicianId ?? null,
    operator_name: payload.operatorName,
    actor_user_id: actorUserId ?? null,
    device_id: payload.deviceId ?? null,
    occurred_at: payload.occurredAt,
    previous_status: payload.previousStatus,
    next_status: payload.nextStatus,
    condition: payload.condition ?? null,
    notes: payload.notes ?? null,
    expected_return_at: payload.expectedReturnAt ?? null,
    work_order: payload.workOrder ?? null,
    work_location: payload.workLocation ?? null,
    station_id: payload.stationId ?? null,
    station_nonce: payload.stationNonce ?? null,
    station_verified_at: payload.stationVerifiedAt ?? null,
    reversed_movement_id: payload.reversedMovementId ?? null,
  };
};

export const remoteToolToDomain = (row: Record<string, unknown>): Tool => ({
  id: stringValue(row.id),
  code: stringValue(row.code),
  qrCode: stringValue(row.qr_code),
  nfcUid: optionalString(row.nfc_uid),
  name: stringValue(row.name),
  category: stringValue(row.category),
  brand: optionalString(row.brand),
  model: optionalString(row.model),
  serialNumber: optionalString(row.serial_number),
  location: stringValue(row.location),
  status: stringValue(row.status, 'available') as Tool['status'],
  serviceStatus: optionalString(row.service_status) as Tool['serviceStatus'],
  reservedTechnicianId: optionalString(row.reserved_technician_id),
  holderTechnicianId: optionalString(row.holder_technician_id),
  loanedAt: optionalString(row.loaned_at),
  notes: optionalString(row.notes),
  photoUri: optionalString(row.photo_uri),
  thumbnailUri: optionalString(row.thumbnail_uri),
  imageUpdatedAt: optionalString(row.image_updated_at),
  purchaseDate: optionalString(row.purchase_date),
  purchaseCost: optionalNumber(row.purchase_cost),
  supplier: optionalString(row.supplier),
  nextReviewDate: optionalString(row.next_review_date),
  nextCalibrationDate: optionalString(row.next_calibration_date),
  maxLoanDays: optionalNumber(row.max_loan_days),
  active: booleanValue(row.active, true),
  createdAt: stringValue(row.created_at, new Date(0).toISOString()),
  updatedAt: stringValue(row.updated_at, new Date(0).toISOString()),
});

export const remoteTechnicianToDomain = (row: Record<string, unknown>): Technician => ({
  id: stringValue(row.id),
  code: stringValue(row.code),
  nfcUid: optionalString(row.nfc_uid),
  barcodeValue: optionalString(row.barcode_value),
  name: stringValue(row.name),
  specialty: stringValue(row.specialty),
  role: optionalString(row.job_role),
  phone: optionalString(row.phone),
  extension: optionalString(row.extension),
  previousPhone: optionalString(row.previous_phone),
  email: optionalString(row.email),
  active: booleanValue(row.active, true),
  createdAt: stringValue(row.created_at, new Date(0).toISOString()),
  updatedAt: stringValue(row.updated_at, new Date(0).toISOString()),
});

export const remoteAccessoryToDomain = (row: Record<string, unknown>): ToolAccessory => ({
  id: stringValue(row.id),
  toolId: stringValue(row.tool_id),
  name: stringValue(row.name),
  required: booleanValue(row.required),
  active: booleanValue(row.active, true),
  condition: optionalString(row.condition) as ToolAccessory['condition'],
  notes: optionalString(row.notes),
  createdAt: stringValue(row.created_at, new Date(0).toISOString()),
  updatedAt: stringValue(row.updated_at, new Date(0).toISOString()),
});

export const remoteMaintenanceToDomain = (row: Record<string, unknown>): MaintenanceRecord => ({
  id: stringValue(row.id),
  toolId: stringValue(row.tool_id),
  type: stringValue(row.type, 'incident') as MaintenanceRecord['type'],
  status: stringValue(row.status, 'open') as MaintenanceRecord['status'],
  title: stringValue(row.title),
  description: stringValue(row.description),
  resolution: optionalString(row.resolution),
  operatorName: stringValue(row.operator_name),
  assignedTo: optionalString(row.assigned_to),
  openedAt: stringValue(row.opened_at, new Date(0).toISOString()),
  dueAt: optionalString(row.due_at),
  completedAt: optionalString(row.completed_at),
  cost: optionalNumber(row.cost),
  parts: optionalString(row.parts),
  notes: optionalString(row.notes),
  createdAt: stringValue(row.created_at, new Date(0).toISOString()),
  updatedAt: stringValue(row.updated_at, new Date(0).toISOString()),
});

export const remoteMovementToDomain = (row: Record<string, unknown>): Movement => ({
  id: stringValue(row.id),
  operationId: optionalString(row.operation_id),
  sequenceNumber: numberValue(row.sequence_number) || undefined,
  type: stringValue(row.type, 'adjustment') as Movement['type'],
  toolId: stringValue(row.tool_id),
  technicianId: optionalString(row.technician_id),
  operatorName: stringValue(row.operator_name),
  deviceId: optionalString(row.device_id),
  occurredAt: stringValue(row.occurred_at, new Date(0).toISOString()),
  previousStatus: stringValue(row.previous_status, 'available') as Movement['previousStatus'],
  nextStatus: stringValue(row.next_status, 'available') as Movement['nextStatus'],
  condition: optionalString(row.condition) as Movement['condition'],
  notes: optionalString(row.notes),
  expectedReturnAt: optionalString(row.expected_return_at),
  workOrder: optionalString(row.work_order),
  workLocation: optionalString(row.work_location),
  stationId: optionalString(row.station_id),
  stationNonce: optionalString(row.station_nonce),
  stationVerifiedAt: optionalString(row.station_verified_at),
  reversedMovementId: optionalString(row.reversed_movement_id),
  syncStatus: 'synced',
});
