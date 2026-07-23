import { describe, expect, it } from 'vitest';
import type { AppData, Tool } from '../../domain/types';
import {
  buildToolCategories,
  buildToolMovementTimes,
  filterInventoryTools,
  getDeliveryAlert,
} from './inventoryOperations';

const tool = (overrides: Partial<Tool> = {}): Tool => ({
  id: 'tool-1',
  code: 'ELE-001',
  qrCode: 'ISIVOLT:TOOL:ELE-001',
  name: 'Multímetro',
  category: 'Electricidad',
  location: 'Almacén',
  status: 'available',
  serviceStatus: 'none',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const data: AppData = {
  schemaVersion: 1,
  tools: [
    tool(),
    tool({ id: 'tool-2', code: 'FON-001', qrCode: 'ISIVOLT:TOOL:FON-001', name: 'Llave', category: 'Fontanería', status: 'loaned' }),
    tool({ id: 'tool-3', code: 'ELE-002', qrCode: 'ISIVOLT:TOOL:ELE-002', name: 'Pinza', status: 'damaged', notes: 'Pantalla rota' }),
  ],
  technicians: [],
  movements: [
    { id: 'm1', type: 'delivery', toolId: 'tool-1', operatorName: 'Almacén', occurredAt: '2026-07-10T08:00:00.000Z', previousStatus: 'available', nextStatus: 'loaned' },
    { id: 'm2', type: 'return', toolId: 'tool-1', operatorName: 'Almacén', occurredAt: '2026-07-10T12:00:00.000Z', previousStatus: 'loaned', nextStatus: 'available' },
  ],
};

describe('inventario operativo', () => {
  it('conserva categorías únicas y ordenadas', () => {
    expect(buildToolCategories(data.tools)).toEqual(['Todas', 'Electricidad', 'Fontanería']);
  });

  it('filtra por categoría y estado', () => {
    expect(filterInventoryTools(data.tools, '', 'Electricidad', 'available').map((item) => item.id)).toEqual(['tool-1']);
    expect(filterInventoryTools(data.tools, '', 'Todas', 'loaned').map((item) => item.id)).toEqual(['tool-2']);
    expect(filterInventoryTools(data.tools, '', 'Todas', 'attention').map((item) => item.id)).toEqual(['tool-3']);
  });

  it('localiza la última salida y entrada', () => {
    const times = buildToolMovementTimes(data, 'tool-1');
    expect(times.checkout?.id).toBe('m1');
    expect(times.checkin?.id).toBe('m2');
  });

  it('bloquea una herramienta averiada con motivo', () => {
    const alert = getDeliveryAlert(data.tools[2]);
    expect(alert?.blocked).toBe(true);
    expect(alert?.title).toContain('averiada');
    expect(alert?.detail).toContain('Pantalla rota');
  });

  it('aplaza la reserva hasta conocer el técnico y bloquea al responsable incorrecto', () => {
    const reserved = tool({ serviceStatus: 'reserved', reservedTechnicianId: 'tech-2' });
    expect(getDeliveryAlert(reserved)).toBeNull();
    expect(getDeliveryAlert(reserved, 'tech-1')?.title).toBe('Herramienta reservada');
    expect(getDeliveryAlert(reserved, 'tech-2')).toBeNull();
  });
});
