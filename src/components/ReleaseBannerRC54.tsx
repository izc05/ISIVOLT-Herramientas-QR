import { useEffect } from 'react';

export default function ReleaseBannerRC54() {
  useEffect(() => {
    const update = () => {
      const title = document.querySelector<HTMLElement>('.web-mode-banner strong');
      const detail = document.querySelector<HTMLElement>('.web-mode-banner span');
      if (title) title.textContent = 'Modo web RC54';
      if (detail) detail.textContent = 'Escaneo técnico automático · devoluciones con validación administrativa';
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    update();
    return () => observer.disconnect();
  }, []);
  return null;
}
