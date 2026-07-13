import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Boxes, CheckCircle2, Filter, RotateCcw, Users } from 'lucide-react';
import type { AppData } from '../../domain/types';
import { loadAppData } from '../../services/storage';
import {
  buildToolCategories,
  buildToolMovementTimes,
  filterInventoryTools,
  formatOperationDateTime,
  type InventoryPreset,
} from './inventoryOperations';

const presetMeta: Array<{ id: InventoryPreset; label: string; icon: typeof Boxes }> = [
  { id: 'all', label: 'Todas', icon: Boxes },
  { id: 'available', label: 'Disponibles', icon: CheckCircle2 },
  { id: 'loaned', label: 'Prestadas', icon: Users },
  { id: 'attention', label: 'Atención', icon: AlertTriangle },
];

const findNavButton = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('.bottom-nav button')]
  .find((button) => button.textContent?.toLocaleLowerCase('es-ES').includes(label.toLocaleLowerCase('es-ES')));

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

  const categories = useMemo(() => buildToolCategories(data.tools), [data.tools]);
  const visibleTools = useMemo(
    () => filterInventoryTools(data.tools, '', category, preset),
    [data.tools, category, preset],
  );
  const visibleIds = useMemo(() => new Set(visibleTools.map((tool) => tool.id)), [visibleTools]);
  const toolByCode = useMemo(() => new Map(data.tools.map((tool) => [tool.code.trim().toUpperCase(), tool])), [data.tools]);

  const applyInventoryCards = useCallback(() => {
    document.querySelectorAll<HTMLElement>('.tool-card').forEach((card) => {
      const code = card.querySelector('.tool-code')?.textContent?.trim().toUpperCase() ?? '';
      const tool = toolByCode.get(code);
      if (!tool) return;

      card.classList.add('tool-card-compact');
      card.dataset.toolCategory = tool.category;
      card.dataset.toolStatus = tool.status;
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
    window.addEventListener('isivolt:data-updated', updateData);
    window.addEventListener('isivolt:management-refresh', updateData);
    return () => {
      window.removeEventListener('isivolt:data-updated', updateData);
      window.removeEventListener('isivolt:management-refresh', updateData);
    };
  }, []);

  useEffect(() => {
    const openPreset = (nextPreset: InventoryPreset) => {
      setPreset(nextPreset);
      setCategory('Todas');
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
    <section className="inventory-operational-filters" aria-label="Filtros del inventario">
      <div className="inventory-filter-heading">
        <span><Filter size={18} /><strong>Filtrar herramientas</strong></span>
        <b>{visibleTools.length} visibles</b>
      </div>
      <div className="inventory-preset-grid">
        {presetMeta.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={preset === id ? 'active' : ''} onClick={() => setPreset(id)}>
            <Icon size={17} /> {label}
          </button>
        ))}
      </div>
      <label className="inventory-category-filter">
        <span>Categoría</span>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      {(preset !== 'all' || category !== 'Todas') && (
        <button className="inventory-reset-filter" type="button" onClick={() => { setPreset('all'); setCategory('Todas'); }}>
          <RotateCcw size={16} /> Mostrar todo
        </button>
      )}
    </section>,
    host,
  );
}
