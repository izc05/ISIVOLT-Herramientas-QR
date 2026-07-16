import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, MapPin, Search, Wrench } from 'lucide-react';
import type { OperationMode, Technician, Tool } from '../../domain/types';
import { buildToolCategories, getDeliveryAlert } from './inventoryOperations';

type Props = {
  tools: Tool[];
  technicians: Technician[];
  mode: OperationMode;
  technicianId?: string;
  selectedIds: string[];
  onSelect: (toolId: string) => boolean;
  onBack: () => void;
};

const statusLabel: Record<Tool['status'], string> = {
  available: 'Disponible',
  loaned: 'Prestada',
  review: 'En revisión',
  damaged: 'Averiada',
  retired: 'Baja',
};

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es-ES')
  .trim();

export default function ToolSelectorPanel({
  tools,
  technicians,
  mode,
  technicianId,
  selectedIds,
  onSelect,
  onBack,
}: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const categories = useMemo(() => buildToolCategories(tools), [tools]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const technicianById = useMemo(
    () => new Map(technicians.map((technician) => [technician.id, technician])),
    [technicians],
  );

  const filtered = useMemo(() => {
    const needle = normalize(query);
    return tools
      .filter((tool) => tool.active !== false)
      .filter((tool) => mode === 'return' ? tool.status === 'loaned' : true)
      .filter((tool) => mode !== 'return' || !technicianId || tool.holderTechnicianId === technicianId)
      .filter((tool) => category === 'Todas' || tool.category === category)
      .filter((tool) => !needle || [
        tool.name,
        tool.code,
        tool.category,
        tool.location,
        tool.brand ?? '',
        tool.model ?? '',
        tool.serialNumber ?? '',
        tool.nfcUid ?? '',
      ].some((value) => normalize(value).includes(needle)))
      .sort((a, b) => {
        const selectedDifference = Number(selected.has(b.id)) - Number(selected.has(a.id));
        if (selectedDifference !== 0) return selectedDifference;
        if (a.status === 'available' && b.status !== 'available') return -1;
        if (a.status !== 'available' && b.status === 'available') return 1;
        return a.name.localeCompare(b.name, 'es');
      });
  }, [tools, mode, technicianId, category, query, selected]);

  return (
    <section className="tool-selector-panel" aria-label="Seleccionar herramienta manualmente">
      <header>
        <button type="button" onClick={onBack} aria-label="Volver al escáner"><ChevronLeft size={20} /></button>
        <div>
          <small>Identificación alternativa</small>
          <h3>Buscar herramienta</h3>
        </div>
        <b>{selectedIds.length} añadida{selectedIds.length === 1 ? '' : 's'}</b>
      </header>

      <label className="tool-selector-search">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre, código, ubicación, marca o NFC…"
          autoFocus
        />
      </label>

      <div className="tool-selector-categories" aria-label="Categorías de herramientas">
        {categories.map((item) => (
          <button
            type="button"
            key={item}
            className={category === item ? 'active' : ''}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="tool-selector-results">
        {filtered.map((tool) => {
          const isSelected = selected.has(tool.id);
          const alert = mode === 'delivery' ? getDeliveryAlert(tool, technicianId) : null;
          const holder = technicianById.get(tool.holderTechnicianId ?? '');
          return (
            <button
              type="button"
              key={tool.id}
              className={`${isSelected ? 'selected' : ''} ${alert ? 'blocked' : ''}`}
              onClick={() => onSelect(tool.id)}
            >
              <span className="tool-selector-icon">
                {isSelected ? <Check size={20} /> : alert ? <AlertTriangle size={20} /> : <Wrench size={20} />}
              </span>
              <span className="tool-selector-copy">
                <strong>{tool.name}</strong>
                <small>{tool.code} · {tool.category}{tool.nfcUid ? ' · NFC' : ''}</small>
                <em><MapPin size={13} /> {mode === 'return' ? holder?.name ?? 'Sin responsable' : tool.location}</em>
              </span>
              <span className={`tool-selector-status status-${tool.status}`}>
                {isSelected ? 'Añadida' : alert ? 'Bloqueada' : statusLabel[tool.status]}
              </span>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="tool-selector-empty">
            <Wrench size={30} />
            <strong>No hay herramientas en este filtro</strong>
            <span>Cambia la búsqueda o selecciona otra categoría.</span>
          </div>
        )}
      </div>

      <button className="tool-selector-done" type="button" onClick={onBack}>
        <Check size={18} /> Volver a la operación
      </button>
    </section>
  );
}
