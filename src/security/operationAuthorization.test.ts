import { describe, expect, it } from 'vitest';
import type { AppData, Movement, Technician, Tool } from '../domain/types';
import {
  assertAuthorizedDataChange,
  OperationAuthorizationError,
  resolveLinkedTechnician,
} from './operationAuthorization';
import type { SecurityUser } from './types';

const technician: Technician = {
  id: 'tech-1',
  code: 'TEC-001',
  name: 'Técnico Uno',
  specialty: 'Electricidad',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const otherTechnician: Technician = {
  ...technician,
  id: 'tech-2',
  code: 'TEC-002',
  name: 'Técnico Dos',
};

const tool: Tool = {
  id: 'tool-1',
  code: 'HER-001',
  qrCode: 'ISIVOLT:TOOL:HER-001',
  name: 'Multímetro',
  category: 'Medición',
  location: 'Almacén',
  status: 'available',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const baseData = (): AppData => ({
  schemaVersion: 1,
  tools: [tool],
  technicians: [technician, otherTechnician],
  movements: [],
  accessories: [],
  maintenanceRecords: [],
});

const user = (role: SecurityUser['role'], technicianId?: string): SecurityUser => ({
  id: `user-${role}`,
  name: role,
  role,
  technicianId,
  pinHash: 'hash',
  active: true,
  failedAttempts: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const movement = (technicianId: string): Movement => ({
  id: `mov-${technicianId}`,
  type: 'delivery',
  toolId: tool.id,
  technicianId,
  operatorName: 'Operador',
  occurredAt: '2026-07-23T10:00:00.000Z',
  previousStatus: 'available',
  nextStatus: 'loaned',
});

describe('autorización de movimientos por perfil', () => {
  it('resuelve la ficha activa vinculada al técnico', () => {
    expect(resolveLinkedTechnician(baseData(), user('technician', technician.id))?.id).toBe(technician.id);
  });

  it('rechaza un usuario técnico sin ficha vinculada', () => {
    expect(() => resolveLinkedTechnician(baseData(), user('technician')))
      .toThrowError(OperationAuthorizationError);
  });

  it('permite al técnico registrar un movimiento propio', () => {
    const previous = baseData();
    const next = { ...previous, movements: [movement(technician.id)] };
    expect(() => assertAuthorizedDataChange(previous, next, user('technician', technician.id))).not.toThrow();
  });

  it('impide al técnico registrar movimientos a nombre de otro', () => {
    const previous = baseData();
    const next = { ...previous, movements: [movement(otherTechnician.id)] };
    expect(() => assertAuthorizedDataChange(previous, next, user('technician', technician.id)))
      .toThrow('Un técnico solo puede registrar movimientos a su propio nombre');
  });

  it('mantiene al coordinador en modo consulta', () => {
    const previous = baseData();
    const next = { ...previous, movements: [movement(technician.id)] };
    expect(() => assertAuthorizedDataChange(previous, next, user('coordinator')))
      .toThrow('Tu perfil es de consulta');
  });

  it('permite a almacén operar para cualquier técnico', () => {
    const previous = baseData();
    const next = { ...previous, movements: [movement(otherTechnician.id)] };
    expect(() => assertAuthorizedDataChange(previous, next, user('warehouse'))).not.toThrow();
  });
});
