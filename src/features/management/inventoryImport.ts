import * as XLSX from 'xlsx';
import type { AppData, Tool, ToolStatus } from '../../domain/types';

export type InventoryImportResult = {
  data: AppData;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

type SpreadsheetRow = Record<string, unknown>;

const normalizeHeader = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const normalizedRow = (row: SpreadsheetRow) => Object.fromEntries(
  Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]),
);

const getText = (row: SpreadsheetRow, aliases: string[]) => {
  const normalized = normalizedRow(row);
  for (const alias of aliases) {
    const value = normalized[normalizeHeader(alias)];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
};

const getNumber = (row: SpreadsheetRow, aliases: string[]) => {
  const text = getText(row, aliases).replace(',', '.');
  if (!text) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
};

const excelDateToIso = (value: unknown) => {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return undefined;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString().slice(0, 10);
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
};

const getDate = (row: SpreadsheetRow, aliases: string[]) => {
  const normalized = normalizedRow(row);
  for (const alias of aliases) {
    const value = normalized[normalizeHeader(alias)];
    const date = excelDateToIso(value);
    if (date) return date;
  }
  return undefined;
};

const parseStatus = (value: string): ToolStatus => {
  const normalized = normalizeHeader(value);
  if (['prestada', 'prestado', 'loaned'].includes(normalized)) return 'loaned';
  if (['revision', 'en revision', 'review'].includes(normalized)) return 'review';
  if (['averiada', 'averiado', 'damaged'].includes(normalized)) return 'damaged';
  if (['baja', 'retirada', 'retirado', 'retired'].includes(normalized)) return 'retired';
  return 'available';
};

const newId = () => `tool-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

export const importInventoryExcel = async (
  file: File,
  source: AppData,
): Promise<InventoryImportResult> => {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) throw new Error('El archivo Excel no contiene ninguna hoja utilizable.');

  const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(worksheet, { defval: '' });
  const tools = [...source.tools];
  const codeIndex = new Map(tools.map((tool, index) => [tool.code.trim().toUpperCase(), index]));
  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  rows.forEach((row, rowIndex) => {
    const excelRow = rowIndex + 2;
    const code = getText(row, ['Código', 'Codigo', 'Code', 'Código interno', 'Id']).toUpperCase();
    const name = getText(row, ['Herramienta', 'Artículo', 'Articulo', 'Nombre', 'Activo', 'Descripción', 'Descripcion']);

    if (!code || !name) {
      skipped += 1;
      errors.push(`Fila ${excelRow}: faltan Código o Nombre.`);
      return;
    }

    const timestamp = new Date().toISOString();
    const existingIndex = codeIndex.get(code);
    const existing = existingIndex === undefined ? undefined : tools[existingIndex];
    const importedStatus = parseStatus(getText(row, ['Estado', 'Status']));
    const status = existing?.status === 'loaned' ? 'loaned' : importedStatus;
    const patch: Tool = {
      ...(existing ?? {
        id: newId(),
        code,
        qrCode: `ISIVOLT:TOOL:${code}`,
        createdAt: timestamp,
      }),
      code,
      qrCode: `ISIVOLT:TOOL:${code}`,
      name,
      category: getText(row, ['Categoría', 'Categoria', 'Familia', 'Tipo']) || existing?.category || 'Sin categoría',
      brand: getText(row, ['Marca', 'Fabricante']) || existing?.brand,
      model: getText(row, ['Modelo']) || existing?.model,
      serialNumber: getText(row, ['Número de serie', 'Numero de serie', 'Serie', 'Nº serie', 'N serie']) || existing?.serialNumber,
      location: getText(row, ['Ubicación', 'Ubicacion', 'Almacén', 'Almacen', 'Localización', 'Localizacion']) || existing?.location || 'Almacén principal',
      status,
      serviceStatus: existing?.serviceStatus ?? 'none',
      holderTechnicianId: existing?.holderTechnicianId,
      loanedAt: existing?.loanedAt,
      notes: getText(row, ['Observaciones', 'Notas']) || existing?.notes,
      imageDataUrl: existing?.imageDataUrl,
      photoUri: existing?.photoUri,
      thumbnailUri: existing?.thumbnailUri,
      imageUpdatedAt: existing?.imageUpdatedAt,
      purchaseDate: getDate(row, ['Fecha de compra', 'Compra']) ?? existing?.purchaseDate,
      purchaseCost: getNumber(row, ['Precio', 'Coste', 'Precio compra']) ?? existing?.purchaseCost,
      supplier: getText(row, ['Proveedor']) || existing?.supplier,
      nextReviewDate: getDate(row, ['Próxima revisión', 'Proxima revision', 'Revisión', 'Revision']) ?? existing?.nextReviewDate,
      nextCalibrationDate: getDate(row, ['Próxima calibración', 'Proxima calibracion', 'Calibración', 'Calibracion']) ?? existing?.nextCalibrationDate,
      maxLoanDays: getNumber(row, ['Días máximos', 'Dias maximos', 'Plazo préstamo', 'Plazo prestamo']) ?? existing?.maxLoanDays,
      active: importedStatus !== 'retired',
      updatedAt: timestamp,
    };

    if (existingIndex === undefined) {
      codeIndex.set(code, tools.length);
      tools.push(patch);
      created += 1;
    } else {
      tools[existingIndex] = patch;
      updated += 1;
    }
  });

  return {
    data: { ...source, tools },
    created,
    updated,
    skipped,
    errors,
  };
};
