import { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  ClipboardList,
  Filter,
  Image as ImageIcon,
  Printer,
  Search,
  Square,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getPhotoUrl } from '../photos/photoStore';
import type { AppData, PhotoReference, Technician, Tool, ToolStatus } from '../types';

type QRPrintDesignerProps = {
  data: AppData;
  onMessage(message: string): void;
};

type PrintMode = 'tools' | 'technicians';
type LabelSize = '20' | '25' | '30' | '40' | 'technician-card';
type PrintTemplate = 'a4' | 'thermal';

type PrintPreferences = {
  mode: PrintMode;
  size: LabelSize;
  template: PrintTemplate;
  copies: number;
  showLogo: boolean;
  showName: boolean;
  showCategory: boolean;
  showLocation: boolean;
  showSerial: boolean;
  showPhoto: boolean;
};

type PrintLogEntry = {
  id: string;
  printedAt: string;
  mode: PrintMode;
  entityIds: string[];
  copies: number;
  size: LabelSize;
  template: PrintTemplate;
};

const PREFERENCES_KEY = 'isivoltpro:qr-print-preferences:v1';
const LOG_KEY = 'isivoltpro:qr-print-log:v1';

const toolStatusLabels: Record<ToolStatus, string> = {
  available: 'Disponible',
  loaned: 'Prestada',
  review: 'En revisión',
  retired: 'Retirada',
};

const sizeLabels: Record<LabelSize, string> = {
  '20': '20 × 20 mm',
  '25': '25 × 25 mm',
  '30': '30 × 30 mm',
  '40': '40 × 40 mm',
  'technician-card': 'Tarjeta 86 × 54 mm',
};

const defaultPreferences: PrintPreferences = {
  mode: 'tools',
  size: '30',
  template: 'a4',
  copies: 1,
  showLogo: true,
  showName: true,
  showCategory: false,
  showLocation: false,
  showSerial: false,
  showPhoto: true,
};

function loadPreferences(): PrintPreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? 'null') as Partial<PrintPreferences> | null;
    return { ...defaultPreferences, ...(stored ?? {}) };
  } catch {
    return defaultPreferences;
  }
}

function loadPrintLog(): PrintLogEntry[] {
  try {
    const value = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') as PrintLogEntry[];
    return Array.isArray(value) ? value.slice(0, 100) : [];
  } catch {
    return [];
  }
}

function toolPayload(tool: Tool) {
  return tool.qrPayload ?? `ISIVOLTPRO:TOOL:${tool.code}`;
}

function technicianPayload(technician: Technician) {
  return technician.qrPayload ?? `ISIVOLTPRO:TECH:${technician.code}`;
}

function PrimaryPhoto({ photos, enabled }: { photos?: PhotoReference[]; enabled: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const primary = photos?.find((photo) => photo.primary) ?? photos?.[0];

  useEffect(() => {
    let active = true;
    let currentUrl: string | null = null;
    if (!enabled || !primary) {
      setUrl(null);
      return;
    }
    void getPhotoUrl(primary).then((next) => {
      if (!active) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      currentUrl = next;
      setUrl(next);
    });
    return () => {
      active = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [enabled, primary?.id]);

  if (!enabled) return null;
  return url
    ? <img className="qr-print-photo" src={url} alt="" />
    : <span className="qr-print-photo placeholder"><UserRound size={25} /></span>;
}

export default function QRPrintDesigner({ data, onMessage }: QRPrintDesignerProps) {
  const [preferences, setPreferences] = useState<PrintPreferences>(() => loadPreferences());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [status, setStatus] = useState('');
  const [history, setHistory] = useState<PrintLogEntry[]>(() => loadPrintLog());

  const persistPreferences = (next: PrintPreferences) => {
    setPreferences(next);
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
  };

  const changeMode = (mode: PrintMode) => {
    persistPreferences({
      ...preferences,
      mode,
      size: mode === 'technicians' ? 'technician-card' : preferences.size === 'technician-card' ? '30' : preferences.size,
    });
    setSelectedIds([]);
    setQuery('');
    setCategoryId('');
    setLocationId('');
    setStatus('');
  };

  const normalizedQuery = query.trim().toLocaleLowerCase('es-ES');

  const visibleTools = useMemo(() => data.tools.filter((tool) => {
    const text = [tool.code, tool.name, tool.category, tool.location, tool.serialNumber ?? '']
      .join(' ')
      .toLocaleLowerCase('es-ES');
    return (!normalizedQuery || text.includes(normalizedQuery))
      && (!categoryId || tool.categoryId === categoryId)
      && (!locationId || tool.locationId === locationId)
      && (!status || tool.status === status);
  }).sort((a, b) => a.code.localeCompare(b.code, 'es')), [data.tools, normalizedQuery, categoryId, locationId, status]);

  const visibleTechnicians = useMemo(() => data.technicians.filter((technician) => {
    const text = [technician.code, technician.name, technician.category, technician.department ?? '', technician.email ?? '']
      .join(' ')
      .toLocaleLowerCase('es-ES');
    const activeStatus = technician.active ? 'active' : 'inactive';
    return (!normalizedQuery || text.includes(normalizedQuery))
      && (!categoryId || technician.categoryId === categoryId)
      && (!status || activeStatus === status);
  }).sort((a, b) => a.name.localeCompare(b.name, 'es')), [data.technicians, normalizedQuery, categoryId, status]);

  const visibleIds = preferences.mode === 'tools'
    ? visibleTools.map((tool) => tool.id)
    : visibleTechnicians.map((technician) => technician.id);

  const selectedTools = data.tools.filter((tool) => selectedIds.includes(tool.id));
  const selectedTechnicians = data.technicians.filter((technician) => selectedIds.includes(technician.id));
  const selectedCount = preferences.mode === 'tools' ? selectedTools.length : selectedTechnicians.length;

  const toggle = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  };

  const selectVisible = () => setSelectedIds((current) => [...new Set([...current, ...visibleIds])]);
  const clearSelection = () => setSelectedIds([]);

  const repeatedTools = Array.from({ length: preferences.copies }, () => selectedTools).flat();
  const repeatedTechnicians = Array.from({ length: preferences.copies }, () => selectedTechnicians).flat();
  const previewTools = repeatedTools.slice(0, 12);
  const previewTechnicians = repeatedTechnicians.slice(0, 8);

  const recordPrint = () => {
    const entry: PrintLogEntry = {
      id: `print-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
      printedAt: new Date().toISOString(),
      mode: preferences.mode,
      entityIds: [...selectedIds],
      copies: preferences.copies,
      size: preferences.size,
      template: preferences.template,
    };
    const next = [entry, ...history].slice(0, 100);
    setHistory(next);
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
  };

  const print = () => {
    if (selectedCount === 0) {
      onMessage('Selecciona al menos una herramienta o técnico antes de imprimir.');
      return;
    }
    document.body.dataset.qrPrintDesigner = 'active';
    document.body.dataset.qrPrintTemplate = preferences.template;
    document.body.dataset.qrPrintSize = preferences.size;
    const cleanup = () => {
      delete document.body.dataset.qrPrintDesigner;
      delete document.body.dataset.qrPrintTemplate;
      delete document.body.dataset.qrPrintSize;
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    recordPrint();
    window.print();
    window.setTimeout(cleanup, 1500);
    onMessage(`${selectedCount * preferences.copies} etiqueta${selectedCount * preferences.copies === 1 ? '' : 's'} preparada${selectedCount * preferences.copies === 1 ? '' : 's'} para imprimir.`);
  };

  const categories = preferences.mode === 'tools'
    ? (data.toolCategories ?? []).filter((entry) => entry.active)
    : (data.technicianCategories ?? []).filter((entry) => entry.active);

  const lastPrint = history[0];

  return (
    <div className="qr-print-designer">
      <section className="qr-print-controls">
        <header>
          <div><small>DISEÑADOR DE IDENTIFICACIÓN</small><h3>Etiquetas y tarjetas QR</h3><p>Selecciona registros, ajusta el formato y revisa el resultado antes de imprimir.</p></div>
          <Printer size={27} />
        </header>

        <div className="qr-print-mode-switch">
          <button className={preferences.mode === 'tools' ? 'active' : ''} type="button" onClick={() => changeMode('tools')}><Wrench size={18} /> Herramientas</button>
          <button className={preferences.mode === 'technicians' ? 'active' : ''} type="button" onClick={() => changeMode('technicians')}><UserRound size={18} /> Técnicos</button>
        </div>

        <div className="qr-print-filters">
          <label className="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código, nombre, serie…" /></label>
          <label><Filter size={16} /><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Todas las categorías</option>{categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
          {preferences.mode === 'tools' && <label><select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Todas las ubicaciones</option>{(data.locations ?? []).filter((entry) => entry.active).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>}
          <label><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos los estados</option>{preferences.mode === 'tools' ? <>{Object.entries(toolStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</> : <><option value="active">Activos</option><option value="inactive">Inactivos</option></>}</select></label>
        </div>

        <div className="qr-print-selection-bar">
          <strong>{selectedCount} seleccionado{selectedCount === 1 ? '' : 's'}</strong>
          <button type="button" onClick={selectVisible}><CheckSquare size={16} /> Seleccionar visibles</button>
          <button type="button" onClick={clearSelection}><X size={16} /> Limpiar</button>
        </div>

        <div className="qr-print-list">
          {preferences.mode === 'tools' ? visibleTools.map((tool) => (
            <button className={selectedIds.includes(tool.id) ? 'selected' : ''} key={tool.id} type="button" onClick={() => toggle(tool.id)}>
              {selectedIds.includes(tool.id) ? <CheckSquare size={18} /> : <Square size={18} />}
              <span><strong>{tool.code} · {tool.name}</strong><small>{tool.category} · {tool.location}</small></span>
              <em>{toolStatusLabels[tool.status]}</em>
            </button>
          )) : visibleTechnicians.map((technician) => (
            <button className={selectedIds.includes(technician.id) ? 'selected' : ''} key={technician.id} type="button" onClick={() => toggle(technician.id)}>
              {selectedIds.includes(technician.id) ? <CheckSquare size={18} /> : <Square size={18} />}
              <span><strong>{technician.code} · {technician.name}</strong><small>{technician.category}</small></span>
              <em>{technician.active ? 'Activo' : 'Inactivo'}</em>
            </button>
          ))}
          {visibleIds.length === 0 && <div className="qr-print-empty">No hay registros que coincidan con los filtros.</div>}
        </div>

        <div className="qr-print-options">
          <label>Tamaño<select value={preferences.size} onChange={(event) => persistPreferences({ ...preferences, size: event.target.value as LabelSize })}>{Object.entries(sizeLabels).filter(([value]) => preferences.mode === 'technicians' || value !== 'technician-card').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Plantilla<select value={preferences.template} onChange={(event) => persistPreferences({ ...preferences, template: event.target.value as PrintTemplate })}><option value="a4">Hoja A4</option><option value="thermal">Impresora térmica</option></select></label>
          <label>Copias<input type="number" min="1" max="10" value={preferences.copies} onChange={(event) => persistPreferences({ ...preferences, copies: Math.min(10, Math.max(1, Number(event.target.value) || 1)) })} /></label>
        </div>

        <div className="qr-print-toggles">
          <label><input type="checkbox" checked={preferences.showLogo} onChange={(event) => persistPreferences({ ...preferences, showLogo: event.target.checked })} /> Logo IsiVoltPro</label>
          <label><input type="checkbox" checked={preferences.showName} onChange={(event) => persistPreferences({ ...preferences, showName: event.target.checked })} /> Nombre</label>
          <label><input type="checkbox" checked={preferences.showCategory} onChange={(event) => persistPreferences({ ...preferences, showCategory: event.target.checked })} /> Categoría</label>
          {preferences.mode === 'tools' && <label><input type="checkbox" checked={preferences.showLocation} onChange={(event) => persistPreferences({ ...preferences, showLocation: event.target.checked })} /> Ubicación</label>}
          {preferences.mode === 'tools' && <label><input type="checkbox" checked={preferences.showSerial} onChange={(event) => persistPreferences({ ...preferences, showSerial: event.target.checked })} /> Número de serie</label>}
          {preferences.mode === 'technicians' && <label><input type="checkbox" checked={preferences.showPhoto} onChange={(event) => persistPreferences({ ...preferences, showPhoto: event.target.checked })} /> Fotografía</label>}
        </div>

        <button className="qr-print-primary" type="button" onClick={print}><Printer size={18} /> Imprimir {selectedCount * preferences.copies || ''} etiqueta{selectedCount * preferences.copies === 1 ? '' : 's'}</button>
        {lastPrint && <p className="qr-print-last"><ClipboardList size={15} /> Última tirada: {new Date(lastPrint.printedAt).toLocaleString('es-ES')} · {lastPrint.entityIds.length * lastPrint.copies} etiquetas.</p>}
      </section>

      <section className="qr-print-preview-panel">
        <header><div><small>VISTA PREVIA</small><h3>{sizeLabels[preferences.size]}</h3></div><span>{preferences.template === 'a4' ? 'A4' : 'TÉRMICA'}</span></header>
        <div className={`qr-print-sheet mode-${preferences.mode} size-${preferences.size} template-${preferences.template}`}>
          {(preferences.mode === 'tools' ? previewTools : previewTechnicians).map((entity, index) => preferences.mode === 'tools' ? (
            <article className="qr-print-label tool-label" key={`${entity.id}-${index}`}>
              {preferences.showLogo && <div className="qr-print-brand"><b>ϟ</b><span>IsiVoltPro</span></div>}
              <QRCodeSVG value={toolPayload(entity as Tool)} level="H" includeMargin={false} />
              <strong>{(entity as Tool).code}</strong>
              {preferences.showName && <p>{(entity as Tool).name}</p>}
              {preferences.showCategory && <small>{(entity as Tool).category}</small>}
              {preferences.showLocation && <small>{(entity as Tool).location}</small>}
              {preferences.showSerial && (entity as Tool).serialNumber && <small>S/N {(entity as Tool).serialNumber}</small>}
            </article>
          ) : (
            <article className="qr-print-label technician-label" key={`${entity.id}-${index}`}>
              {preferences.showLogo && <div className="qr-print-brand"><b>ϟ</b><span>IsiVoltPro</span></div>}
              <PrimaryPhoto photos={(entity as Technician).photos} enabled={preferences.showPhoto && preferences.size === 'technician-card'} />
              <QRCodeSVG value={technicianPayload(entity as Technician)} level="H" includeMargin={false} />
              <div className="qr-print-person"><strong>{(entity as Technician).name}</strong><p>{(entity as Technician).code}</p>{preferences.showCategory && <small>{(entity as Technician).category}</small>}</div>
            </article>
          ))}
          {selectedCount === 0 && <div className="qr-print-preview-empty"><ImageIcon size={38} /><strong>Selecciona registros</strong><p>La vista previa mostrará hasta doce etiquetas; la impresión incluirá toda la selección y sus copias.</p></div>}
        </div>
      </section>
    </div>
  );
}
