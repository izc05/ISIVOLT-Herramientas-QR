import { useEffect } from 'react';
import { DEMO_TOOL_IMAGES } from '../../data/demoToolImages';
import type { Tool } from '../../domain/types';
import { loadAppData } from '../../services/storage';

const normalize = (value: string) => value.trim().toLocaleUpperCase('es-ES');

const toolFromCode = (code: string) => loadAppData().tools.find((tool) => normalize(tool.code) === normalize(code));

const readCode = (root: ParentNode, selector: string) => root.querySelector<HTMLElement>(selector)
  ?.textContent
  ?.split('·')[0]
  ?.trim() ?? '';

const isDemoPhoto = (tool: Tool) => Boolean(
  tool.imageDataUrl
  && DEMO_TOOL_IMAGES[tool.code]
  && (DEMO_TOOL_IMAGES[tool.code] === tool.imageDataUrl || !tool.imageUpdatedAt),
);

const ensureBadge = (container: HTMLElement, text: string) => {
  let badge = container.querySelector<HTMLElement>('.rc51-photo-quality-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'rc51-photo-quality-badge';
    container.appendChild(badge);
  }
  badge.textContent = text;
};

const ensureDemoPlaceholder = (container: HTMLElement) => {
  let placeholder = container.querySelector<HTMLElement>('.rc52-demo-photo-placeholder');
  if (!placeholder) {
    placeholder = document.createElement('div');
    placeholder.className = 'rc52-demo-photo-placeholder';
    const title = document.createElement('strong');
    title.textContent = 'Sin fotografía real';
    const detail = document.createElement('small');
    detail.textContent = 'La imagen inicial era solo una demostración. Pulsa Cambiar foto para identificar correctamente este activo.';
    placeholder.append(title, detail);
    container.appendChild(placeholder);
  }
};

const clearDemoPlaceholder = (container: HTMLElement) => {
  container.querySelector('.rc52-demo-photo-placeholder')?.remove();
};

const decorateToolCards = () => {
  const data = loadAppData();
  document.querySelectorAll<HTMLElement>('.tool-card').forEach((card) => {
    const code = card.querySelector<HTMLElement>('.tool-code')?.textContent?.trim() ?? '';
    const tool = data.tools.find((item) => normalize(item.code) === normalize(code));
    const media = card.querySelector<HTMLElement>('.tool-media-trigger');
    if (!tool || !media) return;
    media.classList.toggle('rc52-demo-photo', isDemoPhoto(tool));
  });
};

const decoratePhotoEditor = () => {
  document.querySelectorAll<HTMLElement>('.tool-photo-modal').forEach((modal) => {
    const code = readCode(modal, 'header p');
    const tool = toolFromCode(code);
    const preview = modal.querySelector<HTMLElement>('.tool-photo-preview');
    if (!tool || !preview) return;
    const demo = isDemoPhoto(tool);
    preview.classList.toggle('rc51-demo-photo', demo);
    preview.classList.toggle('rc52-demo-photo', demo);
    preview.classList.toggle('rc51-real-photo', Boolean(tool.imageDataUrl && !demo));
    if (demo) {
      ensureBadge(preview, 'Imagen de demostración · sustitúyela por una foto real');
      ensureDemoPlaceholder(preview);
    } else {
      preview.querySelector('.rc51-photo-quality-badge')?.remove();
      clearDemoPlaceholder(preview);
    }
  });
};

const decorateToolSheet = () => {
  document.querySelectorAll<HTMLElement>('.tool-qr-modal').forEach((sheet) => {
    const code = readCode(sheet, '.tool-sheet-title p');
    const tool = toolFromCode(code);
    const media = sheet.querySelector<HTMLElement>('.tool-sheet-image');
    if (!tool || !media) return;
    const demo = isDemoPhoto(tool);
    media.classList.toggle('rc51-demo-photo', demo);
    media.classList.toggle('rc52-demo-photo', demo);
    media.classList.toggle('rc51-real-photo', Boolean(tool.imageDataUrl && !demo));
    let note = media.querySelector<HTMLElement>('.rc51-tool-demo-note');
    if (demo) {
      ensureDemoPlaceholder(media);
      if (!note) {
        note = document.createElement('span');
        note.className = 'rc51-tool-demo-note';
        media.appendChild(note);
      }
      note.textContent = 'Imagen demo · añade una fotografía real del activo';
    } else {
      note?.remove();
      clearDemoPlaceholder(media);
    }
  });
};

const decoratePhotos = () => {
  decorateToolCards();
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
