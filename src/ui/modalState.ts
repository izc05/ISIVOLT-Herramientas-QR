const MODAL_SELECTORS = [
  '[role="dialog"][aria-modal="true"]',
  '.modal-backdrop',
  '.native-scan-backdrop',
  '.management-backdrop',
  '.management-editor-backdrop',
  '.management-files-backdrop',
  '.maintenance-board-backdrop',
  '.maintenance-record-backdrop',
  '.security-admin-backdrop',
  '.rectification-backdrop',
  '.rectification-editor-backdrop',
  '.commissioning-backdrop',
  '.diagnostics-backdrop',
  '.technician-create-backdrop',
  '.report-center-backdrop',
].join(',');

let lastOpenState: boolean | null = null;

const refreshModalState = () => {
  const open = Boolean(document.querySelector(MODAL_SELECTORS));
  const mobile = window.matchMedia('(max-width: 820px)').matches;
  document.body.classList.toggle('modal-open', open);
  document.body.classList.toggle('performance-mobile', mobile);
  document.body.style.overflow = open ? 'hidden' : '';

  if (lastOpenState !== open) {
    lastOpenState = open;
    window.dispatchEvent(new CustomEvent<boolean>('isivolt:modal-state', { detail: open }));
  }
};

export const installModalStateObserver = () => {
  refreshModalState();
  const observer = new MutationObserver(refreshModalState);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  const media = window.matchMedia('(max-width: 820px)');
  media.addEventListener?.('change', refreshModalState);
  return () => {
    observer.disconnect();
    media.removeEventListener?.('change', refreshModalState);
    document.body.classList.remove('modal-open', 'performance-mobile');
    document.body.style.overflow = '';
    lastOpenState = null;
  };
};
