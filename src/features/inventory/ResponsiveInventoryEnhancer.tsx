import { useEffect } from 'react';
import { loadAppData, saveAppData } from '../../services/storage';
import {
  applyDemoToolImages,
  canUnlockTool,
  listToolCategories,
  resolveTechnicianAccent,
  resolveToolCategory,
  unlockToolData,
} from './inventoryPresentation';

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

    const applyCategoryFilter = () => {
      document.querySelectorAll<HTMLElement>('.tool-card[data-rc34-category]').forEach((card) => {
        card.hidden = activeCategory !== 'all' && card.dataset.rc34Category !== activeCategory;
      });
      document.querySelectorAll<HTMLButtonElement>('.rc34-category-filter button').forEach((button) => {
        button.classList.toggle('active', button.dataset.category === activeCategory);
      });
    };

    const unlock = (toolId: string) => {
      const data = loadAppData();
      const tool = data.tools.find((item) => item.id === toolId);
      if (!tool || !canUnlockTool(tool.status)) return;
      const confirmed = window.confirm(
        `¿Desbloquear ${tool.code} · ${tool.name}?\n\nLa herramienta volverá a Disponible y quedará registrado un movimiento de ajuste.`,
      );
      if (!confirmed) return;

      const result = unlockToolData(data, toolId);
      if (!result.changed) return;
      saveAppData(result.data);
      showToast('Herramienta desbloqueada', `${tool.code} vuelve a estar disponible · ajuste registrado`);
      schedule();
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
      if (filter.dataset.signature === signature) return;
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
        button.addEventListener('click', () => {
          activeCategory = category.key;
          applyCategoryFilter();
        });
        filter?.appendChild(button);
      });
      applyCategoryFilter();
    };

    const decorateToolCards = () => {
      const data = loadAppData();
      document.querySelectorAll<HTMLElement>('.tool-card').forEach((card) => {
        const code = card.querySelector<HTMLElement>('.tool-code')?.textContent?.trim();
        const tool = code ? data.tools.find((item) => item.code === code) : undefined;
        if (!tool) return;

        const category = resolveToolCategory(tool.category);
        card.classList.add('rc34-tool-card');
        card.dataset.rc34Category = category.key;
        card.style.setProperty('--category-accent', category.accent);
        card.style.setProperty('--category-soft', category.soft);

        let media = card.querySelector<HTMLElement>('.rc34-tool-media');
        if (!media) {
          media = document.createElement('div');
          media.className = 'rc34-tool-media';
          const shimmer = card.querySelector('.card-shimmer');
          shimmer ? shimmer.after(media) : card.prepend(media);
        }
        const mediaSignature = `${tool.imageUpdatedAt ?? tool.updatedAt}:${Boolean(tool.imageDataUrl)}:${category.key}`;
        if (media.dataset.signature !== mediaSignature) {
          media.dataset.signature = mediaSignature;
          media.replaceChildren();
          if (tool.imageDataUrl) {
            const image = document.createElement('img');
            image.src = tool.imageDataUrl;
            image.alt = `Foto de ejemplo de ${tool.name}`;
            image.loading = 'lazy';
            media.appendChild(image);
          } else {
            const fallback = document.createElement('span');
            fallback.className = 'rc34-tool-photo-fallback';
            fallback.textContent = tool.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
            media.appendChild(fallback);
          }
          const categoryBadge = document.createElement('span');
          categoryBadge.className = 'rc34-category-pill';
          categoryBadge.textContent = category.label;
          media.appendChild(categoryBadge);
        }

        const actions = card.querySelector<HTMLElement>('.tool-card-actions');
        const existing = actions?.querySelector<HTMLButtonElement>('.rc34-unlock-button');
        if (!canUnlockTool(tool.status)) {
          existing?.remove();
        } else if (actions && !existing) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'rc34-unlock-button';
          button.textContent = 'Desbloquear';
          button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            unlock(tool.id);
          });
          actions.appendChild(button);
        }
      });
      applyCategoryFilter();
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
      const code = sheet.querySelector<HTMLElement>('.tool-sheet-title p')?.textContent?.split('·')[0]?.trim();
      const data = loadAppData();
      const tool = code ? data.tools.find((item) => item.code === code) : undefined;
      if (!tool) return;

      const footer = sheet.querySelector<HTMLElement>('.tool-sheet-footer');
      const existing = footer?.querySelector<HTMLButtonElement>('.rc34-unlock-button');
      if (!canUnlockTool(tool.status)) {
        existing?.remove();
      } else if (footer && !existing) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'rc34-unlock-button';
        button.innerHTML = '<span>Desbloquear</span>';
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          unlock(tool.id);
        });
        footer.insertBefore(button, footer.querySelector('.primary'));
      }

      const history = sheet.querySelector<HTMLElement>('.tool-history-section');
      if (history && !history.querySelector('.rc34-state-log-note')) {
        const note = document.createElement('p');
        note.className = 'rc34-state-log-note';
        note.textContent = 'Cada préstamo, devolución, incidencia y desbloqueo queda registrado como cambio de estado.';
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
