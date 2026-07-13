import { useEffect, useMemo, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { createPortal } from 'react-dom';
import type { Technician } from '../domain/types';
import TechnicianSelectorPanel from '../features/technicians/TechnicianSelectorPanel';
import { loadAppData } from '../services/storage';

type PickerContext =
  | { mode: 'delivery'; select: HTMLSelectElement }
  | { mode: 'return'; modal: HTMLElement };

const isVisible = (element: HTMLElement) => {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
};

const setNativeSelectValue = (select: HTMLSelectElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

const buildTechnicianTrigger = (
  title: string,
  detail: string,
  className: string,
  onClick: () => void,
) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;

  const icon = document.createElement('span');
  icon.className = 'rc10-technician-trigger-icon';
  icon.textContent = 'T';

  const copy = document.createElement('span');
  copy.className = 'rc10-technician-trigger-copy';
  const strong = document.createElement('strong');
  strong.textContent = title;
  const small = document.createElement('small');
  small.textContent = detail;
  copy.append(strong, small);

  const arrow = document.createElement('span');
  arrow.className = 'rc10-technician-trigger-arrow';
  arrow.textContent = '›';

  button.append(icon, copy, arrow);
  button.addEventListener('click', onClick);
  return { button, strong, small };
};

export default function RC10MobileEnhancer() {
  const [pickerContext, setPickerContext] = useState<PickerContext | null>(null);
  const [exitHint, setExitHint] = useState(false);

  const pickerData = useMemo(() => {
    if (!pickerContext) return null;
    const data = loadAppData();
    const technicians = pickerContext.mode === 'delivery'
      ? data.technicians.filter((technician) => technician.active)
      : data.technicians.filter(
          (technician) => technician.active
            && data.tools.some(
              (tool) => tool.status === 'loaned' && tool.holderTechnicianId === technician.id,
            ),
        );
    return { data, technicians };
  }, [pickerContext]);

  useEffect(() => {
    const applyReturnFilter = (modal: HTMLElement) => {
      const data = loadAppData();
      const technicianId = modal.dataset.rc10ReturnTechnicianId ?? '';
      const selectedTechnician = data.technicians.find((item) => item.id === technicianId);
      const toolsContainer = modal.querySelector<HTMLElement>('.operation-tools');
      if (!toolsContainer) return;

      toolsContainer.querySelectorAll<HTMLButtonElement>('.select-tool').forEach((button) => {
        const raw = button.querySelector('small')?.textContent ?? '';
        const code = raw.split('·')[0]?.trim() ?? '';
        const tool = data.tools.find((item) => item.code === code);
        const matches = !technicianId || tool?.holderTechnicianId === technicianId;
        if (!matches && button.classList.contains('selected')) button.click();
        button.hidden = !matches;
      });

      const trigger = modal.querySelector<HTMLButtonElement>('[data-rc10-return-picker]');
      const title = trigger?.querySelector<HTMLElement>('strong');
      const detail = trigger?.querySelector<HTMLElement>('small');
      if (title) title.textContent = selectedTechnician?.name ?? 'Seleccionar técnico';
      if (detail) {
        detail.textContent = selectedTechnician
          ? `${selectedTechnician.specialty} · mostrar solo sus herramientas`
          : 'Filtrar por categoría, nombre o especialidad';
      }

      const clearButton = modal.querySelector<HTMLButtonElement>('[data-rc10-clear-return-filter]');
      if (clearButton) clearButton.hidden = !selectedTechnician;
    };

    const decorate = () => {
      document.querySelectorAll<HTMLElement>('.core-modal-wide').forEach((modal) => {
        const heading = modal.querySelector('.modal-heading h2')?.textContent?.trim() ?? '';

        if (heading === 'Entregar herramientas') {
          const label = Array.from(modal.querySelectorAll<HTMLLabelElement>('label.field-label'))
            .find((item) => item.textContent?.includes('Técnico responsable'));
          const select = label?.querySelector<HTMLSelectElement>('select');
          if (label && select && select.dataset.rc10Enhanced !== 'true') {
            select.dataset.rc10Enhanced = 'true';
            select.classList.add('rc10-native-technician-select');

            const selectedText = () => select.selectedOptions[0]?.textContent?.trim() ?? 'Seleccionar técnico';
            const { button, strong, small } = buildTechnicianTrigger(
              selectedText(),
              'Toca para buscar por categoría, nombre o especialidad',
              'rc10-technician-trigger',
              () => setPickerContext({ mode: 'delivery', select }),
            );
            button.dataset.rc10DeliveryPicker = 'true';
            select.before(button);

            const update = () => {
              strong.textContent = selectedText();
              small.textContent = 'Toca para cambiar de técnico o categoría';
            };
            select.addEventListener('change', update);
          }
        }

        if (heading === 'Registrar devolución') {
          const toolsContainer = modal.querySelector<HTMLElement>('.operation-tools');
          if (toolsContainer && !modal.querySelector('[data-rc10-return-filter-wrap]')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'rc10-return-filter-wrap';
            wrapper.dataset.rc10ReturnFilterWrap = 'true';

            const { button } = buildTechnicianTrigger(
              'Seleccionar técnico',
              'Filtrar por categoría, nombre o especialidad',
              'rc10-technician-trigger rc10-return-trigger',
              () => setPickerContext({ mode: 'return', modal }),
            );
            button.dataset.rc10ReturnPicker = 'true';

            const clear = document.createElement('button');
            clear.type = 'button';
            clear.className = 'rc10-clear-return-filter';
            clear.dataset.rc10ClearReturnFilter = 'true';
            clear.textContent = 'Ver todos';
            clear.hidden = true;
            clear.addEventListener('click', () => {
              delete modal.dataset.rc10ReturnTechnicianId;
              applyReturnFilter(modal);
            });

            wrapper.append(button, clear);
            toolsContainer.before(wrapper);
          }
          applyReturnFilter(modal);
        }
      });
    };

    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
    decorate();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    let listener: { remove: () => Promise<void> } | undefined;
    let lastBackPressedAt = 0;
    let hintTimer = 0;

    const closeVisibleLayer = () => {
      const selectors = [
        '.technician-selector-panel > header > button',
        '.tool-selector-panel > header > button',
        '.native-tool-alert-backdrop button',
        '.native-scan-backdrop .native-scan-close',
        '.tool-photo-backdrop .tool-photo-close',
        '.technician-detail-backdrop .technician-detail-close',
        '.modal-backdrop .modal-close',
        '[role="dialog"] [aria-label="Cerrar"]',
      ];

      for (const selector of selectors) {
        const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector)).reverse();
        const candidate = candidates.find(isVisible);
        if (candidate) {
          candidate.click();
          return true;
        }
      }
      return false;
    };

    void CapacitorApp.addListener('backButton', () => {
      if (pickerContext) {
        setPickerContext(null);
        return;
      }

      if (closeVisibleLayer()) return;

      const nav = document.querySelector<HTMLElement>('.core-bottom-nav');
      const buttons = nav ? Array.from(nav.querySelectorAll<HTMLButtonElement>('button')) : [];
      const home = buttons.find((button) => button.textContent?.includes('Inicio'));
      const activeButton = buttons.find((button) => button.classList.contains('active') || button.classList.contains('nav-active'));
      if (home && activeButton && activeButton !== home) {
        home.click();
        return;
      }

      const now = Date.now();
      if (now - lastBackPressedAt < 1800) {
        void CapacitorApp.exitApp();
        return;
      }

      lastBackPressedAt = now;
      setExitHint(true);
      window.clearTimeout(hintTimer);
      hintTimer = window.setTimeout(() => setExitHint(false), 1700);
    }).then((handle) => {
      if (!active) void handle.remove();
      else listener = handle;
    }).catch(() => {
      // En navegador el plugin puede no estar disponible; la aplicación sigue funcionando.
    });

    return () => {
      active = false;
      window.clearTimeout(hintTimer);
      if (listener) void listener.remove();
    };
  }, [pickerContext]);

  const selectTechnician = (technicianId: string) => {
    if (!pickerContext) return;

    if (pickerContext.mode === 'delivery') {
      setNativeSelectValue(pickerContext.select, technicianId);
    } else {
      pickerContext.modal.dataset.rc10ReturnTechnicianId = technicianId;
      const data = loadAppData();
      const selectedTechnician = data.technicians.find((item) => item.id === technicianId);
      const toolsContainer = pickerContext.modal.querySelector<HTMLElement>('.operation-tools');
      toolsContainer?.querySelectorAll<HTMLButtonElement>('.select-tool').forEach((button) => {
        const raw = button.querySelector('small')?.textContent ?? '';
        const code = raw.split('·')[0]?.trim() ?? '';
        const tool = data.tools.find((item) => item.code === code);
        const matches = tool?.holderTechnicianId === technicianId;
        if (!matches && button.classList.contains('selected')) button.click();
        button.hidden = !matches;
      });

      const trigger = pickerContext.modal.querySelector<HTMLButtonElement>('[data-rc10-return-picker]');
      const strong = trigger?.querySelector<HTMLElement>('strong');
      const small = trigger?.querySelector<HTMLElement>('small');
      if (strong) strong.textContent = selectedTechnician?.name ?? 'Seleccionar técnico';
      if (small) small.textContent = selectedTechnician ? selectedTechnician.specialty : 'Filtrar por categoría';
      const clear = pickerContext.modal.querySelector<HTMLButtonElement>('[data-rc10-clear-return-filter]');
      if (clear) clear.hidden = false;
    }

    setPickerContext(null);
  };

  const pickerTechnicians: Technician[] = pickerData?.technicians ?? [];

  return (
    <>
      {pickerContext && pickerData && createPortal(
        <div className="rc10-technician-picker-backdrop" onClick={() => setPickerContext(null)}>
          <section className="rc10-technician-picker-modal" onClick={(event) => event.stopPropagation()}>
            <TechnicianSelectorPanel
              technicians={pickerTechnicians}
              tools={pickerData.data.tools}
              onSelect={selectTechnician}
              onBack={() => setPickerContext(null)}
            />
          </section>
        </div>,
        document.body,
      )}

      {exitHint && createPortal(
        <div className="rc10-exit-hint" role="status">Pulsa atrás otra vez para salir</div>,
        document.body,
      )}
    </>
  );
}
