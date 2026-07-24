import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Search, UserRound, Users } from 'lucide-react';
import type { Technician, Tool } from '../../domain/types';
import { getEffectiveTechnicianIdentity } from '../../security/effectiveTechnician';
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
  const automaticSelectionRef = useRef('');
  const identity = getEffectiveTechnicianIdentity();
  const scopedTechnicians = useMemo(
    () => identity
      ? technicians.filter((technician) => technician.id === identity.technicianId)
      : technicians,
    [technicians, identity?.technicianId],
  );
  const categories = useMemo(() => buildTechnicianCategories(scopedTechnicians), [scopedTechnicians]);
  const loanCounts = useMemo(() => buildLoanCountByTechnician(tools), [tools]);
  const filtered = useMemo(
    () => filterSelectableTechnicians(scopedTechnicians, query, category),
    [scopedTechnicians, query, category],
  );

  useEffect(() => {
    if (!identity || automaticSelectionRef.current === identity.technicianId) return;
    const technician = technicians.find((item) => item.id === identity.technicianId && item.active);
    if (!technician) return;
    automaticSelectionRef.current = identity.technicianId;
    onSelect(technician.id);
  }, [identity?.technicianId, onSelect, technicians]);

  const categoryCount = (item: string) => item === 'Todas'
    ? scopedTechnicians.filter((technician) => technician.active).length
    : scopedTechnicians.filter((technician) => technician.active && technician.specialty === item).length;

  return (
    <section className="technician-selector-panel" aria-label="Seleccionar técnico manualmente">
      <header>
        <button type="button" onClick={onBack} aria-label="Volver al escáner"><ChevronLeft size={20} /></button>
        <div>
          <small>{identity ? 'Cuenta autenticada' : 'Identificación alternativa'}</small>
          <h3>{identity ? 'Tu ficha técnica' : 'Seleccionar técnico'}</h3>
        </div>
      </header>

      {!identity && (
        <>
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
        </>
      )}

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
            <strong>{identity ? 'Cuenta sin ficha técnica válida' : 'No hay técnicos activos'}</strong>
            <span>
              {identity
                ? 'Un administrador debe vincular esta cuenta a una ficha técnica activa.'
                : 'Cambia la búsqueda o selecciona otra categoría.'}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
