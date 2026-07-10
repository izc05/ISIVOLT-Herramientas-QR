import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import * as XLSX from 'xlsx';
import type { AppData, Movement, ToolStatus } from '../domain/types';
import { saveAppData } from './storage';

const APP_VERSION = '0.4.0';
const BACKUP_FORMAT = 'ISIVOLT-HERRAMIENTAS-BACKUP';

const statusLabels: Record<ToolStatus, string> = {
  available: 'Disponible',
  loaned: 'Prestada',
  review: 'En revisión',
  damaged: 'Averiada',
  retired: 'Baja',
};

const movementLabels: Record<Movement['type'], string> = {
  delivery: 'Entrega',
  return: 'Devolución',
  incident: 'Incidencia',
  adjustment: 'Ajuste',
};

const conditionLabels = {
  ok: 'Correcta',
  review: 'Pendiente de revisión',
  damaged: 'Averiada',
} as const;

export type BackupEnvelope = {
  format: typeof BACKUP_FORMAT;
  backupVersion: 1;
  appVersion: string;
  createdAt: string;
  data: AppData;
};

const formatDateTime = (value?: string) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

const formatDateForFilename = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
};

const configureSheet = (
  worksheet: XLSX.WorkSheet,
  widths: number[],
  rowCount: number,
  columnCount: number,
) => {
  worksheet['!cols'] = widths.map((wch) => ({ wch }));
  if (rowCount > 1 && columnCount > 0) {
    worksheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowCount - 1, c: columnCount - 1 } }),
    };
  }
};

const appendJsonSheet = (
  workbook: XLSX.WorkBook,
  name: string,
  rows: Record<string, unknown>[],
  widths: number[],
) => {
  const safeRows = rows.length > 0 ? rows : [{ Información: 'Sin registros para este apartado' }];
  const worksheet = XLSX.utils.json_to_sheet(safeRows);
  const columnCount = Object.keys(safeRows[0]).length;
  configureSheet(worksheet, widths, safeRows.length + 1, columnCount);
  XLSX.utils.book_append_sheet(workbook, worksheet, name);
};

export const buildOperationalWorkbook = (data: AppData): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: 'ISIVOLT Herramientas QR - Informe operativo',
    Subject: 'Inventario, préstamos y trazabilidad de herramientas',
    Author: 'ISIVOLT',
    Company: 'Mantenimiento hospitalario',
    CreatedDate: new Date(),
  };

  const available = data.tools.filter((tool) => tool.status === 'available').length;
  const loaned = data.tools.filter((tool) => tool.status === 'loaned').length;
  const attention = data.tools.filter((tool) => tool.status === 'review' || tool.status === 'damaged').length;
  const incidents = data.movements.filter((movement) => movement.type === 'incident').length;

  appendJsonSheet(
    workbook,
    'Resumen',
    [
      { Indicador: 'Fecha de generación', Valor: formatDateTime(new Date().toISOString()) },
      { Indicador: 'Versión de la aplicación', Valor: APP_VERSION },
      { Indicador: 'Herramientas registradas', Valor: data.tools.length },
      { Indicador: 'Disponibles', Valor: available },
      { Indicador: 'Prestadas', Valor: loaned },
      { Indicador: 'Revisión o avería', Valor: attention },
      { Indicador: 'Técnicos activos', Valor: data.technicians.filter((technician) => technician.active).length },
      { Indicador: 'Movimientos registrados', Valor: data.movements.length },
      { Indicador: 'Incidencias históricas', Valor: incidents },
    ],
    [32, 28],
  );

  const movements = [...data.movements]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map((movement) => {
      const tool = data.tools.find((item) => item.id === movement.toolId);
      const technician = data.technicians.find((item) => item.id === movement.technicianId);
      return {
        Fecha: formatDateTime(movement.occurredAt),
        Tipo: movementLabels[movement.type],
        Código: tool?.code ?? '',
        Herramienta: tool?.name ?? 'Herramienta eliminada',
        Técnico: technician?.name ?? 'Almacén',
        Especialidad: technician?.specialty ?? '',
        'Estado anterior': statusLabels[movement.previousStatus],
        'Estado posterior': statusLabels[movement.nextStatus],
        Condición: movement.condition ? conditionLabels[movement.condition] : '',
        Operador: movement.operatorName,
        Observaciones: movement.notes ?? '',
      };
    });
  appendJsonSheet(workbook, 'Movimientos', movements, [18, 15, 14, 30, 29, 20, 18, 18, 22, 16, 40]);

  const loanedTools = data.tools
    .filter((tool) => tool.status === 'loaned')
    .map((tool) => {
      const technician = data.technicians.find((item) => item.id === tool.holderTechnicianId);
      const loanedAt = tool.loanedAt ? new Date(tool.loanedAt) : null;
      const daysOut = loanedAt ? Math.max(0, Math.floor((Date.now() - loanedAt.getTime()) / 86_400_000)) : '';
      return {
        Código: tool.code,
        Herramienta: tool.name,
        Categoría: tool.category,
        Marca: tool.brand ?? '',
        Modelo: tool.model ?? '',
        Técnico: technician?.name ?? 'Sin responsable',
        Especialidad: technician?.specialty ?? '',
        'Fecha de entrega': formatDateTime(tool.loanedAt),
        'Días fuera': daysOut,
        Ubicación: tool.location,
        Observaciones: tool.notes ?? '',
      };
    });
  appendJsonSheet(workbook, 'Prestadas', loanedTools, [14, 30, 22, 17, 18, 30, 20, 18, 12, 22, 38]);

  const inventory = [...data.tools]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((tool) => {
      const technician = data.technicians.find((item) => item.id === tool.holderTechnicianId);
      return {
        Código: tool.code,
        QR: tool.qrCode,
        Herramienta: tool.name,
        Categoría: tool.category,
        Marca: tool.brand ?? '',
        Modelo: tool.model ?? '',
        'Número de serie': tool.serialNumber ?? '',
        Estado: statusLabels[tool.status],
        Responsable: technician?.name ?? '',
        Ubicación: tool.location,
        'Última actualización': formatDateTime(tool.updatedAt),
        Observaciones: tool.notes ?? '',
      };
    });
  appendJsonSheet(workbook, 'Inventario', inventory, [14, 28, 30, 22, 17, 18, 20, 18, 29, 23, 20, 38]);

  const technicians = [...data.technicians]
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map((technician) => {
      const assigned = data.tools.filter(
        (tool) => tool.status === 'loaned' && tool.holderTechnicianId === technician.id,
      );
      return {
        Código: technician.code,
        Nombre: technician.name,
        Especialidad: technician.specialty,
        Cargo: technician.role ?? '',
        Teléfono: technician.phone ?? '',
        Extensión: technician.extension ?? '',
        Correo: technician.email ?? '',
        Estado: technician.active ? 'Activo' : 'Inactivo',
        'Herramientas asignadas': assigned.length,
        Material: assigned.map((tool) => `${tool.code} - ${tool.name}`).join(' | '),
      };
    });
  appendJsonSheet(workbook, 'Técnicos', technicians, [14, 31, 21, 25, 18, 13, 32, 12, 21, 55]);

  const incidentRows = data.movements
    .filter((movement) => movement.type === 'incident')
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map((movement) => {
      const tool = data.tools.find((item) => item.id === movement.toolId);
      const technician = data.technicians.find((item) => item.id === movement.technicianId);
      return {
        Fecha: formatDateTime(movement.occurredAt),
        Código: tool?.code ?? '',
        Herramienta: tool?.name ?? 'Herramienta eliminada',
        Técnico: technician?.name ?? '',
        Resultado: statusLabels[movement.nextStatus],
        Condición: movement.condition ? conditionLabels[movement.condition] : '',
        Operador: movement.operatorName,
        Observaciones: movement.notes ?? '',
      };
    });
  appendJsonSheet(workbook, 'Incidencias', incidentRows, [18, 14, 30, 29, 18, 22, 16, 45]);

  return workbook;
};

const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const writeAndShareNativeFile = async (
  filename: string,
  data: string,
  options: { encoding?: Encoding; title: string; text: string },
) => {
  const result = await Filesystem.writeFile({
    path: filename,
    data,
    directory: Directory.Cache,
    encoding: options.encoding,
    recursive: true,
  });

  await Share.share({
    title: options.title,
    text: options.text,
    files: [result.uri],
    dialogTitle: options.title,
  });
};

export const exportOperationalExcel = async (data: AppData): Promise<string> => {
  const filename = `ISIVOLT_Herramientas_${formatDateForFilename()}.xlsx`;
  const workbook = buildOperationalWorkbook(data);

  if (Capacitor.isNativePlatform()) {
    const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64', compression: true });
    await writeAndShareNativeFile(filename, base64, {
      title: 'Informe ISIVOLT Herramientas QR',
      text: 'Informe Excel con inventario, préstamos, técnicos, incidencias y trazabilidad.',
    });
  } else {
    const array = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true });
    downloadBlob(
      filename,
      new Blob([array], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
  }

  return filename;
};

export const createBackupEnvelope = (data: AppData): BackupEnvelope => ({
  format: BACKUP_FORMAT,
  backupVersion: 1,
  appVersion: APP_VERSION,
  createdAt: new Date().toISOString(),
  data,
});

export const exportBackup = async (data: AppData): Promise<string> => {
  const filename = `ISIVOLT_Backup_${formatDateForFilename()}.json`;
  const content = JSON.stringify(createBackupEnvelope(data), null, 2);

  if (Capacitor.isNativePlatform()) {
    await writeAndShareNativeFile(filename, content, {
      encoding: Encoding.UTF8,
      title: 'Copia de seguridad ISIVOLT',
      text: 'Copia completa y restaurable del inventario y sus movimientos.',
    });
  } else {
    downloadBlob(filename, new Blob([content], { type: 'application/json;charset=utf-8' }));
  }

  return filename;
};

const isValidAppData = (value: unknown): value is AppData => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppData>;
  return (
    candidate.schemaVersion === 1 &&
    Array.isArray(candidate.tools) &&
    Array.isArray(candidate.technicians) &&
    Array.isArray(candidate.movements)
  );
};

export const parseBackup = (text: string): BackupEnvelope => {
  const parsed = JSON.parse(text) as Partial<BackupEnvelope>;
  if (
    parsed.format !== BACKUP_FORMAT ||
    parsed.backupVersion !== 1 ||
    !parsed.createdAt ||
    !isValidAppData(parsed.data)
  ) {
    throw new Error('El archivo no es una copia válida de ISIVOLT Herramientas QR.');
  }
  return parsed as BackupEnvelope;
};

export const restoreBackup = (text: string): BackupEnvelope => {
  const backup = parseBackup(text);
  saveAppData(backup.data);
  return backup;
};
