import { describe, expect, it } from 'vitest';
import type { Movement, Technician, Tool } from '../../domain/types';
import {
  movementAccessoryCheckToSqlValues,
  movementToSqlValues,
  rowToMovement,
  rowToMovementAccessoryCheck,
  rowToTechnician,
  rowToTool,
  stableLookupId,
  technicianToSqlValues,
  toolToSqlValues,
} from './mappers';

const tool: Tool = {
  id: 'tool-1',
  code: 'HER-001',
  qrCode: 'ISIVOLT:TOOL:HER-001',
  nfcUid: '04A1B2C3D4E5',
  name: 'Multímetro',
  category: 'Medición eléctrica',
  brand: 'Fluke',
  location: 'Almacén principal',
  status: 'loaned',
  holderTechnicianId: 'tech-1',
  loanedAt: '2026-07-10T08:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-07-10T08:00:00.000Z',
};

const technician: Technician = {
  id: 'tech-1',
  code: 'TEC-001',
  nfcUid: 'AABBCCDDEE01',
  barcodeValue: '52502',
  name: 'Técnico Uno',
  specialty: 'Electricidad',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const movement: Movement = {
  id: 'mov-1',
  operationId: 'op-1',
  type: 'delivery',
  toolId: tool.id,
  technicianId: technician.id,
  operatorName: 'Almacén',
  occurredAt: '2026-07-10T08:00:00.000Z',
  previousStatus: 'available',
  nextStatus: 'loaned',
  expectedReturnAt: '2026-07-12T14:00:00.000Z',
  workOrder: 'OT 104582',
  workLocation: 'Quirófano 2',
};

describe('SQLite mappers', () => {
  it('genera IDs estables para categorías y ubicaciones', () => {
    expect(stableLookupId('cat', 'Medición eléctrica')).toBe(stableLookupId('cat', '  medición ELÉCTRICA '));
    expect(stableLookupId('cat', 'Medición eléctrica')).not.toBe(stableLookupId('loc', 'Medición eléctrica'));
  });

  it('convierte herramientas a valores SQL con relaciones estables y NFC', () => {
    const values = toolToSqlValues(tool);
    expect(values[0]).toBe(tool.id);
    expect(values[4]).toBe(stableLookupId('cat', tool.category));
    expect(values[8]).toBe(stableLookupId('loc', tool.location));
    expect(values[9]).toBe('loaned');
    expect(values[10]).toBe('tech-1');
    expect(values[28]).toBe(tool.nfcUid);
  });

  it('recupera una herramienta desde una fila SQL', () => {
    const recovered = rowToTool({
      id: tool.id,
      code: tool.code,
      qr_code: tool.qrCode,
      nfc_uid: tool.nfcUid,
      name: tool.name,
      category_name: tool.category,
      brand: tool.brand,
      location_name: tool.location,
      status: tool.status,
      holder_technician_id: tool.holderTechnicianId,
      loaned_at: tool.loanedAt,
      created_at: tool.createdAt,
      updated_at: tool.updatedAt,
    });
    expect(recovered).toMatchObject(tool);
  });

  it('convierte y recupera técnicos con NFC y código de barras', () => {
    const values = technicianToSqlValues(technician);
    expect(values[0]).toBe('tech-1');
    expect(values[9]).toBe(technician.nfcUid);
    expect(values[10]).toBe(1);
    expect(values[13]).toBe('52502');

    const recovered = rowToTechnician({
      id: technician.id,
      code: technician.code,
      nfc_uid: technician.nfcUid,
      barcode_value: technician.barcodeValue,
      name: technician.name,
      specialty: technician.specialty,
      active: 1,
      created_at: technician.createdAt,
      updated_at: technician.updatedAt,
    });
    expect(recovered).toEqual(technician);
  });

  it('conserva operationId y contexto al escribir y leer un movimiento', () => {
    const values = movementToSqlValues(movement, 12, 'device-1');
    expect(values[0]).toBe(movement.id);
    expect(values[1]).toBe(movement.operationId);
    expect(values[2]).toBe(12);
    expect(values[11]).toBe(movement.expectedReturnAt);
    expect(values[12]).toBe(movement.workOrder);
    expect(values[13]).toBe(movement.workLocation);

    const recovered = rowToMovement({
      id: movement.id,
      operation_id: movement.operationId,
      sequence_number: 12,
      type: movement.type,
      tool_id: movement.toolId,
      technician_id: movement.technicianId,
      operator_name: movement.operatorName,
      occurred_at: movement.occurredAt,
      previous_status: movement.previousStatus,
      next_status: movement.nextStatus,
      expected_return_at: movement.expectedReturnAt,
      work_order: movement.workOrder,
      work_location: movement.workLocation,
      device_id: 'device-1',
      sync_status: 'local',
    });

    expect(recovered).toMatchObject({
      operationId: 'op-1',
      sequenceNumber: 12,
      expectedReturnAt: movement.expectedReturnAt,
      workOrder: 'OT 104582',
      workLocation: 'Quirófano 2',
    });
  });

  it('convierte y recupera la comprobación de un accesorio', () => {
    const check = { accessoryId: 'acc-1', condition: 'missing' as const, notes: 'No entregado' };
    expect(movementAccessoryCheckToSqlValues('mov-1', check)).toEqual([
      'mov-1',
      'acc-1',
      0,
      'missing',
      'No entregado',
    ]);
    expect(rowToMovementAccessoryCheck({
      accessory_id: 'acc-1',
      condition: 'missing',
      notes: 'No entregado',
    })).toEqual(check);
  });
});
