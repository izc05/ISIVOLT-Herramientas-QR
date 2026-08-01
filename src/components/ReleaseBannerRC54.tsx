import { useEffect } from 'react';

const replaceText = (selector: string, value: string) => {
  const node = document.querySelector<HTMLElement>(selector);
  if (node && node.textContent !== value) node.textContent = value;
};

const replaceExactText = (selector: string, currentValue: string, nextValue: string) => {
  document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
    if (node.textContent?.trim() === currentValue) node.textContent = nextValue;
  });
};

export default function ReleaseBannerRC54() {
  useEffect(() => {
    document.body.classList.add('isivoltpro-ecosystem');

    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;

        document.title = 'IsiVoltPro Herramientas';
        replaceText('.web-mode-banner strong', 'Modo web RC57');
        replaceText('.web-mode-banner span', 'Ecosistema IsiVoltPro · Herramientas · QR/NFC');
        replaceText('.brand-button strong', 'IsiVoltPro');
        replaceText('.boot-screen small', 'IsiVoltPro Herramientas');
        replaceText('.system-level', 'QR/NFC ACTIVO');
        replaceText('.command-hero .eyebrow', 'Ecosistema IsiVoltPro · Herramientas');
        replaceText('.command-hero h1', 'Gestión de herramientas');

        const brandDetail = document.querySelector<HTMLElement>('.brand-button small');
        if (brandDetail) {
          const view = brandDetail.textContent?.split('·').at(-1)?.trim() || 'Inicio';
          const copy = `Herramientas · QR/NFC · ${view}`;
          if (brandDetail.textContent !== copy) brandDetail.textContent = copy;
        }

        document.querySelectorAll<HTMLElement>('.page-heading p').forEach((paragraph) => {
          if (paragraph.textContent?.includes('12 secciones')) {
            paragraph.textContent = paragraph.textContent.replace('12 secciones', 'categorías técnicas');
          }
        });

        document.querySelectorAll<HTMLElement>('.quick-action').forEach((action) => {
          if (!action.querySelector('strong')?.textContent?.includes('Técnicos')) return;
          const detail = action.querySelector<HTMLElement>('small');
          if (detail && detail.textContent !== 'Directorio por categoría') {
            detail.textContent = 'Directorio por categoría';
          }
        });

        document.querySelectorAll<HTMLElement>('.stat-card p').forEach((paragraph) => {
          if (paragraph.textContent?.trim() === 'Directorio hospitalario') {
            paragraph.textContent = 'Directorio técnico';
          }
        });

        document.querySelectorAll<HTMLElement>('.mini-trend').forEach((badge) => {
          if (badge.textContent !== 'ACTUAL') badge.textContent = 'ACTUAL';
        });

        document.querySelectorAll<HTMLElement>('.hud-tag').forEach((badge) => {
          if (badge.textContent?.trim() === 'CONTROL') badge.textContent = 'OPERACIONES';
        });

        replaceExactText('.modal-heading .eyebrow', 'Escáner táctico', 'Operación de almacén');
        replaceExactText('.modal-heading h2', 'Identificación QR', 'Identificación QR/NFC');

        document.querySelectorAll<HTMLElement>('.modal-heading p').forEach((paragraph) => {
          if (paragraph.textContent?.includes('Esta demo activa')) {
            paragraph.textContent = 'Escanea una etiqueta para iniciar una entrega o devolución con el mismo flujo protegido.';
          }
        });
      });
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    schedule();
    return () => {
      document.body.classList.remove('isivoltpro-ecosystem');
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
