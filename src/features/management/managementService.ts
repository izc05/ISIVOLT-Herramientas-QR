import type {
  AppData,
  MaintenanceRecord,
  Technician,
  Tool,
  ToolAccessory,
  ToolServiceStatus,
} from '../../domain/types';
import { canUseTechnicianCode, canUseToolCode } from '../../services/movementService';
import { loadAppData, saveAppData } from '../../services/storage';

const newId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const nowIso = () => new Date().toISOString();

export const getManagementData = (): AppData => {
  const data = loadAppData();
  return {
    ...data,
    accessories: data.accessories ?? [],
    maintenanceRecords: data.maintenanceRecords ?? [],
  };
};

const baseStatusForService = (serviceStatus: ToolServiceStatus | undefined, current: Tool['status']) => {
  if (!serviceStatus || serviceStatus === 'none' || serviceStatus === 'reserved') return current;
  if (serviceStatus === 'lost') return 'retired' as const;
  return current === 'loaned' ? current : 'review' as const;
};

export const saveManagedTool = (tool: Tool): AppData => {
  const data = getManagementData();
  const code = tool.code.trim().toUpperCase();
  if (!code || !tool.name.trim()) throw new Error('El código y el nombre son obligatorios.');
  if (!canUseToolCode(code, tool.id)) throw new Error(`El código ${code} ya pertenece a otra herramienta.`);

  const timestamp = nowIso();
  const serviceStatus = tool.serviceStatus ?? 'none';
  const saved: Tool = {
    ...tool,
    code,
    qrCode: `ISIVOLT:TOOL:${code}`,
    name: tool.name.trim(),
    category: tool.category.trim() || 'Sin categoría',
    location: tool.location.trim() || 'Sin ubicación',
    brand: tool.brand?.trim() || undefined,
    model: tool.model?.trim() || undefined,
    serialNumber: tool.serialNumber?.trim() || undefined,
    supplier: tool.supplier?.trim() || undefined,
    notes: tool.notes?.trim() || undefined,
    serviceStatus,
    reservedTechnicianId: serviceStatus === 'reserved' ? tool.reservedTechnicianId : undefined,
    status: baseStatusForService(serviceStatus, tool.status),
    active: serviceStatus === 'lost' || tool.status === 'retired' ? false : tool.active ?? true,
    updatedAt: timestamp,
  };

  const tools = data.tools.some((item) => item.id === saved.id)
    ? data.tools.map((item) => item.id === saved.id ? saved : item)
    : [{ ...saved, id: saved.id || newId('tool'), createdAt: saved.createdAt || timestamp }, ...data.tools];

  const next = { ...data, tools };
  saveAppData(next);
  return next;
};

export const createManagedTool = (): Tool => {
  const timestamp = nowIso();
  return {
    id: newId('tool'),
    code: '',
    qrCode: '',
    name: '',
    category: 'Herramienta general',
    location: 'Almacén principal',
    status: 'available',
    serviceStatus: 'none',
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const saveManagedTechnician = (technician: Technician): AppData => {
  const data = getManagementData();
  const code = technician.code.trim().toUpperCase();
  if (!code || !technician.name.trim()) throw new Error('El código y el nombre son obligatorios.');
  if (!canUseTechnicianCode(code, technician.id)) throw new Error(`El código ${code} ya pertenece a otro técnico.`);

  const timestamp = nowIso();
  const saved: Technician = {
    ...technician,
    code,
    name: technician.name.trim(),
    specialty: technician.specialty.trim() || 'Mantenimiento',
    role: technician.role?.trim() || undefined,
    phone: technician.phone?.trim() || undefined,
    extension: technician.extension?.trim() || undefined,
    email: technician.email?.trim() || undefined,
    updatedAt: timestamp,
  };
  const technicians = data.technicians.some((item) => item.id === saved.id)
    ? data.technicians.map((item) => item.id === saved.id ? saved : item)
    : [{ ...saved, id: saved.id || newId('tech'), createdAt: saved.createdAt || timestamp }, ...data.technicians];

  const next = { ...data, technicians };
  saveAppData(next);
  return next;
};

export const createManagedTechnician = (): Technician => {
  const data = getManagementData();
  const used = new Set(data.technicians.map((technician) => technician.code.toUpperCase()));
  let sequence = data.technicians.length + 1;
  while (used.has(`TEC-${String(sequence).padStart(3, '0')}`)) sequence += 1;
  const timestamp = nowIso();
  return {
    id: newId('tech'),
    code: `TEC-${String(sequence).padStart(3, '0')}`,
    name: '',
    specialty: 'Mantenimiento',
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const saveAccessory = (accessory: ToolAccessory): AppData => {
  const data = getManagementData();
  if (!data.tools.some((tool) => tool.id === accessory.toolId)) throw new Error('La herramienta del accesorio no existe.');
  if (!accessory.name.trim()) throw new Error('Escribe el nombre del accesorio.');

  const duplicated = (data.accessories ?? []).some(
    (item) => item.id !== accessory.id
      && item.toolId === accessory.toolId
      && item.name.trim().toLowerCase() === accessory.name.trim().toLowerCase()
      && item.active,
  );
  if (duplicated) throw new Error('La herramienta ya tiene un accesorio con ese nombre.');

  const timestamp = nowIso();
  const saved: ToolAccessory = {
    ...accessory,
    name: accessory.name.trim(),
    notes: accessory.notes?.trim() || undefined,
    condition: accessory.condition ?? 'not_checked',
    updatedAt: timestamp,
  };
  const accessories = (data.accessories ?? []).some((item) => item.id === saved.id)
    ? (data.accessories ?? []).map((item) => item.id === saved.id ? saved : item)
    : [{ ...saved, id: saved.id || newId('acc'), createdAt: saved.createdAt || timestamp }, ...(data.accessories ?? [])];

  const next = { ...data, accessories };
  saveAppData(next);
  return next;
};

export const createAccessory = (toolId: string): ToolAccessory => {
  const timestamp = nowIso();
  return {
    id: newId('acc'),
    toolId,
    name: '',
    required: true,
    active: true,
    condition: 'not_checked',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const archiveAccessory = (accessoryId: string): AppData => {
  const data = getManagementData();
  const timestamp = nowIso();
  const accessories = (data.accessories ?? []).map((item) =>
    item.id === accessoryId ? { ...item, active: false, updatedAt: timestamp } : item,
  );
  const next = { ...data, accessories };
  saveAppData(next);
  return next;
};

export const saveMaintenanceRecord = (record: MaintenanceRecord): AppData => {
  const data = getManagementData();
  if (!data.tools.some((tool) => tool.id === record.toolId)) throw new Error('La herramienta del expediente no existe.');
  if (!record.title.trim() || !record.description.trim()) throw new Error('Título y descripción son obligatorios.');

  const timestamp = nowIso();
  const saved: MaintenanceRecord = {
    ...record,
    title: record.title.trim(),
    description: record.description.trim(),
    resolution: record.resolution?.trim() || undefined,
    assignedTo: record.assignedTo?.trim() || undefined,
    parts: record.parts?.trim() || undefined,
    notes: record.notes?.trim() || undefined,
    completedAt: record.status === 'completed' ? record.completedAt ?? timestamp : undefined,
    updatedAt: timestamp,
  };
  const maintenanceRecords = (data.maintenanceRecords ?? []).some((item) => item.id === saved.id)
    ? (data.maintenanceRecords ?? []).map((item) => item.id === saved.id ? saved : item)
    : [{ ...saved, id: saved.id || newId('maint'), createdAt: saved.createdAt || timestamp }, ...(data.maintenanceRecords ?? [])];

  const next = { ...data, maintenanceRecords };
  saveAppData(next);
  return next;
};

export const createMaintenanceRecord = (toolId: string): MaintenanceRecord => {
  const timestamp = nowIso();
  return {
    id: newId('maint'),
    toolId,
    type: 'incident',
    status: 'open',
    title: '',
    description: '',
    operatorName: 'Almacén',
    openedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};
