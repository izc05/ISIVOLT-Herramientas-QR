import { useEffect } from 'react';
import type { Tool } from '../../domain/types';
import { DEMO_TOOL_IMAGES } from '../../data/demoToolImages';
import { loadAppData } from '../../services/storage';

const normalize = (value: string) => value.trim().toLocaleUpperCase('es-ES');

const uniqueSources = (values: Array<string | undefined>) => {
  const seen = new Set<string>();
  return values
    .map((value) => value?.trim() ?? '')
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
};

const getImageCandidates = (tool: Tool) => {
  const demoImage = DEMO_TOOL_IMAGES[tool.code];
  const imageIsDemo = Boolean(demoImage && tool.imageDataUrl === demoImage);

  return imageIsDemo
    ? uniqueSources([tool.thumbnailUri, tool.photoUri, tool.imageDataUrl])
    : uniqueSources([tool.imageDataUrl, tool.thumbnailUri, tool.photoUri]);
};

const sourceSignature = (sources: string[]) => sources
  .map((source) => `${source.length}:${source.slice(0, 48)}`)
  .join('|');

const createPlaceholder = (tool: Tool) => {
  const placeholder = document.createElement('span');
  placeholder.className = 'tool-media-placeholder';
  placeholder.textContent = tool.category.slice(0, 2).toLocaleUpperCase('es-ES');
  return placeholder;
};

const showPlaceholder = (media: HTMLButtonElement, tool: Tool) => {
  media.querySelector(':scope > img')?.remove();
  if (!media.querySelector(':scope > .tool-media-placeholder')) {
    media.prepend(createPlaceholder(tool));
  }
};

const syncImage = (media: HTMLButtonElement, tool: Tool) => {
  const sources = getImageCandidates(tool);
  const signature = sourceSignature(sources);
  let image = media.querySelector<HTMLImageElement>(':scope > img');

  if (sources.length === 0) {
    showPlaceholder(media, tool);
    media.dataset.rc45ImageSignature = '';
    return false;
  }

  media.querySelector(':scope > .tool-media-placeholder')?.remove();
  if (!image) {
    image = document.createElement('img');
    image.alt = `Imagen de ${tool.name}`;
    media.prepend(image);
  }

  if (media.dataset.rc45ImageSignature !== signature) {
    media.dataset.rc45ImageSignature = signature;
    let sourceIndex = 0;
    image.onerror = () => {
      sourceIndex += 1;
      if (sourceIndex < sources.length) {
        image!.src = sources[sourceIndex];
        return;
      }
      showPlaceholder(media, tool);
    };
    image.src = sources[0];
  }

  return true;
};

const ensureBadge = (media: HTMLButtonElement, hasImage: boolean) => {
  let badge = media.querySelector<HTMLElement>('.tool-media-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'tool-media-badge';
    media.appendChild(badge);
  }
  badge.textContent = hasImage ? 'Cambiar' : '+ Foto';
};

const ensureCardMedia = (card: HTMLElement, tool: Tool) => {
  let media = card.querySelector<HTMLButtonElement>('.tool-media-trigger');
  if (!media) {
    media = document.createElement('button');
    media.type = 'button';
    media.className = 'tool-media-trigger rc34-tool-media';
    card.prepend(media);
  }

  media.classList.add('rc34-tool-media');
  media.dataset.toolPhotoAction = 'open';
  media.dataset.toolCode = tool.code;
  media.setAttribute('aria-label', `Gestionar imagen de ${tool.name}`);

  const hasImage = syncImage(media, tool);
  ensureBadge(media, hasImage);
  card.classList.add('rc45-photo-ready');
};

const refreshInventoryPhotos = () => {
  const data = loadAppData();
  const byCode = new Map(data.tools.map((tool) => [normalize(tool.code), tool]));

  document.querySelectorAll<HTMLElement>('.tool-card, .inventory-card').forEach((card) => {
    const code = card.querySelector<HTMLElement>('.tool-code')?.textContent ?? card.dataset.toolCode ?? '';
    const tool = byCode.get(normalize(code));
    if (tool) ensureCardMedia(card, tool);
  });
};

export default function InventoryPhotoBridge() {
  useEffect(() => {
    let disposed = false;
    let frame: number | null = null;
    let delayed: number | null = null;

    const schedule = () => {
      if (disposed || frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        refreshInventoryPhotos();
      });
      if (delayed !== null) window.clearTimeout(delayed);
      delayed = window.setTimeout(refreshInventoryPhotos, 180);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden'],
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') schedule();
    };

    window.addEventListener('isivolt:data-updated', schedule);
    window.addEventListener('isivolt:management-refresh', schedule);
    window.addEventListener('isivolt:app-refresh', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('focus', schedule);
    document.addEventListener('visibilitychange', onVisibilityChange);
    schedule();

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener('isivolt:data-updated', schedule);
      window.removeEventListener('isivolt:management-refresh', schedule);
      window.removeEventListener('isivolt:app-refresh', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('focus', schedule);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (delayed !== null) window.clearTimeout(delayed);
    };
  }, []);

  return null;
}
