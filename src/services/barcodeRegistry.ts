import { Preferences } from '@capacitor/preferences';
import type { AppData, Technician } from '../domain/types';

const BARCODE_REGISTRY_KEY = 'isivolt.technician-barcode-registry.v1';

export type TechnicianBarcodeRegistry = Record<string, string>;

export class BarcodeRegistryError extends Error {
  constructor(
    public readonly code:
      | 'empty-code'
      | 'technician-not-found'
      | 'barcode-already-assigned',
    message: string,
  ) {
    super(message);
    this.name = 'BarcodeRegistryError';
  }
}

/**
 * Normaliza el contenido real de una tarjeta para que la lectura por cámara y
 * la introducción manual coincidan aunque el número impreso incluya espacios,
 * guiones, puntos u otros separadores visuales.
 */
export const normalizeBarcodeValue = (value?: string | null) => (value ?? '')
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '');

const parseRegistry = (raw: string | null): TechnicianBarcodeRegistry => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([barcode, technicianId]) => [
          normalizeBarcodeValue(barcode),
          typeof technicianId === 'string' ? technicianId : '',
        ])
        .filter(([barcode, technicianId]) => Boolean(barcode && technicianId)),
    );
  } catch {
    return {};
  }
};

export const loadTechnicianBarcodeRegistry = async (): Promise<TechnicianBarcodeRegistry> => {
  const { value } = await Preferences.get({ key: BARCODE_REGISTRY_KEY });
  return parseRegistry(value);
};

export const saveTechnicianBarcodeRegistry = async (
  registry: TechnicianBarcodeRegistry,
): Promise<void> => {
  const normalized = Object.fromEntries(
    Object.entries(registry)
      .map(([barcode, technicianId]) => [normalizeBarcodeValue(barcode), technicianId.trim()])
      .filter(([barcode, technicianId]) => Boolean(barcode && technicianId)),
  );

  await Preferences.set({
    key: BARCODE_REGISTRY_KEY,
    value: JSON.stringify(normalized),
  });
};

export const barcodeForTechnician = (
  registry: TechnicianBarcodeRegistry,
  technicianId: string,
  data?: AppData,
): string | undefined => {
  const stored = data?.technicians.find((technician) => technician.id === technicianId)?.barcodeValue;
  return normalizeBarcodeValue(stored) || Object.entries(registry)
    .find(([, assignedTechnicianId]) => assignedTechnicianId === technicianId)?.[0];
};

export const resolveTechnicianBarcode = (
  registry: TechnicianBarcodeRegistry,
  data: AppData,
  rawValue: string,
): Technician | undefined => {
  const barcode = normalizeBarcodeValue(rawValue);
  const storedTechnician = data.technicians.find(
    (technician) => normalizeBarcodeValue(technician.barcodeValue) === barcode,
  );
  if (storedTechnician) return storedTechnician;

  const technicianId = registry[barcode];
  if (!technicianId) return undefined;
  return data.technicians.find((technician) => technician.id === technicianId);
};

export const assignTechnicianBarcode = async (
  data: AppData,
  technicianId: string,
  rawValue: string,
): Promise<TechnicianBarcodeRegistry> => {
  const barcode = normalizeBarcodeValue(rawValue);
  if (!barcode) {
    throw new BarcodeRegistryError('empty-code', 'No se ha leído ningún código de barras.');
  }

  const technician = data.technicians.find((item) => item.id === technicianId);
  if (!technician) {
    throw new BarcodeRegistryError('technician-not-found', 'El técnico seleccionado ya no existe.');
  }

  const storedOwner = data.technicians.find(
    (item) => item.id !== technicianId && normalizeBarcodeValue(item.barcodeValue) === barcode,
  );
  if (storedOwner) {
    throw new BarcodeRegistryError(
      'barcode-already-assigned',
      `La tarjeta ${barcode} ya está vinculada a ${storedOwner.name}.`,
    );
  }

  const current = await loadTechnicianBarcodeRegistry();
  const assignedTo = current[barcode];
  if (assignedTo && assignedTo !== technicianId) {
    const assignedTechnician = data.technicians.find((item) => item.id === assignedTo);
    throw new BarcodeRegistryError(
      'barcode-already-assigned',
      `La tarjeta ${barcode} ya está vinculada a ${assignedTechnician?.name ?? 'otro técnico'}.`,
    );
  }

  const next = Object.fromEntries(
    Object.entries(current).filter(([, assignedTechnicianId]) => assignedTechnicianId !== technicianId),
  );
  next[barcode] = technicianId;
  await saveTechnicianBarcodeRegistry(next);
  return next;
};

export const removeTechnicianBarcode = async (
  technicianId: string,
): Promise<TechnicianBarcodeRegistry> => {
  const current = await loadTechnicianBarcodeRegistry();
  const next = Object.fromEntries(
    Object.entries(current).filter(([, assignedTechnicianId]) => assignedTechnicianId !== technicianId),
  );
  await saveTechnicianBarcodeRegistry(next);
  return next;
};
