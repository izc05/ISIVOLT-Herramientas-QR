import { useEffect } from 'react';
import { DEMO_TOOL_IMAGES } from '../../data/demoToolImages';
import { loadAppData } from '../../services/storage';

const normalize = (value: string) => value.trim().toLocaleUpperCase('es-ES');

const toolFromCode = (code: string) => loadAppData().tools.find((tool) => normalize(tool.code) === normalize(code));

const readCode = (root: ParentNode, selector: string) => root.querySelector<HTMLElement>(selector)
  ?.textContent
  ?.split('·')[0]
  ?.trim() ?? '';

const ensureBadge = (container: HTMLElement, text: string) => {
  let badge = container.querySelector<HTMLElement>('.rc51-photo-quality-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'rc51-photo-quality-badge';
    container.appendChild(badge);
  }
  badge.textContent = text;
};

const decoratePhotoEditor = () => {
  document.querySelectorAll<HTMLElement>('.tool-photo-modal').forEach((modal) => {
    const code = readCode(modal, 'header p');
    const tool = toolFromCode(code);
    const preview = modal.querySelector<HTMLElement>('.tool-photo-preview');
    if (!tool || !preview) return;
    const isDemo = Boolean(tool.imageDataUrl && DEMO_TOOL_IMAGES[tool.code] === tool.imageDataUrl);
    preview.classList.toggle('rc51-demo-photo', isDemo);
    preview.classList.toggle('rc51-real-photo', Boolean(tool.imageDataUrl && !isDemo));
    if (isDemo) ensureBadge(preview, 'Imagen de demostración · sustitúyela por una foto real');
    else preview.querySelector('.rc51-photo-quality-badge')?.remove();
  });
};

const decorateToolSheet = () => {
  document.querySelectorAll<HTMLElement>('.tool-qr-modal').forEach((sheet) => {
    const code = readCode(sheet, '.tool-sheet-title p');
    const tool = toolFromCode(code);
    const media = sheet.querySelector<HTMLElement>('.tool-sheet-image');
    if (!tool || !media) return;
    const isDemo = Boolean(tool.imageDataUrl && DEMO_TOOL_IMAGES[tool.code] === tool.imageDataUrl);
    media.classList.toggle('rc51-demo-photo', isDemo);
    media.classList.toggle('rc51-real-photo', Boolean(tool.imageDataUrl && !isDemo));
    let note = media.querySelector<HTMLElement>('.rc51-tool-demo-note');
    if (isDemo) {
      if (!note) {
        note = document.createElement('span');
        note.className = 'rc51-tool-demo-note';
        media.appendChild(note);
      }
      note.textContent = 'Imagen demo · añade una fotografía real del activo';
    } else {
      note?.remove();
    }
  });
};

const decoratePhotos = () => {
  decoratePhotoEditor();
  decorateToolSheet();
};

export default function ToolPhotoQualityBridge() {
  useEffect(() => {
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        decoratePhotos();
      });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('isivolt:data-updated', schedule);
    window.addEventListener('isivolt:app-refresh', schedule);
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener('isivolt:data-updated', schedule);
      window.removeEventListener('isivolt:app-refresh', schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
