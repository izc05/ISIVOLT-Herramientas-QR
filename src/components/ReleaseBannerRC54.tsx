import { useEffect } from 'react';

const replaceText = (selector: string, value: string) => {
  const node = document.querySelector<HTMLElement>(selector);
  if (node && node.textContent !== value) node.textContent = value;
};

export default function ReleaseBannerRC54() {
  useEffect(() => {
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;

        document.title = 'IsiVoltPro Herramientas';
        replaceText('.web-mode-banner strong', 'Modo web RC57');
        replaceText('.web-mode-banner span', 'Ecosistema IsiVoltPro · espacio limpio · QR/NFC protegido');
        replaceText('.brand-button strong', 'IsiVoltPro');
        replaceText('.boot-screen small', 'IsiVoltPro Herramientas');
        replaceText('.system-level', 'OPERATIVO');

        const brandDetail = document.querySelector<HTMLElement>('.brand-button small');
        if (brandDetail) {
          const view = brandDetail.textContent?.split('·').at(-1)?.trim() || 'Inicio';
          const copy = `Herramientas · QR/NFC · ${view}`;
          if (brandDetail.textContent !== copy) brandDetail.textContent = copy;
        }

        document.querySelectorAll<HTMLElement>('.page-heading p').forEach((paragraph) => {
          if (paragraph.textContent?.includes('12 secciones')) {
            paragraph.textContent = paragraph.textContent.replace('12 secciones', 'categorías configurables');
          }
        });

        document.querySelectorAll<HTMLElement>('.quick-action').forEach((action) => {
          if (!action.querySelector('strong')?.textContent?.includes('Técnicos')) return;
          const detail = action.querySelector<HTMLElement>('small');
          if (detail && detail.textContent !== 'Directorio por categoría') {
            detail.textContent = 'Directorio por categoría';
          }
        });
      });
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    schedule();
    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
