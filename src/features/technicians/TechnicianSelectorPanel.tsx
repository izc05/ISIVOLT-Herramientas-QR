import { useMemo, useState } from 'react';
import { ChevronLeft, Search, UserRound, Users } from 'lucide-react';
import type { Technician, Tool } from '../../domain/types';
import {
  buildLoanCountByTechnician,
  buildTechnicianCategories,
  filterSelectableTechnicians,
  getTechnicianInitials,
} from './selector';

type Props = {
  technicians: Technician[];
  tools: Tool[];
  onSelect: (technicianId: string) => void;
  onBack: () => void;
};

export default function TechnicianSelectorPanel({ technicians, tools, onSelect, onBack }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const categories = useMemo(() => buildTechnicianCategories(technicians), [technicians]);
  const loanCounts = useMemo(() => buildLoanCountByTechnician(tools), [tools]);
  const filtered = useMemo(
    () => filterSelectableTechnicians(technicians, query, category),
    [technicians, query, category],
  );

  const categoryCount = (item: string) => item === 'Todas'
    ? technicians.filter((technician) => technician.active).length
    : technicians.filter((technician) => technician.active && technician.specialty === item).length;

  return (
    <section className="technician-selector-panel" aria-label="Seleccionar técnico manualmente">
      <header>
        <button type="button" onClick={onBack} aria-label="Volver al escáner"><ChevronLeft size={20} /></button>
        <div><small>Identificación alternativa</small><h3>Seleccionar técnico</h3></div>
      </header>

      <label className="technician-selector-search">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre, código o especialidad…"
          autoFocus
        />
      </label>

      <div className="technician-selector-categories" aria-label="Filtrar técnicos por categoría">
        {['Todas', ...categories].map((item) => (
          <button
            type="button"
            key={item}
            className={category === item ? 'active' : ''}
            onClick={() => setCategory(item)}
          >
            {item} · {categoryCount(item)}
          </button>
        ))}
      </div>

      <label className="technician-selector-category">
        <Users size={18} />
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="Todas">Todas las categorías</option>
          {categories.map((item) => <option value={item} key={item}>{item}</option>)}
        </select>
      </label>

      <div className="technician-selector-results">
        {filtered.map((technician) => (
          <button type="button" key={technician.id} onClick={() => onSelect(technician.id)}>
            <span className="technician-selector-avatar">{getTechnicianInitials(technician.name)}</span>
            <span className="technician-selector-copy">
              <strong>{technician.name}</strong>
              <small>{technician.code} · {technician.specialty}</small>
            </span>
            <span className="technician-selector-loans">
              <UserRound size={15} /> {loanCounts.get(technician.id) ?? 0}
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="technician-selector-empty">
            <Users size={30} />
            <strong>No hay técnicos activos</strong>
            <span>Cambia la búsqueda o selecciona otra categoría.</span>
          </div>
        )}
      </div>
    </section>
  );
}
