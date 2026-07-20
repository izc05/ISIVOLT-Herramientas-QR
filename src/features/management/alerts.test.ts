import { describe, expect, it } from 'vitest';
import type { AppData } from '../../domain/types';
import { buildManagementAlerts } from './alerts';

const data = (): AppData => ({
  schemaVersion: 1,
  technicians: [{
    id: 'tech-1',
    code: 'TEC-001',
    name: 'Técnico Uno',
    specialty: 'Electricidad',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }],
  tools: [{
    id: 'tool-1',
    code: 'HER-001',
    qrCode: 'ISIVOLT:TOOL:HER-001',
    name: 'Multímetro',
    category: 'Medición',
    location: 'Almacén',
    status: 'loaned',
    holderTechnicianId: 'tech-1',
    loanedAt: '2026-07-01T08:00:00.000Z',
    maxLoanDays: 3,
    nextReviewDate: '2026-07-08',
    nextCalibrationDate: '2026-07-20',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-07-01T08:00:00.000Z',
  }],
  movements: [],
  accessories: [{
    id: 'acc-1',
    toolId: 'tool-1',
    name: 'Puntas de prueba',
    required: true,
    active: true,
    condition: 'missing',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-07-10T08:00:00.000Z',
  }],
  maintenanceRecords: [{
    id: 'maint-1',
    toolId: 'tool-1',
    type: 'inspection',
    status: 'open',
    title: 'Inspección pendiente',
    description: 'Comprobar aislamiento',
    operatorName: 'Almacén',
    openedAt: '2026-07-01T08:00:00.000Z',
    dueAt: '2026-07-09',
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-07-01T08:00:00.000Z',
  }],
});

describe('buildManagementAlerts', () => {
  it('detecta retraso, revisión vencida y actuación vencida', () => {
    const alerts = buildManagementAlerts(data(), new Date('2026-07-10T12:00:00.000Z'));
    expect(alerts.some((alert) => alert.type === 'overdue' && alert.severity === 'critical')).toBe(true);
    expect(alerts.some((alert) => alert.type === 'review' && alert.severity === 'critical')).toBe(true);
    expect(alerts.some((alert) => alert.id === 'maintenance-record-maint-1')).toBe(true);
  });

  it('avisa de calibración próxima y fotografía ausente', () => {
    const alerts = buildManagementAlerts(data(), new Date('2026-07-10T12:00:00.000Z'));
    expect(alerts.some((alert) => alert.type === 'calibration')).toBe(true);
    expect(alerts.some((alert) => alert.type === 'photo')).toBe(true);
  });

  it('avisa de accesorios obligatorios ausentes', () => {
    const alerts = buildManagementAlerts(data(), new Date('2026-07-10T12:00:00.000Z'));
    expect(alerts.some((alert) => alert.type === 'accessory' && alert.severity === 'critical')).toBe(true);
    expect(alerts.some((alert) => alert.detail.includes('Puntas de prueba'))).toBe(true);
  });

  it('ordena primero las alertas críticas', () => {
    const alerts = buildManagementAlerts(data(), new Date('2026-07-10T12:00:00.000Z'));
    const firstInfo = alerts.findIndex((alert) => alert.severity === 'info');
    const lastCritical = alerts.map((alert) => alert.severity).lastIndexOf('critical');
    expect(firstInfo).toBeGreaterThan(lastCritical);
  });

  it('prioriza la fecha prevista específica sobre el límite genérico', () => {
    const source = data();
    source.movements.push({
      id: 'mov-delivery',
      type: 'delivery',
      toolId: 'tool-1',
      technicianId: 'tech-1',
      operatorName: 'Almacén',
      occurredAt: '2026-07-10T08:00:00.000Z',
      expectedReturnAt: '2026-07-10T10:00:00.000Z',
      previousStatus: 'available',
      nextStatus: 'loaned',
    });

    const alerts = buildManagementAlerts(source, new Date('2026-07-10T12:00:00.000Z'));
    const overdue = alerts.find((alert) => alert.id === 'overdue-tool-1');
    expect(overdue?.title).toContain('devolución vencida');
    expect(overdue?.detail).toContain('horas de retraso');
    expect(overdue?.dueAt).toBe('2026-07-10T10:00:00.000Z');
  });

  it('avisa cuando la devolución prevista está próxima', () => {
    const source = data();
    source.movements.push({
      id: 'mov-delivery',
      type: 'delivery',
      toolId: 'tool-1',
      technicianId: 'tech-1',
      operatorName: 'Almacén',
      occurredAt: '2026-07-10T08:00:00.000Z',
      expectedReturnAt: '2026-07-10T18:00:00.000Z',
      previousStatus: 'available',
      nextStatus: 'loaned',
    });

    const alerts = buildManagementAlerts(source, new Date('2026-07-10T12:00:00.000Z'));
    expect(alerts.some((alert) => alert.id === 'overdue-soon-tool-1' && alert.severity === 'warning')).toBe(true);
  });
});
