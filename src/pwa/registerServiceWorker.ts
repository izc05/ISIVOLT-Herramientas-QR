export const PWA_UPDATE_EVENT = 'isivoltpro:pwa-update';

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(serviceWorkerUrl, { scope: import.meta.env.BASE_URL })
      .then((registration) => {
        if (registration.waiting) {
          window.dispatchEvent(new CustomEvent(PWA_UPDATE_EVENT, { detail: registration }));
        }

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent(PWA_UPDATE_EVENT, { detail: registration }));
            }
          });
        });
      })
      .catch((error) => console.warn('No se pudo registrar la PWA de IsiVoltPro.', error));
  });
}
