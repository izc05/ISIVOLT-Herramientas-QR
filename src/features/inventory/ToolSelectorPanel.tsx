import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, Search, Wrench } from 'lucide-react';
import type { OperationMode, Tool } from '../../domain/types';
import { buildToolCategories } from './inventoryOperations';

type Props = {
  tools: Tool[];
  mode: OperationMode;
  selectedIds: string[];
  onSelect: (toolId: string) => void;
  onBack: () => void;
};

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es-ES')
  .trim();

export default function ToolSelectorPanel({ tools, mode, selectedIds, onSelect, onBack }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const categories = useMemo(() => buildToolCategories(tools), [tools]);

  const filtered = useMemo(() => {
    const needle = normalize(query);
    return tools
      .filter((tool) => mode === 'delivery' ? tool.status === 'available' : tool.status === 'loaned')
      .filter((tool) => category === 'Todas' || tool.category === category)
      .filter((tool) => !selectedIds.includes(tool.id))
      .filter((tool) => !needle || [tool.name, tool.code, tool.category, tool.location, tool.brand ?? '', tool.model ?? '']
        .some((value) => normalize(value).includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [tools, mode, category, query, selectedIds]);

  return (
    <section className="tool-selector-panel" aria-label="Seleccionar herramienta manualmente">
      <header>
        <button type="button" onClick={onBack} aria-label="Volver a la operación"><ChevronLeft size={20} /></button>
        <div>
          <small>Identificación alternativa</small>
          <h3>Seleccionar herramienta</h3>
        </div>
      </header>

      <label className="tool-selector-search">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre, código, marca o ubicación…"
          autoFocus
        />
      </label>

      <label className="tool-selector-category">
        <Wrench size={18} />
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => <option value={item} key={item}>{item === 'Todas' ? 'Todas las categorías' : item}</option>)}
        </select>
      </label>

      <div className="tool-selector-results">
        {filtered.map((tool) => (
          <button type="button" key={tool.id} onClick={() => onSelect(tool.id)}>
            <span className="tool-selector-icon"><Wrench size={20} /></span>
            <span className="tool-selector-copy">
              <strong>{tool.name}</strong>
              <small>{tool.code} · {tool.category}</small>
              <small>{mode === 'delivery' ? tool.location : 'Actualmente prestada'}</small>
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="tool-selector-empty">
            <AlertTriangle size={30} />
            <strong>No hay herramientas disponibles</strong>
            <span>Cambia la búsqueda o selecciona otra categoría.</span>
          </div>
        )}
      </div>
    </section>
  );
}
