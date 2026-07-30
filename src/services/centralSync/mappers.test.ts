import { describe, expect, it } from 'vitest';
import { remoteTechnicianToDomain, remoteToolToDomain } from './mappers';

describe('central sync mappers', () => {
  it('reconstruye una herramienta desde el payload camelCase emitido por PocketBase', () => {
    const tool = remoteToolToDomain({
      id: 'tool-1',
      code: 'ELE-001',
      qrCode: 'ISIVOLT:TOOL:ELE-001',
      nfcUid: '04A1B2C3D4E5F6',
      nfcUpdatedAt: '2026-07-30T11:45:00.000Z',
      nfcUpdatedBy: 'Isi',
      nfcTechTypes: ['android.nfc.tech.NfcA'],
      name: 'Multímetro',
      category: 'Medición',
      location: 'Almacén',
      status: 'available',
      active: true,
      createdAt: '2026-07-30T11:00:00.000Z',
      updatedAt: '2026-07-30T11:45:00.000Z',
    });

    expect(tool).toMatchObject({
      id: 'tool-1',
      qrCode: 'ISIVOLT:TOOL:ELE-001',
      nfcUid: '04A1B2C3D4E5F6',
      nfcUpdatedBy: 'Isi',
      nfcTechTypes: ['android.nfc.tech.NfcA'],
      name: 'Multímetro',
      location: 'Almacén',
      status: 'available',
    });
  });

  it('mantiene compatibilidad con filas legacy en snake_case', () => {
    const technician = remoteTechnicianToDomain({
      id: 'tech-1',
      code: 'TEC-001',
      nfc_uid: '04112233445566',
      nfc_updated_at: '2026-07-30T11:46:00.000Z',
      nfc_updated_by: 'Administrador',
      nfc_tech_types: ['manual'],
      barcode_value: '123456',
      name: 'Técnico prueba',
      specialty: 'Electricidad',
      job_role: 'Técnico electricista',
      active: true,
      created_at: '2026-07-30T10:00:00.000Z',
      updated_at: '2026-07-30T11:46:00.000Z',
    });

    expect(technician).toMatchObject({
      id: 'tech-1',
      nfcUid: '04112233445566',
      nfcUpdatedBy: 'Administrador',
      barcodeValue: '123456',
      role: 'Técnico electricista',
    });
  });
});