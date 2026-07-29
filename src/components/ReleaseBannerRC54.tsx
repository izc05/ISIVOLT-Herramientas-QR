import { useEffect } from 'react';

export default function ReleaseBannerRC54() {
  useEffect(() => {
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const title = document.querySelector<HTMLElement>('.web-mode-banner strong');
        const detail = document.querySelector<HTMLElement>('.web-mode-banner span');
        if (title && title.textContent !== 'Modo web RC55') title.textContent = 'Modo web RC55';
        const copy = 'Ventanas claras corregidas · gestión NFC guiada · capas adaptadas';
        if (detail && detail.textContent !== copy) detail.textContent = copy;
      });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
