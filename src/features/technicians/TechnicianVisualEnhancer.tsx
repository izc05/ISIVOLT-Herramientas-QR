import { useEffect } from 'react';

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('es-ES');

const specialtyTone = (value: string) => {
  let hash = 0;
  const normalized = normalize(value);
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % 8;
};

const enhanceTechnicianCards = () => {
  document.querySelectorAll<HTMLElement>('.technician-card').forEach((card) => {
    const specialty = card.querySelector<HTMLElement>('.specialty-line')?.textContent?.trim() ?? 'Mantenimiento';
    card.dataset.specialtyTone = String(specialtyTone(specialty));
    card.dataset.specialtyName = specialty;
  });

  document.querySelectorAll<HTMLButtonElement>('.specialty-filter button').forEach((button) => {
    const label = button.childNodes[0]?.textContent?.trim() ?? button.textContent?.trim() ?? '';
    if (!label || normalize(label) === 'todas') {
      button.dataset.specialtyTone = 'all';
      return;
    }
    button.dataset.specialtyTone = String(specialtyTone(label));
  });
};

const installFilterCurtain = () => {
  document.querySelectorAll<HTMLElement>('.specialty-filter').forEach((filter) => {
    const section = filter.closest<HTMLElement>('.page-section');
    if (!section || section.querySelector('.technician-filter-curtain-toggle')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'technician-filter-curtain-toggle';
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<span>Filtrar por especialidad</span><b>Mostrar filtros</b>';

    button.addEventListener('click', () => {
      const expanded = filter.classList.toggle('filter-open');
      button.setAttribute('aria-expanded', String(expanded));
      const copy = button.querySelector('b');
      if (copy) copy.textContent = expanded ? 'Ocultar filtros' : 'Mostrar filtros';
    });

    section.insertBefore(button, filter);
  });
};

const enhanceTechnicianView = () => {
  enhanceTechnicianCards();
  installFilterCurtain();
};

export default function TechnicianVisualEnhancer() {
  useEffect(() => {
    enhanceTechnicianView();
    let frame = 0;
    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(enhanceTechnicianView);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
