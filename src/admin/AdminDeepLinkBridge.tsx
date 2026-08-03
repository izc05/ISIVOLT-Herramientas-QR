import { useEffect } from 'react';
import { loadData, WORKSPACE_DATA_EVENT } from '../storage';

export const ADMIN_OPEN_ENTITY_EVENT = 'isivoltpro:open-entity-admin';

type EntityMode = 'tool' | 'technician';
type OpenEntityDetail = { mode: EntityMode; entityId: string };

const waitFor = <T extends Element>(selector: string, timeout = 2400): Promise<T | null> => new Promise((resolve) => {
  const immediate = document.querySelector<T>(selector);
  if (immediate) {
    resolve(immediate);
    return;
  }

  const started = Date.now();
  const timer = window.setInterval(() => {
    const current = document.querySelector<T>(selector);
    if (current || Date.now() - started >= timeout) {
      window.clearInterval(timer);
      resolve(current);
    }
  }, 45);
});

const pause = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const buttonByText = (selector: string, text: string) => [...document.querySelectorAll<HTMLButtonElement>(selector)]
  .find((button) => button.textContent?.trim().toLocaleLowerCase('es-ES').includes(text.toLocaleLowerCase('es-ES')));

async function openEntity(mode: EntityMode, entityId: string) {
  if (document.body.dataset.accessRole === 'technician') return;

  document.querySelector<HTMLButtonElement>('.admin-tools-launcher')?.click();
  const panel = await waitFor<HTMLElement>('.admin-tools-panel');
  if (!panel) return;

  buttonByText('.admin-tools-panel nav button', 'Fichas')?.click();
  const details = await waitFor<HTMLElement>('.entity-details-admin');
  if (!details) return;

  const modeLabel = mode === 'tool' ? 'Herramientas' : 'Técnicos';
  buttonByText('.entity-mode-switch button', modeLabel)?.click();
  await pause(90);
  const select = await waitFor<HTMLSelectElement>('.entity-selector-card select');
  if (!select) return;

  select.value = entityId;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  window.setTimeout(() => document.querySelector('.entity-details-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 140);
}

function prepareCards() {
  const managerAllowed = document.body.dataset.accessRole !== 'technician';
  document.querySelectorAll<HTMLElement>('.status-tool-card, .status-technician-card').forEach((card) => {
    if (!managerAllowed) {
      card.removeAttribute('data-editable-card');
      card.removeAttribute('role');
      card.removeAttribute('tabindex');
      card.removeAttribute('aria-label');
      return;
    }
    card.dataset.editableCard = 'true';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    const name = card.querySelector('strong')?.textContent?.trim() ?? 'ficha';
    card.setAttribute('aria-label', `Editar ficha de ${name}`);
  });
}

export default function AdminDeepLinkBridge() {
  useEffect(() => {
    let panelWasOpen = Boolean(document.querySelector('.admin-tools-panel'));

    const observer = new MutationObserver(() => {
      prepareCards();
      const panelIsOpen = Boolean(document.querySelector('.admin-tools-panel'));
      if (panelWasOpen && !panelIsOpen) {
        const latest = loadData();
        window.dispatchEvent(new CustomEvent(WORKSPACE_DATA_EVENT, { detail: latest }));
      }
      panelWasOpen = panelIsOpen;
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-access-role'] });
    prepareCards();

    const resolveCard = (target: EventTarget | null) => target instanceof Element
      ? target.closest<HTMLElement>('.status-tool-card, .status-technician-card')
      : null;

    const activate = (card: HTMLElement) => {
      if (document.body.dataset.accessRole === 'technician') return;
      const data = loadData();
      if (card.classList.contains('status-tool-card')) {
        const code = card.querySelector('.status-card-title small')?.textContent?.trim();
        const tool = data.tools.find((entry) => entry.code === code);
        if (tool) void openEntity('tool', tool.id);
        return;
      }
      const code = card.querySelector('small')?.textContent?.trim();
      const technician = data.technicians.find((entry) => entry.code === code);
      if (technician) void openEntity('technician', technician.id);
    };

    const handleClick = (event: MouseEvent) => {
      const card = resolveCard(event.target);
      if (!card || !card.dataset.editableCard) return;
      activate(card);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = resolveCard(event.target);
      if (!card || !card.dataset.editableCard) return;
      event.preventDefault();
      activate(card);
    };

    const handleOpenRequest = (event: Event) => {
      const detail = (event as CustomEvent<OpenEntityDetail>).detail;
      if (!detail?.entityId || !detail.mode) return;
      void openEntity(detail.mode, detail.entityId);
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener(ADMIN_OPEN_ENTITY_EVENT, handleOpenRequest);
    return () => {
      observer.disconnect();
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener(ADMIN_OPEN_ENTITY_EVENT, handleOpenRequest);
    };
  }, []);

  return null;
}
