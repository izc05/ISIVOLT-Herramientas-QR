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
const optionalStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  return items.length > 0 ? items : undefined;
};

const pick = (row: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
};

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
      nfc_updated_at: payload.nfcUpdatedAt ?? null,
      nfc_updated_by: payload.nfcUpdatedBy ?? null,
      nfc_tech_types: payload.nfcTechTypes ?? null,
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
      nfc_updated_at: payload.nfcUpdatedAt ?? null,
      nfc_updated_by: payload.nfcUpdatedBy ?? null,
      nfc_tech_types: payload.nfcTechTypes ?? null,
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
  id: stringValue(pick(row, 'id')),
  code: stringValue(pick(row, 'code')),
  qrCode: stringValue(pick(row, 'qr_code', 'qrCode')),
  nfcUid: optionalString(pick(row, 'nfc_uid', 'nfcUid')),
  nfcUpdatedAt: optionalString(pick(row, 'nfc_updated_at', 'nfcUpdatedAt')),
  nfcUpdatedBy: optionalString(pick(row, 'nfc_updated_by', 'nfcUpdatedBy')),
  nfcTechTypes: optionalStringArray(pick(row, 'nfc_tech_types', 'nfcTechTypes')),
  name: stringValue(pick(row, 'name')),
  category: stringValue(pick(row, 'category')),
  brand: optionalString(pick(row, 'brand')),
  model: optionalString(pick(row, 'model')),
  serialNumber: optionalString(pick(row, 'serial_number', 'serialNumber')),
  location: stringValue(pick(row, 'location')),
  status: stringValue(pick(row, 'status'), 'available') as Tool['status'],
  serviceStatus: optionalString(pick(row, 'service_status', 'serviceStatus')) as Tool['serviceStatus'],
  reservedTechnicianId: optionalString(pick(row, 'reserved_technician_id', 'reservedTechnicianId')),
  holderTechnicianId: optionalString(pick(row, 'holder_technician_id', 'holderTechnicianId')),
  loanedAt: optionalString(pick(row, 'loaned_at', 'loanedAt')),
  notes: optionalString(pick(row, 'notes')),
  photoUri: optionalString(pick(row, 'photo_uri', 'photoUri')),
  thumbnailUri: optionalString(pick(row, 'thumbnail_uri', 'thumbnailUri')),
  imageUpdatedAt: optionalString(pick(row, 'image_updated_at', 'imageUpdatedAt')),
  purchaseDate: optionalString(pick(row, 'purchase_date', 'purchaseDate')),
  purchaseCost: optionalNumber(pick(row, 'purchase_cost', 'purchaseCost')),
  supplier: optionalString(pick(row, 'supplier')),
  nextReviewDate: optionalString(pick(row, 'next_review_date', 'nextReviewDate')),
  nextCalibrationDate: optionalString(pick(row, 'next_calibration_date', 'nextCalibrationDate')),
  maxLoanDays: optionalNumber(pick(row, 'max_loan_days', 'maxLoanDays')),
  active: booleanValue(pick(row, 'active'), true),
  createdAt: stringValue(pick(row, 'created_at', 'createdAt'), new Date(0).toISOString()),
  updatedAt: stringValue(pick(row, 'updated_at', 'updatedAt'), new Date(0).toISOString()),
});

export const remoteTechnicianToDomain = (row: Record<string, unknown>): Technician => ({
  id: stringValue(pick(row, 'id')),
  code: stringValue(pick(row, 'code')),
  nfcUid: optionalString(pick(row, 'nfc_uid', 'nfcUid')),
  nfcUpdatedAt: optionalString(pick(row, 'nfc_updated_at', 'nfcUpdatedAt')),
  nfcUpdatedBy: optionalString(pick(row, 'nfc_updated_by', 'nfcUpdatedBy')),
  nfcTechTypes: optionalStringArray(pick(row, 'nfc_tech_types', 'nfcTechTypes')),
  barcodeValue: optionalString(pick(row, 'barcode_value', 'barcodeValue')),
  name: stringValue(pick(row, 'name')),
  specialty: stringValue(pick(row, 'specialty')),
  role: optionalString(pick(row, 'job_role', 'role')),
  phone: optionalString(pick(row, 'phone')),
  extension: optionalString(pick(row, 'extension')),
  previousPhone: optionalString(pick(row, 'previous_phone', 'previousPhone')),
  email: optionalString(pick(row, 'email')),
  active: booleanValue(pick(row, 'active'), true),
  createdAt: stringValue(pick(row, 'created_at', 'createdAt'), new Date(0).toISOString()),
  updatedAt: stringValue(pick(row, 'updated_at', 'updatedAt'), new Date(0).toISOString()),
});

export const remoteAccessoryToDomain = (row: Record<string, unknown>): ToolAccessory => ({
  id: stringValue(pick(row, 'id')),
  toolId: stringValue(pick(row, 'tool_id', 'toolId')),
  name: stringValue(pick(row, 'name')),
  required: booleanValue(pick(row, 'required')),
  active: booleanValue(pick(row, 'active'), true),
  condition: optionalString(pick(row, 'condition')) as ToolAccessory['condition'],
  notes: optionalString(pick(row, 'notes')),
  createdAt: stringValue(pick(row, 'created_at', 'createdAt'), new Date(0).toISOString()),
  updatedAt: stringValue(pick(row, 'updated_at', 'updatedAt'), new Date(0).toISOString()),
});

export const remoteMaintenanceToDomain = (row: Record<string, unknown>): MaintenanceRecord => ({
  id: stringValue(pick(row, 'id')),
  toolId: stringValue(pick(row, 'tool_id', 'toolId')),
  type: stringValue(pick(row, 'type'), 'incident') as MaintenanceRecord['type'],
  status: stringValue(pick(row, 'status'), 'open') as MaintenanceRecord['status'],
  title: stringValue(pick(row, 'title')),
  description: stringValue(pick(row, 'description')),
  resolution: optionalString(pick(row, 'resolution')),
  operatorName: stringValue(pick(row, 'operator_name', 'operatorName')),
  assignedTo: optionalString(pick(row, 'assigned_to', 'assignedTo')),
  openedAt: stringValue(pick(row, 'opened_at', 'openedAt'), new Date(0).toISOString()),
  dueAt: optionalString(pick(row, 'due_at', 'dueAt')),
  completedAt: optionalString(pick(row, 'completed_at', 'completedAt')),
  cost: optionalNumber(pick(row, 'cost')),
  parts: optionalString(pick(row, 'parts')),
  notes: optionalString(pick(row, 'notes')),
  createdAt: stringValue(pick(row, 'created_at', 'createdAt'), new Date(0).toISOString()),
  updatedAt: stringValue(pick(row, 'updated_at', 'updatedAt'), new Date(0).toISOString()),
});

export const remoteMovementToDomain = (row: Record<string, unknown>): Movement => ({
  id: stringValue(pick(row, 'id')),
  operationId: optionalString(pick(row, 'operation_id', 'operationId')),
  sequenceNumber: numberValue(pick(row, 'sequence_number', 'sequenceNumber')) || undefined,
  type: stringValue(pick(row, 'type'), 'adjustment') as Movement['type'],
  toolId: stringValue(pick(row, 'tool_id', 'toolId')),
  technicianId: optionalString(pick(row, 'technician_id', 'technicianId')),
  operatorName: stringValue(pick(row, 'operator_name', 'operatorName')),
  deviceId: optionalString(pick(row, 'device_id', 'deviceId')),
  occurredAt: stringValue(pick(row, 'occurred_at', 'occurredAt'), new Date(0).toISOString()),
  previousStatus: stringValue(pick(row, 'previous_status', 'previousStatus'), 'available') as Movement['previousStatus'],
  nextStatus: stringValue(pick(row, 'next_status', 'nextStatus'), 'available') as Movement['nextStatus'],
  condition: optionalString(pick(row, 'condition')) as Movement['condition'],
  notes: optionalString(pick(row, 'notes')),
  expectedReturnAt: optionalString(pick(row, 'expected_return_at', 'expectedReturnAt')),
  workOrder: optionalString(pick(row, 'work_order', 'workOrder')),
  workLocation: optionalString(pick(row, 'work_location', 'workLocation')),
  stationId: optionalString(pick(row, 'station_id', 'stationId')),
  stationNonce: optionalString(pick(row, 'station_nonce', 'stationNonce')),
  stationVerifiedAt: optionalString(pick(row, 'station_verified_at', 'stationVerifiedAt')),
  reversedMovementId: optionalString(pick(row, 'reversed_movement_id', 'reversedMovementId')),
  syncStatus: 'synced',
});