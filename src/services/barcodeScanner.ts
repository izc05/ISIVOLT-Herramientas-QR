import { Capacitor } from '@capacitor/core';
import {
  BarcodeFormat,
  BarcodeScanner,
  GoogleBarcodeScannerModuleInstallState,
} from '@capacitor-mlkit/barcode-scanning';
import { resolveTechnicianBarcode, loadTechnicianBarcodeRegistry } from './barcodeRegistry';
import { loadAppData } from './storage';
import {
  scanBarcodeWithWebCamera,
  type WebBarcodeDetectionDecision,
  type WebBarcodeScannerOptions,
} from './webBarcodeScanner';

export type NativeScanResult =
  | { status: 'success'; value: string; format?: BarcodeFormat | string }
  | { status: 'completed'; message: string }
  | { status: 'manual-requested'; message: string }
  | { status: 'cancelled' }
  | { status: 'permission-denied'; message: string }
  | { status: 'unsupported'; message: string }
  | { status: 'module-installing'; message: string }
  | { status: 'error'; message: string };

export type ScanQrCodeOptions = Omit<WebBarcodeScannerOptions, 'onDetected'> & {
  onDetected?: (
    value: string,
    format?: string,
  ) => WebBarcodeDetectionDecision | Promise<WebBarcodeDetectionDecision>;
};

export type IsivoltQrPayload =
  | { type: 'technician'; code: string; raw: string }
  | { type: 'tool'; code: string; raw: string }
  | { type: 'unknown'; raw: string };

const IDENTIFICATION_FORMATS: BarcodeFormat[] = [
  BarcodeFormat.QrCode,
  BarcodeFormat.Code39,
  BarcodeFormat.Code93,
  BarcodeFormat.Code128,
  BarcodeFormat.Codabar,
  BarcodeFormat.Ean8,
  BarcodeFormat.Ean13,
  BarcodeFormat.Itf,
  BarcodeFormat.UpcA,
  BarcodeFormat.UpcE,
  BarcodeFormat.DataMatrix,
  BarcodeFormat.Pdf417,
  BarcodeFormat.Aztec,
];

// El flujo de identificación está disponible tanto en APK como en navegador.
// En web la cámara puede caer de forma segura a la introducción manual.
export const isNativeScannerAvailable = () =>
  Capacitor.isNativePlatform() || typeof window !== 'undefined';

export const openScannerSettings = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  await BarcodeScanner.openSettings();
};

const requestManualValue = (
  reason: string | undefined,
  preserveRawValue: boolean,
): NativeScanResult => {
  const value = window.prompt(
    `${reason ? `${reason}\n\n` : ''}Introduce el código completo o el número visible.\n\nEjemplos:\nISIVOLT:TOOL:HER-015\nHER-015\nTEC-023\n52502`,
  );

  if (value === null) return { status: 'cancelled' };
  const normalized = value.trim();
  if (!normalized) {
    return { status: 'error', message: 'No se ha introducido ningún código.' };
  }

  if (preserveRawValue) return { status: 'success', value: normalized };

  if (/^TEC-[A-Z0-9-]+$/i.test(normalized)) {
    return { status: 'success', value: `ISIVOLT:TECH:${normalized.toUpperCase()}` };
  }

  if (/^[A-Z][A-Z0-9-]+$/i.test(normalized)) {
    return { status: 'success', value: `ISIVOLT:TOOL:${normalized.toUpperCase()}` };
  }

  return { status: 'success', value: normalized };
};

export const requestManualQrValue = (reason?: string): NativeScanResult =>
  requestManualValue(reason, false);

export const requestManualRawBarcodeValue = (reason?: string): NativeScanResult =>
  requestManualValue(reason, true);

export const parseIsivoltQr = (rawValue: string): IsivoltQrPayload => {
  const raw = rawValue.trim();
  const technicianMatch = /^ISIVOLT:TECH:([A-Z0-9-]+)$/i.exec(raw);
  if (technicianMatch) {
    return { type: 'technician', code: technicianMatch[1].toUpperCase(), raw };
  }

  const toolMatch = /^ISIVOLT:TOOL:([A-Z0-9-]+)$/i.exec(raw);
  if (toolMatch) {
    return { type: 'tool', code: toolMatch[1].toUpperCase(), raw };
  }

  return { type: 'unknown', raw };
};

const hasCameraPermission = (state: string) => state === 'granted' || state === 'limited';

const ensureCameraPermission = async (): Promise<boolean> => {
  if (Capacitor.getPlatform() === 'android') return true;

  const current = await BarcodeScanner.checkPermissions();
  if (hasCameraPermission(current.camera)) return true;

  const requested = await BarcodeScanner.requestPermissions();
  return hasCameraPermission(requested.camera);
};

const ensureGoogleScannerModule = async (): Promise<boolean> => {
  if (Capacitor.getPlatform() !== 'android') return true;

  const current = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (current.available) return true;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let timeoutId: number | undefined;
    let listener: Awaited<ReturnType<typeof BarcodeScanner.addListener>> | null = null;

    const finish = async (available: boolean) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      try {
        await listener?.remove();
      } finally {
        resolve(available);
      }
    };

    void (async () => {
      try {
        listener = await BarcodeScanner.addListener(
          'googleBarcodeScannerModuleInstallProgress',
          (event) => {
            if (event.state === GoogleBarcodeScannerModuleInstallState.COMPLETED) {
              void finish(true);
              return;
            }

            if (
              event.state === GoogleBarcodeScannerModuleInstallState.CANCELED
              || event.state === GoogleBarcodeScannerModuleInstallState.FAILED
            ) {
              void finish(false);
            }
          },
        );

        timeoutId = window.setTimeout(() => {
          void (async () => {
            try {
              const result = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
              await finish(result.available);
            } catch {
              await finish(false);
            }
          })();
        }, 30_000);

        await BarcodeScanner.installGoogleBarcodeScannerModule();
      } catch {
        await finish(false);
      }
    })();
  });
};

const resolveRegisteredBarcode = async (rawValue: string): Promise<string> => {
  const registry = await loadTechnicianBarcodeRegistry();
  const technician = resolveTechnicianBarcode(registry, loadAppData(), rawValue);
  return technician ? `ISIVOLT:TECH:${technician.code}` : rawValue;
};

const scanWebBarcode = async (
  resolveKnownTechnician: boolean,
  manualFallback: (reason?: string) => NativeScanResult,
  options: ScanQrCodeOptions = {},
): Promise<NativeScanResult> => {
  const onDetected = options.onDetected
    ? async (rawValue: string, format?: string) => {
      const value = resolveKnownTechnician
        ? await resolveRegisteredBarcode(rawValue)
        : rawValue;
      return options.onDetected?.(value, format) ?? { action: 'continue' as const };
    }
    : undefined;

  const result = await scanBarcodeWithWebCamera({ ...options, onDetected });
  if (result.status === 'unsupported' && !options.onDetected) return manualFallback(result.message);
  if (result.status === 'completed') {
    return { status: 'completed', message: 'Cámara cerrada. La operación preparada se mantiene.' };
  }
  if (result.status === 'manual-requested') {
    return { status: 'manual-requested', message: 'Selección manual solicitada.' };
  }
  if (result.status !== 'success') return result;

  const value = resolveKnownTechnician
    ? await resolveRegisteredBarcode(result.value)
    : result.value;

  return { status: 'success', value, format: result.format };
};

const scanSupportedBarcode = async (
  resolveKnownTechnician: boolean,
  options: ScanQrCodeOptions = {},
): Promise<NativeScanResult> => {
  const manualFallback = (reason?: string) => resolveKnownTechnician
    ? requestManualQrValue(reason)
    : requestManualRawBarcodeValue(reason);

  if (!Capacitor.isNativePlatform()) {
    return scanWebBarcode(resolveKnownTechnician, manualFallback, options);
  }

  try {
    const { supported } = await BarcodeScanner.isSupported();
    if (!supported) {
      return manualFallback('Este dispositivo no dispone de un lector de códigos compatible.');
    }

    const permissionGranted = await ensureCameraPermission();
    if (!permissionGranted) {
      return {
        status: 'permission-denied',
        message: 'La cámara está bloqueada. Autoriza el permiso de Cámara para ISIVOLT Herramientas QR.',
      };
    }

    const moduleReady = await ensureGoogleScannerModule();
    if (!moduleReady) {
      return manualFallback('No se ha podido preparar el lector de códigos de Google.');
    }

    const { barcodes } = await BarcodeScanner.scan({
      formats: IDENTIFICATION_FORMATS,
      autoZoom: true,
    });

    const barcode = barcodes[0];
    const rawValue = barcode?.rawValue || barcode?.displayValue || '';
    if (!rawValue) return { status: 'cancelled' };

    const value = resolveKnownTechnician
      ? await resolveRegisteredBarcode(rawValue)
      : rawValue;

    return { status: 'success', value, format: barcode.format };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se ha podido iniciar el lector de códigos.';
    const normalized = message.toLowerCase();
    if (normalized.includes('cancel') || normalized.includes('canceled')) {
      return { status: 'cancelled' };
    }
    if (normalized.includes('permission') || normalized.includes('camera access')) {
      return {
        status: 'permission-denied',
        message: 'El sistema no permite usar la cámara. Abre los ajustes de la aplicación y revisa el permiso Cámara.',
      };
    }
    return manualFallback(`No se ha podido abrir el lector: ${message}`);
  }
};

export const scanQrCode = async (
  options: ScanQrCodeOptions = {},
): Promise<NativeScanResult> => scanSupportedBarcode(true, options);

export const scanRawBarcode = async (): Promise<NativeScanResult> =>
  scanSupportedBarcode(false);
