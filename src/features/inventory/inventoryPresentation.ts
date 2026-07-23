import type { AppData, Movement, ToolStatus } from '../../domain/types';
import { DEMO_TOOL_IMAGES } from '../../data/demoToolImages';

export type PresentationCategory = {
  key: string;
  label: string;
  accent: string;
  soft: string;
};

const TOOL_CATEGORIES: PresentationCategory[] = [
  { key: 'measurement', label: 'Medición', accent: '#35c6ff', soft: 'rgba(53, 198, 255, .14)' },
  { key: 'electrical', label: 'Eléctrica', accent: '#ffb020', soft: 'rgba(255, 176, 32, .14)' },
  { key: 'thermal', label: 'Termografía', accent: '#a970ff', soft: 'rgba(169, 112, 255, .14)' },
  { key: 'manual', label: 'Manuales', accent: '#42e6a4', soft: 'rgba(66, 230, 164, .14)' },
  { key: 'safety', label: 'Seguridad', accent: '#ff6680', soft: 'rgba(255, 102, 128, .14)' },
  { key: 'auxiliary', label: 'Auxiliar', accent: '#8ba0b8', soft: 'rgba(139, 160, 184, .14)' },
  { key: 'general', label: 'Otras', accent: '#5b8cff', soft: 'rgba(91, 140, 255, .14)' },
];

const TECHNICIAN_ACCENTS = ['#35c6ff', '#42e6a4', '#ffb020', '#a970ff', '#ff6680', '#54d4e8', '#c2e36b'];

const normalize = (value: string) => value.trim().toLocaleLowerCase('es-ES');

export const resolveToolCategory = (value: string): PresentationCategory => {
  const normalized = normalize(value);
  if (normalized.includes('termograf') || normalized.includes('térmic')) return TOOL_CATEGORIES[2];
  if (normalized.includes('medida') || normalized.includes('medición') || normalized.includes('instrument')) return TOOL_CATEGORIES[0];
  if (normalized.includes('seguridad') || normalized.includes('protección')) return TOOL_CATEGORIES[4];
  if (normalized.includes('manual') || normalized.includes('alicate') || normalized.includes('destornill')) return TOOL_CATEGORIES[3];
  if (normalized.includes('eléctr') || normalized.includes('electr')) return TOOL_CATEGORIES[1];
  if (normalized.includes('auxiliar') || normalized.includes('material')) return TOOL_CATEGORIES[5];
  return TOOL_CATEGORIES[6];
};

export const resolveTechnicianAccent = (specialty: string): string => {
  const normalized = normalize(specialty);
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(index)) | 0;
  }
  return TECHNICIAN_ACCENTS[Math.abs(hash) % TECHNICIAN_ACCENTS.length];
};

export const listToolCategories = (data: AppData): Array<PresentationCategory & { count: number }> => {
  const counts = new Map<string, number>();
  data.tools.forEach((tool) => {
    const category = resolveToolCategory(tool.category);
    counts.set(category.key, (counts.get(category.key) ?? 0) + 1);
  });
  return TOOL_CATEGORIES
    .filter((category) => (counts.get(category.key) ?? 0) > 0)
    .map((category) => ({ ...category, count: counts.get(category.key) ?? 0 }));
};

export const applyDemoToolImages = (data: AppData): { data: AppData; changed: boolean } => {
  let changed = false;
  const tools = data.tools.map((tool) => {
    if (tool.imageDataUrl || !DEMO_TOOL_IMAGES[tool.code]) return tool;
    changed = true;
    return {
      ...tool,
      imageDataUrl: DEMO_TOOL_IMAGES[tool.code],
      imageUpdatedAt: tool.imageUpdatedAt ?? tool.updatedAt,
    };
  });
  return changed ? { data: { ...data, tools }, changed } : { data, changed };
};

const createId = (prefix: string) => {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
};

const statusLabel: Record<ToolStatus, string> = {
  available: 'Disponible',
  loaned: 'Prestada',
  review: 'En revisión',
  damaged: 'Averiada',
  retired: 'Baja',
};

export const canUnlockTool = (status: ToolStatus): boolean => status === 'review' || status === 'damaged';

export const unlockToolData = (
  data: AppData,
  toolId: string,
  operatorName = 'Isi',
  occurredAt = new Date().toISOString(),
): { data: AppData; changed: boolean } => {
  const current = data.tools.find((tool) => tool.id === toolId);
  if (!current || !canUnlockTool(current.status)) return { data, changed: false };

  const previousStatus = current.status;
  const tools = data.tools.map((tool) => tool.id === toolId
    ? {
        ...tool,
        status: 'available' as ToolStatus,
        serviceStatus: 'none' as const,
        reservedTechnicianId: undefined,
        holderTechnicianId: undefined,
        loanedAt: undefined,
        updatedAt: occurredAt,
      }
    : tool);

  const movement: Movement = {
    id: createId('mov-unlock'),
    operationId: createId('op-unlock'),
    type: 'adjustment',
    toolId,
    operatorName,
    occurredAt,
    previousStatus,
    nextStatus: 'available',
    notes: `Desbloqueo manual autorizado. Estado anterior: ${statusLabel[previousStatus]}.`,
    syncStatus: 'pending',
  };

  return {
    changed: true,
    data: {
      ...data,
      tools,
      movements: [movement, ...data.movements],
    },
  };
};
