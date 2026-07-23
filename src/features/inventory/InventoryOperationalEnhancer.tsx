import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronDown,
  Filter,
  RotateCcw,
  Users,
} from 'lucide-react';
import type { AppData } from '../../domain/types';
import { loadAppData } from '../../services/storage';
import {
  buildToolCategories,
  buildToolMovementTimes,
  filterInventoryTools,
  formatOperationDateTime,
  type InventoryPreset,
} from './inventoryOperations';
import { resolveToolCategory } from './inventoryPresentation';
import {
  resolveToolLifecyclePresentation,
  type ToolLifecycleKey,
} from './toolLifecycle';

const presetMeta: Array<{ id: InventoryPreset; label: string; icon: typeof Boxes }> = [
  { id: 'all', label: 'Todas', icon: Boxes },
  { id: 'available', label: 'Disponibles', icon: CheckCircle2 },
  { id: 'loaned', label: 'Prestadas', icon: Users },
  { id: 'attention', label: 'Atención', icon: AlertTriangle },
];

const lifecycleOptions: Array<{ value: 'all' | ToolLifecycleKey; label: string }> = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'available', label: 'Disponible' },
  { value: 'loaned', label: 'Prestada' },
  { value: 'review', label: 'En revisión' },
  { value: 'damaged', label: 'Averiada' },
  { value: 'blocked', label: 'Bloqueada' },
  { value: 'retired', label: 'Retirada' },
];

const findNavButton = (label: string) => [
  ...document.querySelectorAll<HTMLButtonElement>('.bottom-nav button, .core-bottom-nav button'),
].find((button) => button.textContent?.toLocaleLowerCase('es-ES').includes(label.toLocaleLowerCase('es-ES')));

const findInventoryHost = () => {
  const sections = [...document.querySelectorAll<HTMLElement>('.page-section')];
  const inventory = sections.find((section) => section.querySelector('h1')?.textContent?.trim() === 'Inventario');
  if (!inventory) return null;
  let host = inventory.querySelector<HTMLElement>('.inventory-operational-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'inventory-operational-host';
    inventory.querySelector('.page-heading')?.after(host);
  }
  return host;
};

export default function InventoryOperationalEnhancer() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [preset, setPreset] = useState<InventoryPreset>('all');
  const [category, setCategory] = useState('Todas');
  const [presentationCategory, setPresentationCategory] = useState('all');
  const [lifecycle, setLifecycle] = useState<'all' | ToolLifecycleKey>('all');
  const [location, setLocation] = useState('all');
  const [responsible, setResponsible] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(
    () => !window.matchMedia('(max-width: 820px)').matches,
  );

  const categories = useMemo(() => buildToolCategories(data.tools), [data.tools]);
  const locations = useMemo(
    () => [...new Set(data.tools.map((tool) => tool.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [data.tools],
  );
  const responsibleTechnicians = useMemo(() => data.technicians
    .filter((technician) => data.tools.some((tool) => tool.holderTechnicianId === technician.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'es')),
  [data.technicians, data.tools]);

  const visibleTools = useMemo(() => filterInventoryTools(data.tools, '', category, preset)
    .filter((tool) => presentationCategory === 'all' || resolveToolCategory(tool.category).key === presentationCategory)
    .filter((tool) => lifecycle === 'all' || resolveToolLifecyclePresentation(tool).key === lifecycle)
    .filter((tool) => location === 'all' || tool.location === location)
    .filter((tool) => {
      if (responsible === 'all') return true;
      if (responsible === 'unassigned') return !tool.holderTechnicianId;
      return tool.holderTechnicianId === responsible;
    }), [data.tools, category, preset, presentationCategory, lifecycle, location, responsible]);

  const activeFilterCount = [
    preset !== 'all',
    category !== 'Todas',
    presentationCategory !== 'all',
    lifecycle !== 'all',
    location !== 'all',
    responsible !== 'all',
  ].filter(Boolean).length;

  const visibleIds = useMemo(() => new Set(visibleTools.map((tool) => tool.id)), [visibleTools]);
  const toolByCode = useMemo(() => new Map(data.tools.map((tool) => [tool.code.trim().toUpperCase(), tool])), [data.tools]);

  const applyInventoryCards = useCallback(() => {
    document.querySelectorAll<HTMLElement>('.tool-card').forEach((card) => {
      const code = card.querySelector('.tool-code')?.textContent?.trim().toUpperCase() ?? '';
      const tool = toolByCode.get(code);
      if (!tool) return;

      card.classList.add('tool-card-compact');
      card.dataset.toolCategory = tool.category;
      card.dataset.toolStatus = resolveToolLifecyclePresentation(tool).key;
      card.hidden = !visibleIds.has(tool.id);

      let meta = card.querySelector<HTMLElement>('.tool-operation-times');
      if (!meta) {
        meta = document.createElement('div');
        meta.className = 'tool-operation-times';
        card.querySelector('.tool-details')?.after(meta);
      }
      const times = buildToolMovementTimes(data, tool.id);
      const nextHtml = `
        <span><small>Última salida</small><strong>${formatOperationDateTime(times.checkout?.occurredAt)}</strong></span>
        <span><small>Última entrada</small><strong>${formatOperationDateTime(times.checkin?.occurredAt)}</strong></span>
      `;
      if (meta.innerHTML !== nextHtml) meta.innerHTML = nextHtml;
    });
  }, [data, toolByCode, visibleIds]);

  useEffect(() => {
    let frame = 0;
    const refresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const nextHost = findInventoryHost();
        setHost((current) => current === nextHost ? current : nextHost);
        applyInventoryCards();
        document.querySelectorAll<HTMLElement>('.stat-card').forEach((card) => {
          card.classList.add('stat-card-actionable');
          card.setAttribute('role', 'button');
          card.tabIndex = 0;
        });
      });
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [applyInventoryCards]);

  useEffect(() => {
    applyInventoryCards();
  }, [applyInventoryCards]);

  useEffect(() => {
    const updateData = () => setData(loadAppData());
    const updatePresentationCategory = (event: Event) => {
      setPresentationCategory((event as CustomEvent<string>).detail || 'all');
    };
    window.addEventListener('isivolt:data-updated', updateData);
    window.addEventListener('isivolt:management-refresh', updateData);
    window.addEventListener('isivolt:presentation-category-filter', updatePresentationCategory);
    return () => {
      window.removeEventListener('isivolt:data-updated', updateData);
      window.removeEventListener('isivolt:management-refresh', updateData);
      window.removeEventListener('isivolt:presentation-category-filter', updatePresentationCategory);
    };
  }, []);

  const resetFilters = () => {
    setPreset('all');
    setCategory('Todas');
    setPresentationCategory('all');
    setLifecycle('all');
    setLocation('all');
    setResponsible('all');
    window.dispatchEvent(new CustomEvent('isivolt:set-presentation-category', { detail: 'all' }));
  };

  useEffect(() => {
    const openPreset = (nextPreset: InventoryPreset) => {
      resetFilters();
      setPreset(nextPreset);
      setFiltersOpen(true);
      findNavButton('Inventario')?.click();
    };

    const activateCard = (card: HTMLElement) => {
      const label = card.querySelector('h3')?.textContent?.trim().toLocaleLowerCase('es-ES') ?? '';
      if (label.includes('disponibles')) openPreset('available');
      else if (label.includes('prestadas')) openPreset('loaned');
      else if (label.includes('atención')) openPreset('attention');
      else if (label.includes('técnicos')) findNavButton('Técnicos')?.click();
    };

    const handleClick = (event: MouseEvent) => {
      const card = (event.target as HTMLElement | null)?.closest<HTMLElement>('.stat-card');
      if (card) activateCard(card);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = (event.target as HTMLElement | null)?.closest<HTMLElement>('.stat-card');
      if (!card) return;
      event.preventDefault();
      activateCard(card);
    };
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKey, true);
    };
  }, []);

  if (!host) return null;

  return createPortal(
    <section className={`inventory-operational-filters ${filtersOpen ? 'filters-open' : ''}`} aria-label="Filtros del inventario">
      <button
        className="inventory-filter-heading"
        type="button"
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen((value) => !value)}
      >
        <span><Filter size={18} /><strong>Filtrar herramientas</strong>{activeFilterCount > 0 && <i className="inventory-active-filter-count">{activeFilterCount}</i>}</span>
        <span className="inventory-filter-summary"><b>{visibleTools.length} visibles</b><ChevronDown size={17} /></span>
      </button>

      <div className="inventory-filter-curtain">
        <div className="inventory-preset-grid">
          {presetMeta.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={preset === id ? 'active' : ''} onClick={() => setPreset(id)}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </div>

        <div className="inventory-advanced-grid">
          <label>
            <span>Estado</span>
            <select value={lifecycle} onChange={(event) => setLifecycle(event.target.value as 'all' | ToolLifecycleKey)}>
              {lifecycleOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span>Ubicación</span>
            <select value={location} onChange={(event) => setLocation(event.target.value)}>
              <option value="all">Todas las ubicaciones</option>
              {locations.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Responsable</span>
            <select value={responsible} onChange={(event) => setResponsible(event.target.value)}>
              <option value="all">Todos los responsables</option>
              <option value="unassigned">Sin responsable</option>
              {responsibleTechnicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.name}</option>)}
            </select>
          </label>
        </div>

        <label className="inventory-category-filter">
          <span>Categoría exacta</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        {activeFilterCount > 0 && (
          <button className="inventory-reset-filter" type="button" onClick={resetFilters}>
            <RotateCcw size={16} /> Mostrar todo
          </button>
        )}
      </div>
    </section>,
    host,
  );
}
