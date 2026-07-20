import { describe, expect, it } from 'vitest';
import type { AppData } from '../domain/types';
import {
  barcodeForTechnician,
  normalizeBarcodeValue,
  resolveTechnicianBarcode,
} from './barcodeRegistry';

const data: AppData = {
  schemaVersion: 1,
  tools: [],
  movements: [],
  technicians: [
    {
      id: 'tech-1',
      code: 'TEC-001',
      name: 'Isicio Zafra Cantos',
      specialty: 'Electricidad',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

describe('registro de códigos de barras', () => {
  it('normaliza espacios, guiones y mayúsculas', () => {
    expect(normalizeBarcodeValue(' 52 502 ')).toBe('52502');
    expect(normalizeBarcodeValue('ab-123')).toBe('AB123');
    expect(normalizeBarcodeValue('52502 42101403197-1')).toBe('52502421014031971');
  });

  it('resuelve la tarjeta aunque cambie el formato visual del número', () => {
    const registry = { '421014031971': 'tech-1' };
    expect(resolveTechnicianBarcode(registry, data, '42101403197-1')?.code).toBe('TEC-001');
    expect(resolveTechnicianBarcode(registry, data, '42101 403197-1')?.code).toBe('TEC-001');
    expect(barcodeForTechnician(registry, 'tech-1')).toBe('421014031971');
  });

  it('no confunde un código sin registrar', () => {
    expect(resolveTechnicianBarcode({ '52502': 'tech-1' }, data, '42101403197-1')).toBeUndefined();
  });
});
