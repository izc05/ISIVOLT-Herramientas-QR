import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type NfcTagPayload = {
  uid: string;
  techTypes: string[];
};

export type NativeNfcResult =
  | { status: 'success'; tag: NfcTagPayload }
  | { status: 'cancelled' }
  | { status: 'unsupported'; message: string }
  | { status: 'disabled'; message: string }
  | { status: 'error'; message: string };

type AvailabilityResult = {
  available: boolean;
  enabled: boolean;
};

type IsivoltNfcPlugin = {
  isAvailable(): Promise<AvailabilityResult>;
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  addListener(
    eventName: 'nfcTagScanned',
    listenerFunc: (event: NfcTagPayload) => void,
  ): Promise<PluginListenerHandle>;
};

const IsivoltNfc = registerPlugin<IsivoltNfcPlugin>('IsivoltNfc');

export const normalizeNfcUid = (value?: string) =>
  (value ?? '').replace(/[^a-fA-F0-9]/g, '').toUpperCase();

export const isNfcScannerAvailable = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const getNfcAvailability = async (): Promise<AvailabilityResult> => {
  if (!isNfcScannerAvailable()) return { available: false, enabled: false };
  try {
    return await IsivoltNfc.isAvailable();
  } catch {
    return { available: false, enabled: false };
  }
};

export const scanNfcTag = async (timeoutMs = 20_000): Promise<NativeNfcResult> => {
  if (!isNfcScannerAvailable()) {
    const manual = window.prompt('Introduce manualmente el UID NFC para pruebas.');
    if (manual === null) return { status: 'cancelled' };
    const uid = normalizeNfcUid(manual);
    return uid
      ? { status: 'success', tag: { uid, techTypes: ['manual'] } }
      : { status: 'error', message: 'El identificador NFC está vacío.' };
  }

  const availability = await getNfcAvailability();
  if (!availability.available) {
    return { status: 'unsupported', message: 'Este dispositivo no dispone de lector NFC compatible.' };
  }
  if (!availability.enabled) {
    return { status: 'disabled', message: 'Activa NFC en los ajustes rápidos del teléfono.' };
  }

  let listener: PluginListenerHandle | null = null;
  let timeoutId: number | undefined;

  return new Promise<NativeNfcResult>((resolve) => {
    let settled = false;

    const finish = async (result: NativeNfcResult) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      try {
        await IsivoltNfc.stopScan();
      } catch {
        // El lector puede haberse detenido al salir de la actividad.
      }
      try {
        await listener?.remove();
      } finally {
        resolve(result);
      }
    };

    void (async () => {
      try {
        listener = await IsivoltNfc.addListener('nfcTagScanned', (event) => {
          const uid = normalizeNfcUid(event.uid);
          void finish(
            uid
              ? { status: 'success', tag: { uid, techTypes: event.techTypes ?? [] } }
              : { status: 'error', message: 'La tarjeta no ha entregado un UID utilizable.' },
          );
        });

        timeoutId = window.setTimeout(() => {
          void finish({ status: 'cancelled' });
        }, timeoutMs);

        await IsivoltNfc.startScan();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se ha podido iniciar el lector NFC.';
        void finish({ status: 'error', message });
      }
    })();
  });
};
