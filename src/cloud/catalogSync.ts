import type { AppData, CatalogEntry, LocationEntry } from '../types';
import type { CloudProfile } from './config';
import { createRecord, listRecords, type PocketBaseRecord, updateRecord } from './pocketbaseClient';

const COLLECTIONS = {
  toolCategories: 'isivolt_tool_categories',
  technicianCategories: 'isivolt_technician_categories',
  locations: 'isivolt_locations',
} as const;

export type CatalogSyncResult = {
  data: AppData;
  uploaded: number;
  downloaded: number;
};

const text = (value: unknown): string => typeof value === 'string' ? value : '';
const optionalText = (value: unknown): string | undefined => {
  const result = text(value).trim();
  return result || undefined;
};

const remoteCatalog = (record: PocketBaseRecord): CatalogEntry => ({
  id: text(record.external_id) || record.id,
  name: text(record.name),
  code: optionalText(record.code),
  color: optionalText(record.color),
  icon: optionalText(record.icon),
  active: record.active !== false,
  createdAt: text(record.source_created) || text(record.created),
  updatedAt: text(record.source_updated) || text(record.updated),
});

const remoteLocation = (record: PocketBaseRecord): LocationEntry => ({
  ...remoteCatalog(record),
  parentId: optionalText(record.parent_external_id),
  description: optionalText(record.description),
});

const mergeMutable = <T extends CatalogEntry>(local: T[], remote: T[]): T[] => {
  const merged = new Map<string, T>();
  for (const item of remote) merged.set(item.id, item);
  for (const item of local) {
    const current = merged.get(item.id);
    if (!current || item.updatedAt >= current.updatedAt) merged.set(item.id, item);
  }
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
};

const recordsByExternalId = (records: PocketBaseRecord[]) => {
  const result = new Map<string, PocketBaseRecord>();
  for (const record of records) {
    const externalId = text(record.external_id);
    if (externalId) result.set(externalId, record);
  }
  return result;
};

async function pushEntries(
  collection: string,
  workspace: string,
  entries: Array<CatalogEntry | LocationEntry>,
  records: PocketBaseRecord[],
  location = false,
): Promise<number> {
  const remote = recordsByExternalId(records);
  let changed = 0;
  for (const entry of entries) {
    const payload: Record<string, unknown> = {
      name: entry.name,
      code: entry.code ?? '',
      color: entry.color ?? '',
      icon: entry.icon ?? '',
      active: entry.active,
      source_created: entry.createdAt,
      source_updated: entry.updatedAt,
    };
    if (location) {
      const item = entry as LocationEntry;
      payload.parent_external_id = item.parentId ?? '';
      payload.description = item.description ?? '';
    }
    const current = remote.get(entry.id);
    if (!current) {
      await createRecord(collection, { workspace, external_id: entry.id, ...payload });
      changed += 1;
      continue;
    }
    if (entry.updatedAt > text(current.source_updated)) {
      await updateRecord(collection, current.id, payload);
      changed += 1;
    }
  }
  return changed;
}

export async function synchronizeCatalogs(data: AppData, profile: CloudProfile): Promise<CatalogSyncResult> {
  const [toolRecords, technicianRecords, locationRecords] = await Promise.all([
    listRecords(COLLECTIONS.toolCategories, profile.workspace),
    listRecords(COLLECTIONS.technicianCategories, profile.workspace),
    listRecords(COLLECTIONS.locations, profile.workspace),
  ]);

  const remoteToolCategories = toolRecords.map(remoteCatalog);
  const remoteTechnicianCategories = technicianRecords.map(remoteCatalog);
  const remoteLocations = locationRecords.map(remoteLocation);

  const localToolCategories = data.toolCategories ?? [];
  const localTechnicianCategories = data.technicianCategories ?? [];
  const localLocations = data.locations ?? [];

  const mergedToolCategories = profile.role === 'technician' && remoteToolCategories.length
    ? remoteToolCategories
    : mergeMutable(localToolCategories, remoteToolCategories);
  const mergedTechnicianCategories = profile.role === 'technician' && remoteTechnicianCategories.length
    ? remoteTechnicianCategories
    : mergeMutable(localTechnicianCategories, remoteTechnicianCategories);
  const mergedLocations = profile.role === 'technician' && remoteLocations.length
    ? remoteLocations
    : mergeMutable(localLocations, remoteLocations);

  let uploaded = 0;
  if (profile.role !== 'technician') {
    uploaded += await pushEntries(COLLECTIONS.toolCategories, profile.workspace, mergedToolCategories, toolRecords);
    uploaded += await pushEntries(COLLECTIONS.technicianCategories, profile.workspace, mergedTechnicianCategories, technicianRecords);
    uploaded += await pushEntries(COLLECTIONS.locations, profile.workspace, mergedLocations, locationRecords, true);
  }

  const localIds = new Set([
    ...localToolCategories.map((entry) => `tool:${entry.id}:${entry.updatedAt}`),
    ...localTechnicianCategories.map((entry) => `technician:${entry.id}:${entry.updatedAt}`),
    ...localLocations.map((entry) => `location:${entry.id}:${entry.updatedAt}`),
  ]);
  const downloaded = [
    ...remoteToolCategories.map((entry) => `tool:${entry.id}:${entry.updatedAt}`),
    ...remoteTechnicianCategories.map((entry) => `technician:${entry.id}:${entry.updatedAt}`),
    ...remoteLocations.map((entry) => `location:${entry.id}:${entry.updatedAt}`),
  ].filter((key) => !localIds.has(key)).length;

  return {
    data: {
      ...data,
      schemaVersion: 3,
      toolCategories: mergedToolCategories,
      technicianCategories: mergedTechnicianCategories,
      locations: mergedLocations,
    },
    uploaded,
    downloaded,
  };
}
