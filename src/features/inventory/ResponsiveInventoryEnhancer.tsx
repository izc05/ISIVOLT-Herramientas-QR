import { useEffect } from 'react';
import { assertPermission } from '../../security/permissions';
import { getCurrentOperatorName } from '../../security/session';
import { loadAppData, saveAppData } from '../../services/storage';
import {
  applyDemoToolImages,
  listToolCategories,
  resolveTechnicianAccent,
  resolveToolCategory,
} from './inventoryPresentation';
import {
  applyToolLifecycleAction,
  resolveToolLifecyclePresentation,
} from './toolLifecycle';

const normalize = (value: string) => value.trim().toLocaleLowerCase('es-ES');

const showToast = (title: string, detail: string) => {
  document.querySelector('.rc34-action-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'rc34-action-toast';
  toast.innerHTML = `<strong>${title}</strong><span>${detail}</span>`;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.classList.add('visible'), 10);
  window.setTimeout(() => {
    toast.classList.remove('visible');
    window.setTimeout(() => toast.remove(), 220);
  }, 2800);
};

export default function ResponsiveInventoryEnhancer() {
  useEffect(() => {
    let disposed = false;
    let frame: number | null = null;
    let activeCategory = 'all';

    const schedule = () => {
      if (disposed || frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        enhance();
      });
    };

    const syncCategoryButtons = () => {
      document.querySelectorAll<HTMLButtonElement>('.rc34-category-filter button').forEach((button) => {
        button.classList.toggle('active', button.dataset.category === activeCategory);
      });
    };

    const selectCategory = (key: string) => {
      activeCategory = key;
      syncCategoryButtons();
      window.dispatchEvent(new CustomEvent('isivolt:presentation-category-filter', { detail: key }));
    };

    const reactivate = (toolId: string) => {
      const data = loadAppData();
      const tool = data.tools.find((item) => item.id === toolId);
      if (!tool) return;
      const lifecycle = resolveToolLifecyclePresentation(tool);
      if (!['review', 'damaged', 'blocked'].includes(lifecycle.key)) return;

      const reason = window.prompt(
        `Motivo para reactivar ${tool.code} · ${tool.name}:`,
        'Comprobación completada y herramienta apta para el servicio.',
      );
      if (!reason?.trim()) return;

      try {
        assertPermission('inventory.manage');
        const result = applyToolLifecycleAction(
          data,
          toolId,
          'reactivate',
          reason,
          getCurrentOperatorName(),
        );
        saveAppData(result.data);
        showToast('Herramienta reactivada', `${tool.code} vuelve a estar disponible · cambio registrado`);
        schedule();
      } catch (error) {
        showToast('No se pudo reactivar', error instanceof Error ? error.message : 'Revisa tus permisos y vuelve a intentarlo.');
      }
    };

    const ensureCategoryFilter = () => {
      const grid = document.querySelector<HTMLElement>('.tool-grid');
      if (!grid) return;
      const data = loadAppData();
      const categories = listToolCategories(data);
      const signature = categories.map((item) => `${item.key}:${item.count}`).join('|');
      let filter = grid.parentElement?.querySelector<HTMLElement>(':scope > .rc34-category-filter');
      if (!filter) {
        filter = document.createElement('div');
        filter.className = 'rc34-category-filter';
        filter.setAttribute('role', 'tablist');
        filter.setAttribute('aria-label', 'Clasificar herramientas por categoría');
        grid.before(filter);
      }
      if (filter.dataset.signature === signature) {
        syncCategoryButtons();
        return;
      }
      filter.dataset.signature = signature;
      filter.replaceChildren();

      const options = [
        { key: 'all', label: 'Todas', count: data.tools.length, accent: '#35c6ff', soft: 'rgba(53,198,255,.14)' },
        ...categories,
      ];
      options.forEach((category) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.category = category.key;
        button.style.setProperty('--category-accent', category.accent);
        button.style.setProperty('--category-soft', category.soft);
        button.innerHTML = `<span>${category.label}</span><b>${category.count}</b>`;
        button.addEventListener('click', () => selectCategory(category.key));
        filter?.appendChild(button);
      });
      syncCategoryButtons();
    };

    const decorateToolCards = () => {
      const data = loadAppData();
      document.querySelectorAll<HTMLElement>('.tool-card').forEach((card) => {
        const code = card.querySelector<HTMLElement>('.tool-code')?.textContent?.trim();
        const tool = code ? data.tools.find((item) => item.code === code) : undefined;
        if (!tool) return;

        const category = resolveToolCategory(tool.category);
        const lifecycle = resolveToolLifecyclePresentation(tool);
        card.classList.add('rc34-tool-card');
        card.dataset.rc34Category = category.key;
        card.dataset.toolLifecycle = lifecycle.key;
        card.style.setProperty('--category-accent', category.accent);
        card.style.setProperty('--category-soft', category.soft);

        card.querySelectorAll<HTMLElement>('.rc34-tool-media:not(.tool-media-trigger)').forEach((duplicate) => duplicate.remove());
        const media = card.querySelector<HTMLButtonElement>('.tool-media-trigger');
        if (media) {
          media.classList.add('rc34-tool-media');
          media.style.setProperty('--category-accent', category.accent);
          media.style.setProperty('--category-soft', category.soft);
          let categoryBadge = media.querySelector<HTMLElement>('.rc34-category-pill');
          if (!categoryBadge) {
            categoryBadge = document.createElement('span');
            categoryBadge.className = 'rc34-category-pill';
            media.appendChild(categoryBadge);
          }
          categoryBadge.textContent = category.label;
        }

        const statusBadge = card.querySelector<HTMLElement>('.status-badge');
        if (statusBadge) {
          statusBadge.classList.remove('status-available', 'status-loaned', 'status-review', 'status-damaged', 'status-retired', 'status-blocked');
          statusBadge.classList.add(`status-${lifecycle.key}`);
          statusBadge.textContent = lifecycle.label;
        }

        const actions = card.querySelector<HTMLElement>('.tool-card-actions');
        const existing = actions?.querySelector<HTMLButtonElement>('.rc34-unlock-button');
        const canReactivate = ['review', 'damaged', 'blocked'].includes(lifecycle.key);
        if (!canReactivate) {
          existing?.remove();
        } else if (actions && !existing) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'rc34-unlock-button';
          button.textContent = 'Reactivar';
          button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            reactivate(tool.id);
          });
          actions.appendChild(button);
        }
      });
    };

    const decorateTechnicianCards = () => {
      const data = loadAppData();
      document.querySelectorAll<HTMLElement>('.technician-card').forEach((card) => {
        const name = card.querySelector('h3')?.textContent?.trim();
        const technician = name
          ? data.technicians.find((item) => normalize(item.name) === normalize(name))
          : undefined;
        if (!technician) return;
        const accent = resolveTechnicianAccent(technician.specialty);
        card.classList.add('rc34-technician-card');
        card.style.setProperty('--specialty-accent', accent);
        const specialty = card.querySelector<HTMLElement>('.specialty-line');
        if (specialty && !specialty.querySelector('.rc34-specialty-dot')) {
          const dot = document.createElement('i');
          dot.className = 'rc34-specialty-dot';
          specialty.prepend(dot);
        }
      });
    };

    const decorateToolSheet = () => {
      const sheet = document.querySelector<HTMLElement>('.tool-sheet');
      if (!sheet) return;
      const history = sheet.querySelector<HTMLElement>('.tool-history-section');
      if (history && !history.querySelector('.rc34-state-log-note')) {
        const note = document.createElement('p');
        note.className = 'rc34-state-log-note';
        note.textContent = 'Cada préstamo, devolución, incidencia, bloqueo y reactivación queda registrado como cambio de estado.';
        history.querySelector('header')?.after(note);
      }
    };

    const enhance = () => {
      ensureCategoryFilter();
      decorateToolCards();
      decorateTechnicianCards();
      decorateToolSheet();
    };

    const initial = applyDemoToolImages(loadAppData());
    if (initial.changed) saveAppData(initial.data);

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('isivolt:data-updated', schedule);
    window.addEventListener('isivolt:management-refresh', schedule);
    schedule();

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener('isivolt:data-updated', schedule);
      window.removeEventListener('isivolt:management-refresh', schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
      document.querySelector('.rc34-category-filter')?.remove();
    };
  }, []);

  return null;
}
