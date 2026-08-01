import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  FileSpreadsheet,
  PackageOpen,
  Printer,
  QrCode,
  Upload,
  Wrench,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { saveData } from '../storage';
import type { AppData, Tool, ToolStatus } from '../types';

type InventoryAdminProps = {
  data: AppData;
  onDataChange(data: AppData): void;
  onMessage(message: string): void;
};

const statusLabels: Record<ToolStatus, string> = {
  available: 'Disponible',
  loaned: 'Prestado',
  review: 'En revisión',
  retired: 'Retirado',
};

const uid = () => `tool-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const toolPayload = (tool: Pick<Tool, 'code' | 'qrPayload'>) => tool.qrPayload || `ISIVOLTPRO:TOOL:${tool.code}`;

const normalizeHeader = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '');

function parseLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = '';
    } else current += char;
  }
  values.push(current.trim());
  return values;
}

function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const headers = parseLine(lines[0], delimiter).map(normalizeHeader);
  return lines.slice(1).map((line) => {
    const values = parseLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function valueFrom(row: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]?.trim();
    if (value) return value;
  }
  return '';
}

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default function InventoryAdmin({ data, onDataChange, onMessage }: InventoryAdminProps) {
  const [toolId, setToolId] = useState('');
  const [draft, setDraft] = useState<Tool | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(() => data.tools.find((tool) => tool.id === toolId) ?? null, [data.tools, toolId]);
  const sortedTools = useMemo(() => [...data.tools].sort((a, b) => a.code.localeCompare(b.code, 'es')), [data.tools]);

  useEffect(() => {
    setDraft(selected ? { ...selected } : null);
  }, [selected]);

  const commit = (next: AppData) => {
    saveData(next);
    onDataChange(next);
  };

  const saveTool = () => {
    if (!draft || !selected) return;
    const code = draft.code.trim().toUpperCase();
    const name = draft.name.trim();
    const category = draft.category.trim();
    const location = draft.location.trim();
    if (!code || !name || !category) {
      onMessage('Código, nombre y categoría son obligatorios.');
      return;
    }
    if (data.tools.some((tool) => tool.id !== draft.id && tool.code.toUpperCase() === code)) {
      onMessage(`El código ${code} ya pertenece a otro artículo.`);
      return;
    }
    if (selected.status === 'loaned' && draft.status !== 'loaned') {
      onMessage('Un artículo prestado debe devolverse mediante una operación antes de cambiar su estado.');
      setDraft({ ...draft, status: 'loaned' });
      return;
    }
    const updatedAt = new Date().toISOString();
    const normalized: Tool = {
      ...draft,
      code,
      name,
      category,
      location,
      brand: draft.brand?.trim() || undefined,
      model: draft.model?.trim() || undefined,
      serialNumber: draft.serialNumber?.trim() || undefined,
      qrPayload: draft.code === selected.code ? toolPayload(draft) : `ISIVOLTPRO:TOOL:${code}`,
      technicianId: draft.status === 'loaned' ? draft.technicianId : undefined,
      updatedAt,
    };
    const next = { ...data, tools: data.tools.map((tool) => tool.id === normalized.id ? normalized : tool) };
    commit(next);
    setDraft(normalized);
    onMessage(`${normalized.code} · ${normalized.name} actualizado.`);
  };

  const setStatus = (status: ToolStatus) => {
    if (!draft) return;
    if (draft.status === 'loaned') {
      onMessage('El artículo está prestado. Registra primero su devolución.');
      return;
    }
    setDraft({ ...draft, status, technicianId: undefined });
  };

  const exportTemplate = () => {
    download(
      'plantilla-isivoltpro-inventario.csv',
      'Código;Nombre;Categoría;Ubicación;Marca;Modelo;Serie\nELE-001;Taladro percutor;Herramienta eléctrica;Almacén A;Bosch;GBH 2-26;SERIE-001\n',
    );
    onMessage('Plantilla CSV descargada.');
  };

  const importCsv = async (file?: File) => {
    if (!file) return;
    try {
      const rows = parseCsv(await file.text());
      if (rows.length === 0) throw new Error('Sin filas');
      const now = new Date().toISOString();
      const byCode = new Map(data.tools.map((tool) => [tool.code.toUpperCase(), tool]));
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const row of rows) {
        const code = valueFrom(row, 'codigo', 'code', 'id').toUpperCase();
        const name = valueFrom(row, 'nombre', 'name', 'descripcion');
        const category = valueFrom(row, 'categoria', 'category', 'tipo');
        const location = valueFrom(row, 'ubicacion', 'location', 'almacen');
        if (!code || !name || !category) {
          skipped += 1;
          continue;
        }
        const existing = byCode.get(code);
        if (existing) {
          const nextTool: Tool = {
            ...existing,
            name,
            category,
            location: location || existing.location,
            brand: valueFrom(row, 'marca', 'brand') || existing.brand,
            model: valueFrom(row, 'modelo', 'model') || existing.model,
            serialNumber: valueFrom(row, 'serie', 'numero_serie', 'serial', 'serial_number') || existing.serialNumber,
            updatedAt: now,
          };
          byCode.set(code, nextTool);
          updated += 1;
        } else {
          const nextTool: Tool = {
            id: uid(),
            code,
            name,
            category,
            location,
            brand: valueFrom(row, 'marca', 'brand') || undefined,
            model: valueFrom(row, 'modelo', 'model') || undefined,
            serialNumber: valueFrom(row, 'serie', 'numero_serie', 'serial', 'serial_number') || undefined,
            qrPayload: `ISIVOLTPRO:TOOL:${code}`,
            status: 'available',
            createdAt: now,
            updatedAt: now,
          };
          byCode.set(code, nextTool);
          created += 1;
        }
      }

      const next = { ...data, tools: [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code, 'es')) };
      commit(next);
      onMessage(`Importación terminada: ${created} altas, ${updated} actualizados y ${skipped} omitidos.`);
    } catch {
      onMessage('No se ha podido importar el CSV. Revisa la plantilla y el separador.');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const printMode = (mode: 'single' | 'all') => {
    document.body.dataset.inventoryPrint = mode;
    const cleanup = () => { delete document.body.dataset.inventoryPrint; };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
  };

  return (
    <div className="inventory-admin">
      <section className="inventory-editor-card">
        <label>Artículo
          <select value={toolId} onChange={(event) => setToolId(event.target.value)}>
            <option value="">Selecciona una herramienta o material</option>
            {sortedTools.map((tool) => <option key={tool.id} value={tool.id}>{tool.code} · {tool.name} · {statusLabels[tool.status]}</option>)}
          </select>
        </label>

        {draft ? (
          <>
            <div className="inventory-form-grid">
              <label>Código<input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} /></label>
              <label>Nombre<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label>Categoría<input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
              <label>Ubicación<input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label>
              <label>Marca<input value={draft.brand ?? ''} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} /></label>
              <label>Modelo<input value={draft.model ?? ''} onChange={(event) => setDraft({ ...draft, model: event.target.value })} /></label>
              <label>Número de serie<input value={draft.serialNumber ?? ''} onChange={(event) => setDraft({ ...draft, serialNumber: event.target.value })} /></label>
              <label>Estado
                <select value={draft.status} onChange={(event) => setStatus(event.target.value as ToolStatus)} disabled={draft.status === 'loaned'}>
                  <option value="available">Disponible</option>
                  <option value="loaned">Prestado</option>
                  <option value="review">En revisión</option>
                  <option value="retired">Retirado</option>
                </select>
              </label>
            </div>
            {draft.status === 'loaned' && <p className="inventory-loaned-warning">Este artículo está prestado. Debe devolverse desde Escanear antes de cambiar su estado.</p>}
            <button className="admin-primary" type="button" onClick={saveTool}><Check size={18} /> Guardar artículo</button>
          </>
        ) : <div className="inventory-empty"><Wrench size={34} /><strong>Editar inventario</strong><p>Selecciona un artículo para modificar sus datos, estado o etiqueta QR.</p></div>}
      </section>

      <section className="inventory-label-card" id="isivoltpro-tool-label">
        {selected ? (
          <>
            <div className="inventory-label-brand"><span>ϟ</span><div><strong>IsiVoltPro</strong><small>Herramientas · QR/NFC</small></div></div>
            <QRCodeSVG value={toolPayload(selected)} size={188} level="H" includeMargin />
            <h3>{selected.name}</h3>
            <p>{selected.code} · {selected.category}</p>
            <em>{statusLabels[selected.status]}</em>
            <button type="button" onClick={() => printMode('single')}><Printer size={17} /> Imprimir etiqueta</button>
          </>
        ) : <div className="inventory-label-placeholder"><QrCode size={42} /><strong>Etiqueta QR</strong><p>Selecciona un artículo para verla e imprimirla.</p></div>}
      </section>

      <section className="inventory-import-card">
        <div><FileSpreadsheet size={25} /><div><strong>Alta y actualización por CSV</strong><p>Los artículos existentes se actualizan por código. Los nuevos se crean disponibles.</p></div></div>
        <div className="inventory-import-actions">
          <button type="button" onClick={exportTemplate}><Download size={17} /> Descargar plantilla</button>
          <button type="button" onClick={() => importRef.current?.click()}><Upload size={17} /> Importar CSV</button>
          <input ref={importRef} type="file" accept="text/csv,.csv" hidden onChange={(event) => void importCsv(event.target.files?.[0])} />
        </div>
      </section>

      <section className="inventory-batch-card">
        <div><Printer size={25} /><div><strong>Etiquetas del inventario</strong><p>Prepara una hoja con los {data.tools.length} códigos QR registrados.</p></div></div>
        <button type="button" disabled={data.tools.length === 0} onClick={() => printMode('all')}><Printer size={17} /> Imprimir todas</button>
      </section>

      <div className="inventory-label-sheet" id="isivoltpro-label-sheet">
        {sortedTools.map((tool) => (
          <article key={tool.id}>
            <QRCodeSVG value={toolPayload(tool)} size={112} level="H" />
            <div><strong>{tool.code}</strong><span>{tool.name}</span><small>{tool.category}</small></div>
          </article>
        ))}
      </div>
    </div>
  );
}
