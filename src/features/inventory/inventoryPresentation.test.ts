import { describe, expect, it } from 'vitest';
import type { AppData, Tool } from '../../domain/types';
import {
  applyDemoToolImages,
  canUnlockTool,
  resolveToolCategory,
  unlockToolData,
} from './inventoryPresentation';

const tool = (overrides: Partial<Tool> = {}): Tool => ({
  id: 'tool-1',
  code: 'ELE-001',
  qrCode: 'ISIVOLT:TOOL:ELE-001',
  name: 'Multímetro de prueba',
  category: 'Medida eléctrica',
  location: 'Almacén',
  status: 'available',
  createdAt: '2026-07-23T08:00:00.000Z',
  updatedAt: '2026-07-23T08:00:00.000Z',
  ...overrides,
});

const data = (tools: Tool[]): AppData => ({
  schemaVersion: 1,
  tools,
  technicians: [],
  movements: [],
  accessories: [],
  maintenanceRecords: [],
});

describe('presentación compacta del inventario', () => {
  it('clasifica categorías habituales con una clave visual estable', () => {
    expect(resolveToolCategory('Medida eléctrica').key).toBe('measurement');
    expect(resolveToolCategory('Herramienta eléctrica').key).toBe('electrical');
    expect(resolveToolCategory('Termografía').key).toBe('thermal');
    expect(resolveToolCategory('Seguridad eléctrica').key).toBe('safety');
  });

  it('añade una foto de demostración solo cuando no existe una foto real', () => {
    const result = applyDemoToolImages(data([
      tool(),
      tool({ id: 'tool-2', code: 'HER-014', imageDataUrl: 'data:image/png;base64,real' }),
    ]));

    expect(result.changed).toBe(true);
    expect(result.data.tools[0].imageDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(result.data.tools[1].imageDataUrl).toBe('data:image/png;base64,real');
  });

  it('registra el desbloqueo como ajuste y devuelve la herramienta a disponible', () => {
    const original = data([tool({ status: 'review', serviceStatus: 'repair' })]);
    const result = unlockToolData(original, 'tool-1', 'Responsable almacén', '2026-07-23T09:00:00.000Z');

    expect(result.changed).toBe(true);
    expect(result.data.tools[0]).toMatchObject({
      status: 'available',
      serviceStatus: 'none',
      updatedAt: '2026-07-23T09:00:00.000Z',
    });
    expect(result.data.movements[0]).toMatchObject({
      type: 'adjustment',
      toolId: 'tool-1',
      previousStatus: 'review',
      nextStatus: 'available',
      operatorName: 'Responsable almacén',
      syncStatus: 'pending',
    });
  });

  it('no desbloquea herramientas prestadas, disponibles o dadas de baja', () => {
    expect(canUnlockTool('review')).toBe(true);
    expect(canUnlockTool('damaged')).toBe(true);
    expect(canUnlockTool('loaned')).toBe(false);
    expect(canUnlockTool('available')).toBe(false);
    expect(canUnlockTool('retired')).toBe(false);
  });
});
