import { getCloudProfile, type CloudProfile } from './cloud/config';
import type {
  AppData,
  CatalogEntry,
  LocationEntry,
  PhotoReference,
  Technician,
  TechnicianStatus,
  Tool,
  ToolKind,
  ToolServiceState,
  ToolStatus,
} from './types';

const LOCAL_STORAGE_KEY = 'isivoltpro-herramientas-v2:data';
const CLOUD_STORAGE_PREFIX = 'isivoltpro-herramientas-v2:data:cloud';
export const WORKSPACE_DATA_EVENT = 'isivoltpro-v2:data-changed';

const toolKinds = new Set<ToolKind>(['returnable-tool', 'loanable-material', 'measuring-equipment', 'kit', 'ppe', 'consumable', 'other']);
const toolServiceStates = new Set<ToolServiceState>(['ready', 'reserved', 'review', 'repair', 'lost', 'retired']);
const toolStatuses = new Set<ToolStatus>(['available', 'loaned', 'review', 'retired']);
const technicianStatuses = new Set<TechnicianStatus>(['active', 'inactive', 'absent', 'vacation', 'leave', 'blocked']);

const stringValue = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const optionalString = (value: unknown): string | undefined => stringValue(value) || undefined;
const optionalNumber = (value: unknown): number | undefined => {
  if (value === '' || value === null || value === undefined) return undefined;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
};
const booleanValue = (value: unknown, fallback: boolean): boolean => typeof value === 'boolean' ? value : fallback;
const timestamp = (value: unknown): string => stringValue(value) || new Date().toISOString();

const slug = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 72) || 'sin-nombre';

const catalogId = (prefix: string, name: string): string => `${prefix}-${slug(name)}`;
const technicianQr = (technician: Pick<Technician, 'code' | 'qrPayload'>) => technician.qrPayload ?? `ISIVOLTPRO:TECH:${technician.code}`;

const normalizePhotos = (value: unknown): PhotoReference[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const photo = entry as Partial<PhotoReference>;
    const id = stringValue(photo.id);
    const filename = stringValue(photo.filename);
    const mimeType = stringValue(photo.mimeType);
    if (!id || !filename || !mimeType) return [];
    return [{
      id,
      storage: photo.storage === 'pocketbase' ? 'pocketbase' : 'indexeddb',
      filename,
      mimeType,
      primary: photo.primary === true || undefined,
      remoteId: optionalString(photo.remoteId),
      createdAt: timestamp(photo.createdAt),
    }];
  });
};

const normalizeCatalogEntries = (
  value: unknown,
  derivedNames: string[],
  prefix: string,
): CatalogEntry[] => {
  const entries = new Map<string, CatalogEntry>();
  if (Array.isArray(value)) {
    for (const raw of value) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Partial<CatalogEntry>;
      const name = stringValue(item.name);
      if (!name) continue;
      const id = stringValue(item.id) || catalogId(prefix, name);
      entries.set(id, {
        id,
        name,
        code: optionalString(item.code),
        color: optionalString(item.color),
        icon: optionalString(item.icon),
        active: booleanValue(item.active, true),
        createdAt: timestamp(item.createdAt),
        updatedAt: timestamp(item.updatedAt),
      });
    }
  }

  for (const name of derivedNames.map((item) => item.trim()).filter(Boolean)) {
    const existing = [...entries.values()].find((item) => item.name.toLocaleLowerCase('es-ES') === name.toLocaleLowerCase('es-ES'));
    if (existing) continue;
    const id = catalogId(prefix, name);
    const now = new Date().toISOString();
    entries.set(id, { id, name, active: true, createdAt: now, updatedAt: now });
  }

  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
};

const normalizeLocations = (value: unknown, derivedNames: string[]): LocationEntry[] => {
  const entries = new Map<string, LocationEntry>();
  if (Array.isArray(value)) {
    for (const raw of value) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Partial<LocationEntry>;
      const name = stringValue(item.name);
      if (!name) continue;
      const id = stringValue(item.id) || catalogId('location', name);
      entries.set(id, {
        id,
        name,
        code: optionalString(item.code),
        color: optionalString(item.color),
        icon: optionalString(item.icon),
        parentId: optionalString(item.parentId),
        description: optionalString(item.description),
        active: booleanValue(item.active, true),
        createdAt: timestamp(item.createdAt),
        updatedAt: timestamp(item.updatedAt),
      });
    }
  }

  for (const name of derivedNames.map((item) => item.trim()).filter(Boolean)) {
    const existing = [...entries.values()].find((item) => item.name.toLocaleLowerCase('es-ES') === name.toLocaleLowerCase('es-ES'));
    if (existing) continue;
    const id = catalogId('location', name);
    const now = new Date().toISOString();
    entries.set(id, { id, name, active: true, createdAt: now, updatedAt: now });
  }

  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
};

const defaultServiceState = (status: ToolStatus): ToolServiceState => {
  if (status === 'review') return 'review';
  if (status === 'retired') return 'retired';
  return 'ready';
};

const normalizeTool = (value: unknown): Tool | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<Tool>;
  const id = stringValue(item.id);
  const code = stringValue(item.code);
  const name = stringValue(item.name);
  if (!id || !code || !name) return null;
  const status = toolStatuses.has(item.status as ToolStatus) ? item.status as ToolStatus : 'available';
  const category = stringValue(item.category) || 'Sin categoría';
  const location = stringValue(item.location) || 'Sin ubicación';
  const kind = toolKinds.has(item.kind as ToolKind) ? item.kind as ToolKind : 'returnable-tool';
  const serviceState = toolServiceStates.has(item.serviceState as ToolServiceState)
    ? item.serviceState as ToolServiceState
    : defaultServiceState(status);

  return {
    id,
    code,
    name,
    category,
    categoryId: optionalString(item.categoryId) ?? catalogId('tool-category', category),
    location,
    locationId: optionalString(item.locationId) ?? catalogId('location', location),
    kind,
    serviceState,
    description: optionalString(item.description),
    notes: optionalString(item.notes),
    photos: normalizePhotos(item.photos),
    brand: optionalString(item.brand),
    model: optionalString(item.model),
    serialNumber: optionalString(item.serialNumber),
    purchaseDate: optionalString(item.purchaseDate),
    purchasePrice: optionalNumber(item.purchasePrice),
    reviewDueDate: optionalString(item.reviewDueDate),
    calibrationDueDate: optionalString(item.calibrationDueDate),
    reviewIntervalDays: optionalNumber(item.reviewIntervalDays),
    calibrationIntervalDays: optionalNumber(item.calibrationIntervalDays),
    quantity: optionalNumber(item.quantity),
    minStock: optionalNumber(item.minStock),
    unit: optionalString(item.unit),
    qrPayload: stringValue(item.qrPayload) || `ISIVOLTPRO:TOOL:${code}`,
    nfcTag: optionalString(item.nfcTag),
    status,
    technicianId: optionalString(item.technicianId),
    createdAt: timestamp(item.createdAt),
    updatedAt: timestamp(item.updatedAt),
  };
};

const normalizeTechnician = (value: unknown): Technician | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<Technician>;
  const id = stringValue(item.id);
  const code = stringValue(item.code);
  const name = stringValue(item.name);
  if (!id || !code || !name) return null;
  const category = stringValue(item.category) || 'Sin categoría';
  const active = booleanValue(item.active, true);
  const status = technicianStatuses.has(item.status as TechnicianStatus)
    ? item.status as TechnicianStatus
    : active ? 'active' : 'inactive';

  return {
    id,
    code,
    name,
    category,
    categoryId: optionalString(item.categoryId) ?? catalogId('technician-category', category),
    status,
    company: optionalString(item.company),
    department: optionalString(item.department),
    notes: optionalString(item.notes),
    photos: normalizePhotos(item.photos),
    phone: optionalString(item.phone),
    email: optionalString(item.email),
    qrPayload: technicianQr({ code, qrPayload: optionalString(item.qrPayload) }),
    nfcTag: optionalString(item.nfcTag),
    active: status === 'active' ? true : status === 'inactive' || status === 'blocked' ? false : active,
    createdAt: timestamp(item.createdAt),
    updatedAt: timestamp(item.updatedAt),
  };
};

export const emptyData = (): AppData => ({
  schemaVersion: 3,
  tools: [],
  technicians: [],
  movements: [],
  batches: [],
  toolCategories: [],
  technicianCategories: [],
  locations: [],
});

export const normalizeAppData = (value: unknown): AppData | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<AppData> & { schemaVersion?: number };
  if ((candidate.schemaVersion !== 2 && candidate.schemaVersion !== 3)
    || !Array.isArray(candidate.tools)
    || !Array.isArray(candidate.technicians)
    || !Array.isArray(candidate.movements)) return null;

  const tools = candidate.tools.map(normalizeTool).filter((item): item is Tool => Boolean(item));
  const technicians = candidate.technicians.map(normalizeTechnician).filter((item): item is Technician => Boolean(item));
  const toolCategories = normalizeCatalogEntries(candidate.toolCategories, tools.map((tool) => tool.category), 'tool-category');
  const technicianCategories = normalizeCatalogEntries(candidate.technicianCategories, technicians.map((technician) => technician.category), 'technician-category');
  const locations = normalizeLocations(candidate.locations, tools.map((tool) => tool.location));

  const categoryByName = new Map(toolCategories.map((item) => [item.name.toLocaleLowerCase('es-ES'), item.id]));
  const technicianCategoryByName = new Map(technicianCategories.map((item) => [item.name.toLocaleLowerCase('es-ES'), item.id]));
  const locationByName = new Map(locations.map((item) => [item.name.toLocaleLowerCase('es-ES'), item.id]));

  return {
    schemaVersion: 3,
    tools: tools.map((tool) => ({
      ...tool,
      categoryId: tool.categoryId ?? categoryByName.get(tool.category.toLocaleLowerCase('es-ES')),
      locationId: tool.locationId ?? locationByName.get(tool.location.toLocaleLowerCase('es-ES')),
    })),
    technicians: technicians.map((technician) => ({
      ...technician,
      categoryId: technician.categoryId ?? technicianCategoryByName.get(technician.category.toLocaleLowerCase('es-ES')),
    })),
    movements: candidate.movements,
    batches: Array.isArray(candidate.batches) ? candidate.batches : [],
    toolCategories,
    technicianCategories,
    locations,
  };
};

const accountStorageKey = (profile: CloudProfile): string => [
  CLOUD_STORAGE_PREFIX,
  encodeURIComponent(profile.workspace),
  encodeURIComponent(profile.id),
].join(':');

export const activeStorageKey = (profile = getCloudProfile()): string => (
  profile ? accountStorageKey(profile) : LOCAL_STORAGE_KEY
);

const readKey = (key: string): AppData => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return emptyData();
    const normalized = normalizeAppData(JSON.parse(raw)) ?? emptyData();
    if (normalized.schemaVersion === 3) window.localStorage.setItem(key, JSON.stringify(normalized));
    return normalized;
  } catch {
    return emptyData();
  }
};

export const hasStoredData = (profile = getCloudProfile()): boolean => {
  try {
    const raw = window.localStorage.getItem(activeStorageKey(profile));
    if (!raw) return false;
    return normalizeAppData(JSON.parse(raw)) !== null;
  } catch {
    return false;
  }
};

export const hasMeaningfulData = (data: AppData): boolean => (
  data.tools.length > 0
  || data.technicians.length > 0
  || data.movements.length > 0
  || data.batches.length > 0
);

export const loadLocalData = (): AppData => readKey(LOCAL_STORAGE_KEY);

export const loadData = (): AppData => readKey(activeStorageKey());

export const loadDataForProfile = (profile: CloudProfile): AppData => readKey(accountStorageKey(profile));

export const saveData = (data: AppData): void => {
  const normalized = normalizeAppData(data) ?? emptyData();
  window.localStorage.setItem(activeStorageKey(), JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent<AppData>(WORKSPACE_DATA_EVENT, { detail: normalized }));
};

export const announceActiveData = (): AppData => {
  const data = loadData();
  window.dispatchEvent(new CustomEvent<AppData>(WORKSPACE_DATA_EVENT, { detail: data }));
  return data;
};

export const clearData = (): AppData => {
  const data = emptyData();
  saveData(data);
  return data;
};
