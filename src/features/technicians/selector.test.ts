import { describe, expect, it } from 'vitest';
import type { Technician, Tool } from '../../domain/types';
import {
  buildLoanCountByTechnician,
  buildTechnicianCategories,
  filterSelectableTechnicians,
} from './selector';

const technicians: Technician[] = [
  { id: 't1', code: 'TEC-001', name: 'Ana Ruiz', specialty: 'Electricidad', active: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 't2', code: 'TEC-002', name: 'Carlos Pérez', specialty: 'Fontaneros', active: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 't3', code: 'TEC-003', name: 'Inactivo', specialty: 'Climatización', active: false, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
];

describe('selector manual de técnicos', () => {
  it('muestra únicamente técnicos activos', () => {
    expect(filterSelectableTechnicians(technicians, '', 'Todas').map((item) => item.id)).toEqual(['t1', 't2']);
  });

  it('busca por nombre, código y especialidad sin depender de acentos', () => {
    expect(filterSelectableTechnicians(technicians, 'ana', 'Todas')).toHaveLength(1);
    expect(filterSelectableTechnicians(technicians, 'TEC-002', 'Todas')).toHaveLength(1);
    expect(filterSelectableTechnicians(technicians, 'fontaneros', 'Todas')).toHaveLength(1);
  });

  it('filtra por categoría y conserva especialidades existentes', () => {
    expect(filterSelectableTechnicians(technicians, '', 'Electricidad').map((item) => item.id)).toEqual(['t1']);
    expect(buildTechnicianCategories(technicians)).toContain('Fontaneros');
    expect(buildTechnicianCategories(technicians)).toContain('Mantenimiento');
  });

  it('calcula préstamos una sola vez por técnico', () => {
    const tools = [
      { id: 'h1', holderTechnicianId: 't1', status: 'loaned' },
      { id: 'h2', holderTechnicianId: 't1', status: 'loaned' },
      { id: 'h3', holderTechnicianId: 't2', status: 'available' },
    ] as Tool[];
    expect(buildLoanCountByTechnician(tools).get('t1')).toBe(2);
    expect(buildLoanCountByTechnician(tools).get('t2')).toBeUndefined();
  });
});
