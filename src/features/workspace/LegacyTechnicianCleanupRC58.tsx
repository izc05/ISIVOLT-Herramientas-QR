import { useEffect } from 'react';
import type { AppData, ToolStatus } from '../../domain/types';
import { loadAppData, saveAppData } from '../../services/storage';

const MIGRATION_KEY = 'isivolt:rc58:technician-cleanup:v1';

const cleanTechnicians = (data: AppData): AppData => {
  if (data.technicians.length === 0) return data;

  const removedIds = new Set(data.technicians.map((technician) => technician.id));
  const updatedAt = new Date().toISOString();

  return {
    ...data,
    technicians: [],
    tools: data.tools.map((tool) => {
      if (!tool.holderTechnicianId || !removedIds.has(tool.holderTechnicianId)) return tool;
      return {
        ...tool,
        status: 'available' as ToolStatus,
        holderTechnicianId: undefined,
        loanedAt: undefined,
        updatedAt,
      };
    }),
    movements: data.movements.map((movement) =>
      movement.technicianId && removedIds.has(movement.technicianId)
        ? { ...movement, technicianId: undefined }
        : movement,
    ),
  };
};

/**
 * Limpieza única solicitada para RC58.
 *
 * Elimina el directorio técnico que quedó persistido en navegadores que ya
 * habían abierto versiones anteriores. Después de ejecutarse, los técnicos
 * creados manualmente por el usuario no vuelven a eliminarse.
 */
export default function LegacyTechnicianCleanupRC58() {
  useEffect(() => {
    if (window.localStorage.getItem(MIGRATION_KEY) === 'done') return;

    try {
      const current = loadAppData();
      const next = cleanTechnicians(current);
      if (next !== current) saveAppData(next, { replaceNative: true });
      window.localStorage.setItem(MIGRATION_KEY, 'done');
      window.dispatchEvent(new CustomEvent('isivolt:app-refresh'));
    } catch (error) {
      console.error('No se ha podido limpiar el directorio técnico de RC58.', error);
    }
  }, []);

  return null;
}
