import { describe, expect, it } from 'vitest';
import type { AppData } from '../domain/types';
import { enforceAppDataIntegrity } from './dataIntegrity';

const makeData = (): AppData => ({
  schemaVersion: 1,
  technicians: [
    {
      id: 'tech-1',
      code: 'TEC-001',
      name: 'Técnico',
      specialty: 'Electricidad',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  tools: [
    {
      id: 'tool-old',
      code: 'HER-001',
      qrCode: 'ISIVOLT:TOOL:HER-001',
      name: 'Herramienta original',
      category: 'General',
      location: 'Almacén',
      status: 'available',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  movements: [],
});

describe('enforceAppDataIntegrity', () => {
  it('rechaza la herramienta nueva si repite un código ya existente', () => {
    const data = makeData();
    data.tools = [
      {
        ...data.tools[0],
        id: 'tool-new',
        name: 'Duplicada nueva',
      },
      ...data.tools,
    ];

    const result = enforceAppDataIntegrity(data);
    expect(result.data.tools).toHaveLength(1);
    expect(result.data.tools[0].id).toBe('tool-old');
    expect(result.issues.some((issue) => issue.code === 'duplicate-tool-code')).toBe(true);
  });

  it('devuelve a disponible un préstamo sin responsable válido', () => {
    const data = makeData();
    data.tools[0] = {
      ...data.tools[0],
      status: 'loaned',
      holderTechnicianId: 'missing-tech',
      loanedAt: '2026-07-10T08:00:00.000Z',
    };

    const result = enforceAppDataIntegrity(data);
    expect(result.data.tools[0].status).toBe('available');
    expect(result.data.tools[0].holderTechnicianId).toBeUndefined();
    expect(result.issues.some((issue) => issue.code === 'invalid-holder')).toBe(true);
  });

  it('elimina datos de préstamo en herramientas no prestadas', () => {
    const data = makeData();
    data.tools[0] = {
      ...data.tools[0],
      holderTechnicianId: 'tech-1',
      loanedAt: '2026-07-10T08:00:00.000Z',
    };

    const result = enforceAppDataIntegrity(data);
    expect(result.data.tools[0].holderTechnicianId).toBeUndefined();
    expect(result.data.tools[0].loanedAt).toBeUndefined();
  });
});
