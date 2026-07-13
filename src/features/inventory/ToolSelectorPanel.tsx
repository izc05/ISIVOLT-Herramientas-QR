import { useMemo, useState } from 'react';
import { ChevronLeft, Search, Wrench } from 'lucide-react';
import type { OperationMode, Technician, Tool } from '../../domain/types';

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('es-ES');

type Props = {
  tools: Tool[];
  technicians: Technician[];
  mode: OperationMode;
  selectedIds: string[];
  onSelect: (toolId: string) => boolean;
  onBack: () => void;
};

export default function ToolSelectorPanel({ tools, technicians, mode, selectedIds, onSelect, onBack }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');

  const technicianById = useMemo(
    () => new Map(technicians.map((technician) => [technician.id, technician])),
    [technicians],
  );

  const candidates = useMemo(
    () => tools.filter((tool) => mode === 'delivery' ? tool.status === 'available' : tool.status === 'loaned'),
    [tools, mode],
  );

  const categories = useMemo(
    () => ['Todas', ...Array.from(new Set(candidates.map((tool) => tool.category.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'))],
    [candidates],
  );

  const filtered = useMemo(() => {
    const needle = normalize(query);
    return candidates
      .filter((tool) => category === 'Todas' || tool.category === category)
      .filter((tool) => !needle || [tool.name, tool.code, tool.category, tool.location, tool.brand ?? '', tool.model ?? '']
        .some((value) => normalize(value).includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [candidates, category, query]);

  return (
    <section className="tool-selector-panel" aria-label="Seleccionar herramienta manualmente">
      <header>
        <button type="button" onClick={onBack} aria-label="Volver a la operación"><ChevronLeft size={20} /></button>
        <div><small>Selección alternativa</small><h3>{mode === 'delivery' ? 'Herramientas disponibles' : 'Herramientas prestadas'}</h3></div>
      </header>

      <label className="tool-selector-search">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, código, ubicación o marca…" autoFocus />
      </label>

      <label className="tool-selector-category">
        <Wrench size={18} />
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => <option value={item} key={item}>{item === 'Todas' ? 'Todas las categorías' : item}</option>)}
        </select>
      </label>

      <div className="tool-selector-results">
        {filtered.map((tool) => {
          const selected = selectedIds.includes(tool.id);
          const holder = technicianById.get(tool.holderTechnicianId ?? '');
          return (
            <button
              type="button"
              key={tool.id}
              className={selected ? 'selected' : ''}
              onClick={() => onSelect(tool.id)}
              disabled={selected}
            >
              <span className="tool-selector-icon"><Wrench size={19} /></span>
              <span className="tool-selector-copy">
                <strong>{tool.name}</strong>
                <small>{tool.code} · {tool.category}</small>
                <small>{mode === 'return' ? holder?.name ?? 'Sin responsable' : tool.location}</small>
              </span>
              <span className="tool-selector-state">{selected ? 'Añadida' : 'Añadir'}</span>
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

      <button className="tool-selector-done" type="button" onClick={onBack}>Volver a la operación · {selectedIds.length} seleccionada{selectedIds.length === 1 ? '' : 's'}</button>
    </section>
  );
}
