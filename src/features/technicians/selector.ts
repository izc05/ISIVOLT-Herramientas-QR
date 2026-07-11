import type { Technician, Tool } from '../../domain/types';

export const BASE_TECHNICIAN_CATEGORIES = [
  'Electricidad',
  'Climatización',
  'Fontanería',
  'Infraestructura',
  'Telecomunicaciones',
  'Electromedicina',
  'Almacén',
  'Mantenimiento',
  'Otros',
] as const;

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

export const buildTechnicianCategories = (technicians: Technician[]) => {
  const existing = technicians
    .map((technician) => technician.specialty.trim())
    .filter(Boolean);
  return [...new Set([...BASE_TECHNICIAN_CATEGORIES, ...existing])]
    .sort((a, b) => {
      const baseA = BASE_TECHNICIAN_CATEGORIES.indexOf(a as typeof BASE_TECHNICIAN_CATEGORIES[number]);
      const baseB = BASE_TECHNICIAN_CATEGORIES.indexOf(b as typeof BASE_TECHNICIAN_CATEGORIES[number]);
      if (baseA >= 0 && baseB >= 0) return baseA - baseB;
      if (baseA >= 0) return -1;
      if (baseB >= 0) return 1;
      return a.localeCompare(b, 'es');
    });
};

export const buildLoanCountByTechnician = (tools: Tool[]) => {
  const counts = new Map<string, number>();
  for (const tool of tools) {
    if (tool.status !== 'loaned' || !tool.holderTechnicianId) continue;
    counts.set(tool.holderTechnicianId, (counts.get(tool.holderTechnicianId) ?? 0) + 1);
  }
  return counts;
};

export const filterSelectableTechnicians = (
  technicians: Technician[],
  query: string,
  category: string,
) => {
  const needle = normalize(query);
  return technicians
    .filter((technician) => technician.active)
    .filter((technician) => category === 'Todas' || technician.specialty === category)
    .filter((technician) => {
      if (!needle) return true;
      return [
        technician.name,
        technician.code,
        technician.specialty,
        technician.role ?? '',
        technician.phone ?? '',
        technician.extension ?? '',
      ].some((value) => normalize(value).includes(needle));
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
};

export const getTechnicianInitials = (name: string) => name
  .split(/\s+/)
  .filter(Boolean)
  .map((part) => part[0])
  .slice(0, 2)
  .join('')
  .toUpperCase();
