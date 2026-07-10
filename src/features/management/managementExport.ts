import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import * as XLSX from 'xlsx';
import { APP_VERSION } from '../../config/app';
import type { AppData } from '../../domain/types';
import { buildManagementAlerts } from './alerts';

const stamp = () => {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
};

const appendSheet = (
  workbook: XLSX.WorkBook,
  name: string,
  rows: Record<string, unknown>[],
  widths: number[],
) => {
  const safeRows = rows.length > 0 ? rows : [{ Información: 'Sin registros' }];
  const sheet = XLSX.utils.json_to_sheet(safeRows);
  sheet['!cols'] = widths.map((wch) => ({ wch }));
  if (safeRows.length > 1) {
    sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: safeRows.length, c: Object.keys(safeRows[0]).length - 1 } }) };
  }
  XLSX.utils.book_append_sheet(workbook, sheet, name);
};

const download = (name: string, data: ArrayBuffer) => {
  const url = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

const outputWorkbook = async (workbook: XLSX.WorkBook, filename: string, title: string) => {
  if (Capacitor.isNativePlatform()) {
    const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64', compression: true });
    const file = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache, recursive: true });
    await Share.share({ title, text: `${title} · ISIVOLT v${APP_VERSION}`, files: [file.uri], dialogTitle: title });
  } else {
    const array = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer;
    download(filename, array);
  }
  return filename;
};

export const exportManagementWorkbook = async (data: AppData) => {
  const workbook = XLSX.utils.book_new();
  workbook.Props = { Title: 'ISIVOLT - Gestión avanzada de herramientas', Author: 'ISIVOLT', CreatedDate: new Date() };

  appendSheet(workbook, 'Gestión de activos', data.tools.map((tool) => ({
    Código: tool.code,
    Herramienta: tool.name,
    Categoría: tool.category,
    Marca: tool.brand ?? '',
    Modelo: tool.model ?? '',
    Serie: tool.serialNumber ?? '',
    Ubicación: tool.location,
    Estado: tool.status,
    'Situación especial': tool.serviceStatus ?? 'none',
    'Reservada para': data.technicians.find((item) => item.id === tool.reservedTechnicianId)?.name ?? '',
    'Fecha compra': tool.purchaseDate ?? '',
    'Coste €': tool.purchaseCost ?? '',
    Proveedor: tool.supplier ?? '',
    'Próxima revisión': tool.nextReviewDate ?? '',
    'Próxima calibración': tool.nextCalibrationDate ?? '',
    'Plazo máximo días': tool.maxLoanDays ?? '',
    Fotografía: tool.photoUri || tool.thumbnailUri || tool.imageDataUrl ? 'Sí' : 'No',
    Activa: tool.active === false ? 'No' : 'Sí',
    Observaciones: tool.notes ?? '',
  })), [14, 30, 21, 16, 17, 19, 22, 15, 22, 28, 16, 12, 22, 18, 20, 18, 12, 10, 38]);

  appendSheet(workbook, 'Accesorios', (data.accessories ?? []).map((accessory) => {
    const tool = data.tools.find((item) => item.id === accessory.toolId);
    return {
      Código: tool?.code ?? '',
      Herramienta: tool?.name ?? 'Herramienta eliminada',
      Accesorio: accessory.name,
      Obligatorio: accessory.required ? 'Sí' : 'No',
      Estado: accessory.condition ?? 'not_checked',
      Activo: accessory.active ? 'Sí' : 'No',
      Observaciones: accessory.notes ?? '',
    };
  }), [14, 29, 24, 13, 17, 10, 38]);

  appendSheet(workbook, 'Mantenimiento', (data.maintenanceRecords ?? []).map((record) => {
    const tool = data.tools.find((item) => item.id === record.toolId);
    return {
      Código: tool?.code ?? '',
      Herramienta: tool?.name ?? 'Herramienta eliminada',
      Tipo: record.type,
      Estado: record.status,
      Título: record.title,
      Descripción: record.description,
      Responsable: record.assignedTo ?? '',
      Apertura: record.openedAt,
      Vencimiento: record.dueAt ?? '',
      Finalización: record.completedAt ?? '',
      'Coste €': record.cost ?? '',
      Repuestos: record.parts ?? '',
      Resolución: record.resolution ?? '',
      Observaciones: record.notes ?? '',
    };
  }), [14, 29, 16, 17, 28, 42, 24, 20, 18, 20, 12, 30, 42, 38]);

  appendSheet(workbook, 'Alertas', buildManagementAlerts(data).map((alert) => ({
    Prioridad: alert.severity,
    Tipo: alert.type,
    Código: data.tools.find((item) => item.id === alert.toolId)?.code ?? '',
    Título: alert.title,
    Detalle: alert.detail,
    Vencimiento: alert.dueAt ?? '',
  })), [13, 16, 14, 36, 55, 20]);

  return outputWorkbook(workbook, `ISIVOLT_Gestion_v${APP_VERSION}_${stamp()}.xlsx`, 'Informe de gestión ISIVOLT');
};

export const exportImportTemplate = async () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Código', 'Herramienta', 'Categoría', 'Marca', 'Modelo', 'Número de serie', 'Ubicación', 'Estado', 'Fecha de compra', 'Coste', 'Proveedor', 'Próxima revisión', 'Próxima calibración', 'Días máximos', 'Observaciones'],
    ['HER-001', 'Multímetro digital', 'Medición eléctrica', 'Fluke', '289', 'SN-0001', 'Almacén principal', 'Disponible', '2026-01-15', 650, 'Proveedor ejemplo', '2027-01-15', '2027-01-15', 3, 'Fila de ejemplo: puede eliminarse'],
  ]);
  sheet['!cols'] = [14, 30, 22, 16, 16, 20, 23, 16, 17, 12, 23, 19, 21, 15, 40].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, sheet, 'Inventario');
  return outputWorkbook(workbook, 'Plantilla_ISIVOLT_Inventario.xlsx', 'Plantilla de importación ISIVOLT');
};
