import { seedData } from '../../data/seed';
import type { AppData } from '../../domain/types';

const LEGACY_DEMO_TOOL_IDS = new Set([
  'tool-fluke-289',
  'tool-hilti-te30',
  'tool-camera',
  'tool-clamp',
  'tool-detector',
  'tool-extension',
]);

const LEGACY_DEMO_TECHNICIAN_IDS = new Set([
  'tech-antonio',
  'tech-marta',
  'tech-carlos',
]);

const LEGACY_DEMO_MOVEMENT_IDS = new Set([
  'mov-001',
  'mov-002',
  'mov-003',
  'mov-004',
]);

export const createFreshWorkspace = (): AppData => (
  JSON.parse(JSON.stringify(seedData)) as AppData
);

export const hasOperationalData = (data: AppData): boolean => (
  data.tools.length > 0
  || data.technicians.length > 0
  || data.movements.length > 0
  || (data.accessories ?? []).length > 0
  || (data.maintenanceRecords ?? []).length > 0
);

export const isLegacyDemoWorkspace = (data: AppData): boolean => (
  data.tools.every((item) => LEGACY_DEMO_TOOL_IDS.has(item.id))
  && data.technicians.every((item) => LEGACY_DEMO_TECHNICIAN_IDS.has(item.id))
  && data.movements.every((item) => LEGACY_DEMO_MOVEMENT_IDS.has(item.id))
  && (data.accessories ?? []).length === 0
  && (data.maintenanceRecords ?? []).length === 0
);
