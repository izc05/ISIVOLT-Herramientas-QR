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
  it('normaliza espacios y mayúsculas', () => {
    expect(normalizeBarcodeValue(' 52 502 ')).toBe('52502');
    expect(normalizeBarcodeValue('ab-123')).toBe('AB-123');
  });

  it('resuelve el CODE 39 de la tarjeta al técnico vinculado', () => {
    const registry = { '52502': 'tech-1' };
    expect(resolveTechnicianBarcode(registry, data, ' 52502 ')?.code).toBe('TEC-001');
    expect(barcodeForTechnician(registry, 'tech-1')).toBe('52502');
  });

  it('no confunde un código sin registrar', () => {
    expect(resolveTechnicianBarcode({ '52502': 'tech-1' }, data, '42101403197')).toBeUndefined();
  });
});
