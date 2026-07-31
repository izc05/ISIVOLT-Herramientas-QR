import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Barcode,
  Check,
  ChevronDown,
  ChevronUp,
  MapPin,
  PackagePlus,
  Sparkles,
  X,
} from 'lucide-react';
import type { Tool } from '../../domain/types';
import { createManagedTool, saveManagedTool } from '../management/managementService';
import { assertPermission } from '../../security/permissions';
import { loadAppData } from '../../services/storage';

const BASE_CATEGORIES = [
  'Herramienta general',
  'Electricidad',
  'Climatización',
  'Fontanería',
  'Medida y comprobación',
  'PCI',
  'EPI',
  'Maletín',
] as const;

const BASE_LOCATIONS = [
  'Almacén principal',
  'Taller',
  'Vehículo',
  'Cuarto técnico',
] as const;

const CATEGORY_PREFIXES: Record<string, string> = {
  'Herramienta general': 'HER',
  Electricidad: 'ELE',
  Climatización: 'CLI',
  Fontanería: 'FON',
  'Medida y comprobación': 'MED',
  PCI: 'PCI',
  EPI: 'EPI',
  Maletín: 'MAL',
};

const normalizedPrefix = (category: string) => {
  const configured = CATEGORY_PREFIXES[category];
  if (configured) return configured;
  const compact = category
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  return compact.slice(0, 3) || 'HER';
};

const nextToolCode = (tools: Tool[], category: string) => {
  const prefix = normalizedPrefix(category);
  const used = new Set(tools.map((tool) => tool.code.trim().toUpperCase()));
  let sequence = 1;
  while (used.has(`${prefix}-${String(sequence).padStart(3, '0')}`)) sequence += 1;
  return `${prefix}-${String(sequence).padStart(3, '0')}`;
};

const uniqueOptions = (base: readonly string[], values: string[]) => [
  ...new Set([...base, ...values.map((value) => value.trim()).filter(Boolean)]),
];

type Props = {
  onSaved: () => void;
};

export default function ToolQuickCreateRC57({ onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('Herramienta general');
  const [customCategory, setCustomCategory] = useState('');
  const [location, setLocation] = useState<string>('Almacén principal');
  const [customLocation, setCustomLocation] = useState('');
  const [manualCode, setManualCode] = useState(false);
  const [code, setCode] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState('');

  const data = useMemo(() => loadAppData(), [open]);
  const categories = useMemo(
    () => uniqueOptions(BASE_CATEGORIES, data.tools.map((tool) => tool.category)),
    [data.tools],
  );
  const locations = useMemo(
    () => uniqueOptions(BASE_LOCATIONS, data.tools.map((tool) => tool.location)),
    [data.tools],
  );
  const finalCategory = category === '__custom__' ? customCategory.trim() : category;
  const finalLocation = location === '__custom__' ? customLocation.trim() : location;
  const automaticCode = useMemo(
    () => nextToolCode(data.tools, finalCategory || 'Herramienta general'),
    [data.tools, finalCategory],
  );
  const finalCode = manualCode ? code.trim().toUpperCase() : automaticCode;

  const reset = () => {
    setName('');
    setCategory('Herramienta general');
    setCustomCategory('');
    setLocation('Almacén principal');
    setCustomLocation('');
    setManualCode(false);
    setCode('');
    setBrand('');
    setModel('');
    setSerialNumber('');
    setNotes('');
    setAdvanced(false);
    setError('');
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  useEffect(() => {
    const openCreate = () => {
      setError('');
      setOpen(true);
    };
    const intercept = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button || !button.textContent?.includes('Nueva herramienta')) return;
      if (button.closest('.workflow-command-panel')) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openCreate();
    };

    document.addEventListener('click', intercept, true);
    window.addEventListener('isivolt:tool-create-open', openCreate);
    return () => {
      document.removeEventListener('click', intercept, true);
      window.removeEventListener('isivolt:tool-create-open', openCreate);
    };
  }, []);

  const save = () => {
    try {
      setError('');
      assertPermission('inventory.manage');
      if (!name.trim()) throw new Error('Escribe el nombre de la herramienta.');
      if (!finalCategory) throw new Error('Selecciona o escribe una categoría.');
      if (!finalLocation) throw new Error('Selecciona o escribe una ubicación.');
      if (!finalCode) throw new Error('El código interno es obligatorio.');

      const base = createManagedTool();
      const tool: Tool = {
        ...base,
        code: finalCode,
        qrCode: `ISIVOLT:TOOL:${finalCode}`,
        name: name.trim(),
        category: finalCategory,
        location: finalLocation,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      saveManagedTool(tool);
      close();
      onSaved();
      window.dispatchEvent(new CustomEvent('isivolt:management-refresh'));
      window.dispatchEvent(new CustomEvent('isivolt:app-refresh'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido crear la herramienta.');
    }
  };

  if (!open) return null;

  return (
    <div className="tool-quick-create-backdrop" onClick={close}>
      <section
        className="tool-quick-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tool-quick-create-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span><PackagePlus size={24} /></span>
            <div>
              <small>Alta rápida</small>
              <h2 id="tool-quick-create-title">Nueva herramienta</h2>
              <p>Registra lo esencial ahora. La ficha completa puede ampliarse después.</p>
            </div>
          </div>
          <button type="button" onClick={close} aria-label="Cerrar"><X size={21} /></button>
        </header>

        <main>
          <label className="tool-quick-create-wide">
            <span>Nombre de la herramienta</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Multímetro Fluke 289"
              autoFocus
            />
          </label>

          <label>
            <span>Categoría</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => <option value={item} key={item}>{item}</option>)}
              <option value="__custom__">Otra categoría…</option>
            </select>
          </label>

          <label>
            <span>Ubicación inicial</span>
            <select value={location} onChange={(event) => setLocation(event.target.value)}>
              {locations.map((item) => <option value={item} key={item}>{item}</option>)}
              <option value="__custom__">Otra ubicación…</option>
            </select>
          </label>

          {category === '__custom__' && (
            <label className="tool-quick-create-wide">
              <span>Nueva categoría</span>
              <input value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} placeholder="Ej. Herramienta de refrigeración" />
            </label>
          )}

          {location === '__custom__' && (
            <label className="tool-quick-create-wide">
              <span>Nueva ubicación</span>
              <input value={customLocation} onChange={(event) => setCustomLocation(event.target.value)} placeholder="Ej. Almacén planta -1" />
            </label>
          )}

          <section className="tool-quick-code-card">
            <span><Barcode size={20} /></span>
            <div>
              <small>Código y QR automáticos</small>
              <strong>{finalCode || automaticCode}</strong>
              <p>Se generará `ISIVOLT:TOOL:{finalCode || automaticCode}`.</p>
            </div>
            <button type="button" onClick={() => setManualCode((value) => !value)}>
              {manualCode ? 'Usar automático' : 'Editar código'}
            </button>
          </section>

          {manualCode && (
            <label className="tool-quick-create-wide">
              <span>Código manual</span>
              <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder={automaticCode} />
            </label>
          )}

          <button type="button" className="tool-quick-advanced-toggle" onClick={() => setAdvanced((value) => !value)}>
            <Sparkles size={17} />
            <span><strong>Datos opcionales</strong><small>Marca, modelo, serie y observaciones</small></span>
            {advanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {advanced && (
            <div className="tool-quick-advanced-grid">
              <label><span>Marca</span><input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Fluke" /></label>
              <label><span>Modelo</span><input value={model} onChange={(event) => setModel(event.target.value)} placeholder="289" /></label>
              <label className="tool-quick-create-wide"><span>Número de serie</span><input value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} /></label>
              <label className="tool-quick-create-wide"><span>Observaciones</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Accesorios, estado inicial o información útil…" /></label>
            </div>
          )}

          {error && <p className="tool-quick-create-error"><AlertTriangle size={17} /> {error}</p>}
        </main>

        <footer>
          <span><MapPin size={16} /> {finalLocation || 'Ubicación pendiente'}</span>
          <button type="button" onClick={close}>Cancelar</button>
          <button
            type="button"
            className="primary"
            disabled={!name.trim() || !finalCategory || !finalLocation || !finalCode}
            onClick={save}
          >
            <Check size={18} /> Crear herramienta
          </button>
        </footer>
      </section>
    </div>
  );
}
