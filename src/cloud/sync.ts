import { normalizeAppData } from '../storage';
import type {
  AppData,
  BatchOperation,
  BatchTransaction,
  IdentificationMethod,
  Movement,
  MovementType,
  OperatorMode,
  PhotoReference,
  ScanMethod,
  Technician,
  TechnicianStatus,
  Tool,
  ToolKind,
  ToolServiceState,
  ToolStatus,
} from '../types';
import type { CloudProfile } from './config';
import { createRecord, listRecords, type PocketBaseRecord, updateRecord } from './pocketbaseClient';

const COLLECTIONS = {
  technicians: 'isivolt_technicians',
  tools: 'isivolt_tools',
  batches: 'isivolt_batches',
  movements: 'isivolt_movements',
} as const;

export type SyncResult = {
  data: AppData;
  uploaded: number;
  downloaded: number;
};

type RemoteWorkspace = {
  data: AppData;
  records: {
    technicians: PocketBaseRecord[];
    tools: PocketBaseRecord[];
    batches: PocketBaseRecord[];
    movements: PocketBaseRecord[];
  };
};

const stringValue = (value: unknown): string => typeof value === 'string' ? value : '';
const optionalString = (value: unknown): string | undefined => {
  const result = stringValue(value).trim();
  return result || undefined;
};
const optionalNumber = (value: unknown): number | undefined => {
  if (value === '' || value === null || value === undefined) return undefined;
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : undefined;
};
const stringArray = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string')
  : [];
const photoReferences = (value: unknown): PhotoReference[] => Array.isArray(value)
  ? value.filter((item): item is PhotoReference => Boolean(item) && typeof item === 'object' && typeof (item as PhotoReference).id === 'string')
  : [];

const toolStatus = (value: unknown): ToolStatus => (
  value === 'loaned' || value === 'review' || value === 'retired' ? value : 'available'
);
const toolKind = (value: unknown): ToolKind => (
  value === 'loanable-material'
    || value === 'measuring-equipment'
    || value === 'kit'
    || value === 'ppe'
    || value === 'consumable'
    || value === 'other'
    ? value
    : 'returnable-tool'
);
const toolServiceState = (value: unknown, status: ToolStatus): ToolServiceState => {
  if (value === 'reserved' || value === 'review' || value === 'repair' || value === 'lost' || value === 'retired') return value;
  if (status === 'review') return 'review';
  if (status === 'retired') return 'retired';
  return 'ready';
};
const technicianStatus = (value: unknown, active: boolean): TechnicianStatus => (
  value === 'inactive' || value === 'absent' || value === 'vacation' || value === 'leave' || value === 'blocked'
    ? value
    : active ? 'active' : 'inactive'
);
const movementType = (value: unknown): MovementType => (
  value === 'return' || value === 'tool_created' || value === 'technician_created' || value === 'nfc_linked'
    ? value
    : 'loan'
);
const identificationMethod = (value: unknown): IdentificationMethod | undefined => (
  value === 'manual' || value === 'qr' || value === 'nfc' || value === 'authenticated' ? value : undefined
);
const scanMethod = (value: unknown): ScanMethod | undefined => (
  value === 'manual' || value === 'qr' || value === 'nfc' || value === 'mixed' ? value : undefined
);
const operatorMode = (value: unknown): OperatorMode => value === 'self-service' ? 'self-service' : 'administrator';
const batchOperation = (value: unknown): BatchOperation => value === 'return' ? 'return' : 'loan';

const remoteTechnician = (record: PocketBaseRecord): Technician => {
  const active = record.active !== false;
  return {
    id: stringValue(record.external_id) || record.id,
    code: stringValue(record.code),
    name: stringValue(record.name),
    category: stringValue(record.category),
    categoryId: optionalString(record.category_external_id),
    status: technicianStatus(record.technician_status, active),
    company: optionalString(record.company),
    department: optionalString(record.department),
    notes: optionalString(record.notes),
    photos: photoReferences(record.photo_refs),
    phone: optionalString(record.phone),
    email: optionalString(record.email),
    qrPayload: optionalString(record.qr_payload),
    nfcTag: optionalString(record.nfc_tag),
    active,
    createdAt: stringValue(record.source_created) || stringValue(record.created),
    updatedAt: stringValue(record.source_updated) || stringValue(record.updated),
  };
};

const remoteTool = (record: PocketBaseRecord): Tool => {
  const status = toolStatus(record.status);
  return {
    id: stringValue(record.external_id) || record.id,
    code: stringValue(record.code),
    name: stringValue(record.name),
    category: stringValue(record.category),
    categoryId: optionalString(record.category_external_id),
    location: stringValue(record.location),
    locationId: optionalString(record.location_external_id),
    kind: toolKind(record.tool_kind),
    serviceState: toolServiceState(record.service_state, status),
    description: optionalString(record.description),
    notes: optionalString(record.notes),
    photos: photoReferences(record.photo_refs),
    brand: optionalString(record.brand),
    model: optionalString(record.model),
    serialNumber: optionalString(record.serial_number),
    purchaseDate: optionalString(record.purchase_date),
    purchasePrice: optionalNumber(record.purchase_price),
    reviewDueDate: optionalString(record.review_due_date),
    calibrationDueDate: optionalString(record.calibration_due_date),
    reviewIntervalDays: optionalNumber(record.review_interval_days),
    calibrationIntervalDays: optionalNumber(record.calibration_interval_days),
    quantity: optionalNumber(record.quantity),
    minStock: optionalNumber(record.min_stock),
    unit: optionalString(record.unit),
    qrPayload: stringValue(record.qr_payload),
    nfcTag: optionalString(record.nfc_tag),
    status,
    technicianId: optionalString(record.technician_external_id),
    createdAt: stringValue(record.source_created) || stringValue(record.created),
    updatedAt: stringValue(record.source_updated) || stringValue(record.updated),
  };
};

const remoteBatch = (record: PocketBaseRecord): BatchTransaction => ({
  id: stringValue(record.external_id) || record.id,
  operation: batchOperation(record.operation),
  technicianId: stringValue(record.technician_external_id),
  toolIds: stringArray(record.tool_ids),
  operatorMode: operatorMode(record.operator_mode),
  identificationMethod: identificationMethod(record.identification_method) ?? 'manual',
  scanMethod: scanMethod(record.scan_method) ?? 'manual',
  startedAt: stringValue(record.started_at),
  completedAt: stringValue(record.completed_at),
});

const remoteMovement = (record: PocketBaseRecord): Movement => ({
  id: stringValue(record.external_id) || record.id,
  type: movementType(record.type),
  occurredAt: stringValue(record.occurred_at),
  toolId: optionalString(record.tool_external_id),
  technicianId: optionalString(record.technician_external_id),
  batchId: optionalString(record.batch_external_id),
  identificationMethod: identificationMethod(record.identification_method),
  scanMethod: scanMethod(record.scan_method),
  detail: stringValue(record.detail),
});

async function loadRemoteWorkspace(workspace: string): Promise<RemoteWorkspace> {
  const [technicians, tools, batches, movements] = await Promise.all([
    listRecords(COLLECTIONS.technicians, workspace),
    listRecords(COLLECTIONS.tools, workspace),
    listRecords(COLLECTIONS.batches, workspace),
    listRecords(COLLECTIONS.movements, workspace),
  ]);

  return {
    data: normalizeAppData({
      schemaVersion: 3,
      technicians: technicians.map(remoteTechnician),
      tools: tools.map(remoteTool),
      batches: batches.map(remoteBatch),
      movements: movements.map(remoteMovement),
      toolCategories: [],
      technicianCategories: [],
      locations: [],
    }) ?? {
      schemaVersion: 3,
      technicians: [],
      tools: [],
      batches: [],
      movements: [],
      toolCategories: [],
      technicianCategories: [],
      locations: [],
    },
    records: { technicians, tools, batches, movements },
  };
}

function mergeMutable<T extends { id: string }>(
  local: T[],
  remote: T[],
  updatedAt: (value: T) => string,
): T[] {
  const merged = new Map<string, T>();
  for (const item of remote) merged.set(item.id, item);
  for (const item of local) {
    const current = merged.get(item.id);
    if (!current || updatedAt(item) >= updatedAt(current)) merged.set(item.id, item);
  }
  return [...merged.values()];
}

function mergeImmutable<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const merged = new Map<string, T>();
  for (const item of remote) merged.set(item.id, item);
  for (const item of local) merged.set(item.id, item);
  return [...merged.values()];
}

export function mergeWorkspaceData(local: AppData, remote: AppData): AppData {
  const merged = {
    schemaVersion: 3 as const,
    technicians: mergeMutable(local.technicians, remote.technicians, (item) => item.updatedAt)
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    tools: mergeMutable(local.tools, remote.tools, (item) => item.updatedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    batches: mergeImmutable(local.batches, remote.batches)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
    movements: mergeImmutable(local.movements, remote.movements)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    toolCategories: local.toolCategories ?? remote.toolCategories ?? [],
    technicianCategories: local.technicianCategories ?? remote.technicianCategories ?? [],
    locations: local.locations ?? remote.locations ?? [],
  };
  return normalizeAppData(merged) ?? merged;
}

const indexByExternalId = (records: PocketBaseRecord[]): Map<string, PocketBaseRecord> => {
  const result = new Map<string, PocketBaseRecord>();
  for (const record of records) {
    const externalId = stringValue(record.external_id);
    if (externalId) result.set(externalId, record);
  }
  return result;
};

async function upsertMutable(
  collection: string,
  workspace: string,
  values: Array<{ id: string; updatedAt: string; payload: Record<string, unknown> }>,
  remoteRecords: PocketBaseRecord[],
): Promise<number> {
  const remote = indexByExternalId(remoteRecords);
  let changed = 0;
  for (const value of values) {
    const current = remote.get(value.id);
    if (!current) {
      await createRecord(collection, { workspace, external_id: value.id, ...value.payload });
      changed += 1;
      continue;
    }
    const remoteUpdated = stringValue(current.source_updated);
    if (value.updatedAt > remoteUpdated) {
      await updateRecord(collection, current.id, value.payload);
      changed += 1;
    }
  }
  return changed;
}

async function createMissing(
  collection: string,
  workspace: string,
  values: Array<{ id: string; payload: Record<string, unknown> }>,
  remoteRecords: PocketBaseRecord[],
): Promise<number> {
  const remote = indexByExternalId(remoteRecords);
  let changed = 0;
  for (const value of values) {
    if (remote.has(value.id)) continue;
    await createRecord(collection, { workspace, external_id: value.id, ...value.payload });
    changed += 1;
  }
  return changed;
}

async function pushWorkspace(data: AppData, profile: CloudProfile, remote: RemoteWorkspace): Promise<number> {
  const workspace = profile.workspace;
  let uploaded = 0;

  uploaded += await upsertMutable(
    COLLECTIONS.technicians,
    workspace,
    data.technicians.map((technician) => ({
      id: technician.id,
      updatedAt: technician.updatedAt,
      payload: {
        code: technician.code,
        name: technician.name,
        category: technician.category,
        category_external_id: technician.categoryId ?? '',
        technician_status: technician.status ?? (technician.active ? 'active' : 'inactive'),
        company: technician.company ?? '',
        department: technician.department ?? '',
        notes: technician.notes ?? '',
        photo_refs: technician.photos ?? [],
        phone: technician.phone ?? '',
        email: technician.email ?? '',
        qr_payload: technician.qrPayload ?? `ISIVOLTPRO:TECH:${technician.code}`,
        nfc_tag: technician.nfcTag ?? '',
        active: technician.active,
        source_created: technician.createdAt,
        source_updated: technician.updatedAt,
      },
    })),
    remote.records.technicians,
  );

  uploaded += await upsertMutable(
    COLLECTIONS.tools,
    workspace,
    data.tools.map((tool) => ({
      id: tool.id,
      updatedAt: tool.updatedAt,
      payload: {
        code: tool.code,
        name: tool.name,
        category: tool.category,
        category_external_id: tool.categoryId ?? '',
        location: tool.location,
        location_external_id: tool.locationId ?? '',
        tool_kind: tool.kind ?? 'returnable-tool',
        service_state: tool.serviceState ?? (tool.status === 'review' ? 'review' : tool.status === 'retired' ? 'retired' : 'ready'),
        description: tool.description ?? '',
        notes: tool.notes ?? '',
        photo_refs: tool.photos ?? [],
        brand: tool.brand ?? '',
        model: tool.model ?? '',
        serial_number: tool.serialNumber ?? '',
        purchase_date: tool.purchaseDate ?? '',
        purchase_price: tool.purchasePrice ?? null,
        review_due_date: tool.reviewDueDate ?? '',
        calibration_due_date: tool.calibrationDueDate ?? '',
        review_interval_days: tool.reviewIntervalDays ?? null,
        calibration_interval_days: tool.calibrationIntervalDays ?? null,
        quantity: tool.quantity ?? null,
        min_stock: tool.minStock ?? null,
        unit: tool.unit ?? '',
        qr_payload: tool.qrPayload,
        nfc_tag: tool.nfcTag ?? '',
        status: tool.status,
        technician_external_id: tool.technicianId ?? '',
        source_created: tool.createdAt,
        source_updated: tool.updatedAt,
      },
    })),
    remote.records.tools,
  );

  uploaded += await createMissing(
    COLLECTIONS.batches,
    workspace,
    data.batches.map((batch) => ({
      id: batch.id,
      payload: {
        operation: batch.operation,
        technician_external_id: batch.technicianId,
        tool_ids: batch.toolIds,
        operator_mode: batch.operatorMode,
        identification_method: batch.identificationMethod,
        scan_method: batch.scanMethod,
        started_at: batch.startedAt,
        completed_at: batch.completedAt,
      },
    })),
    remote.records.batches,
  );

  uploaded += await createMissing(
    COLLECTIONS.movements,
    workspace,
    data.movements.map((movement) => ({
      id: movement.id,
      payload: {
        type: movement.type,
        occurred_at: movement.occurredAt,
        tool_external_id: movement.toolId ?? '',
        technician_external_id: movement.technicianId ?? '',
        batch_external_id: movement.batchId ?? '',
        identification_method: movement.identificationMethod ?? '',
        scan_method: movement.scanMethod ?? '',
        detail: movement.detail,
      },
    })),
    remote.records.movements,
  );

  return uploaded;
}

export async function synchronizeWorkspace(local: AppData, profile: CloudProfile): Promise<SyncResult> {
  const normalizedLocal = normalizeAppData(local) ?? local;
  const firstRemote = await loadRemoteWorkspace(profile.workspace);
  const merged = mergeWorkspaceData(normalizedLocal, firstRemote.data);
  const uploaded = await pushWorkspace(merged, profile, firstRemote);
  const finalRemote = uploaded > 0 ? await loadRemoteWorkspace(profile.workspace) : firstRemote;
  const finalData = mergeWorkspaceData(merged, finalRemote.data);

  const localIds = new Set([
    ...normalizedLocal.technicians.map((item) => `t:${item.id}`),
    ...normalizedLocal.tools.map((item) => `i:${item.id}`),
    ...normalizedLocal.batches.map((item) => `b:${item.id}`),
    ...normalizedLocal.movements.map((item) => `m:${item.id}`),
  ]);
  const downloaded = [
    ...finalData.technicians.map((item) => `t:${item.id}`),
    ...finalData.tools.map((item) => `i:${item.id}`),
    ...finalData.batches.map((item) => `b:${item.id}`),
    ...finalData.movements.map((item) => `m:${item.id}`),
  ].filter((id) => !localIds.has(id)).length;

  return { data: finalData, uploaded, downloaded };
}
