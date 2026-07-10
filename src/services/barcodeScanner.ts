import { Capacitor } from '@capacitor/core';
import {
  BarcodeFormat,
  BarcodeScanner,
  GoogleBarcodeScannerModuleInstallState,
} from '@capacitor-mlkit/barcode-scanning';

export type NativeScanResult =
  | { status: 'success'; value: string }
  | { status: 'cancelled' }
  | { status: 'permission-denied'; message: string }
  | { status: 'unsupported'; message: string }
  | { status: 'module-installing'; message: string }
  | { status: 'error'; message: string };

export type IsivoltQrPayload =
  | { type: 'technician'; code: string; raw: string }
  | { type: 'tool'; code: string; raw: string }
  | { type: 'unknown'; raw: string };

export const isNativeScannerAvailable = () => Capacitor.isNativePlatform();

export const openScannerSettings = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  await BarcodeScanner.openSettings();
};

export const parseIsivoltQr = (rawValue: string): IsivoltQrPayload => {
  const raw = rawValue.trim();
  const technicianMatch = /^ISIVOLT:TECH:(TEC-[A-Z0-9-]+)$/i.exec(raw);
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
  const current = await BarcodeScanner.checkPermissions();
  if (hasCameraPermission(current.camera)) return true;

  const requested = await BarcodeScanner.requestPermissions();
  return hasCameraPermission(requested.camera);
};

const ensureGoogleScannerModule = async (): Promise<boolean> => {
  if (Capacitor.getPlatform() !== 'android') return true;

  const current = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (current.available) return true;

  return new Promise<boolean>(async (resolve) => {
    let settled = false;
    let timeoutId = 0;

    const finish = async (available: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      await listener.remove();
      resolve(available);
    };

    const listener = await BarcodeScanner.addListener(
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

    timeoutId = window.setTimeout(async () => {
      try {
        const result = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        await finish(result.available);
      } catch {
        await finish(false);
      }
    }, 30_000);

    try {
      await BarcodeScanner.installGoogleBarcodeScannerModule();
    } catch {
      await finish(false);
    }
  });
};

export const scanQrCode = async (): Promise<NativeScanResult> => {
  if (!Capacitor.isNativePlatform()) {
    return {
      status: 'unsupported',
      message: 'La cámara real solo está disponible dentro de la APK.',
    };
  }

  try {
    const { supported } = await BarcodeScanner.isSupported();
    if (!supported) {
      return {
        status: 'unsupported',
        message: 'Este dispositivo no dispone de una cámara compatible.',
      };
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
      return {
        status: 'module-installing',
        message: 'No se ha podido preparar el módulo QR de Google. Comprueba la conexión y vuelve a intentarlo.',
      };
    }

    const { barcodes } = await BarcodeScanner.scan({
      formats: [BarcodeFormat.QrCode],
      autoZoom: true,
    });

    const barcode = barcodes[0];
    const value = barcode?.rawValue || barcode?.displayValue || '';
    if (!value) return { status: 'cancelled' };

    return { status: 'success', value };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se ha podido iniciar el lector QR.';
    const normalized = message.toLowerCase();
    if (normalized.includes('cancel') || normalized.includes('canceled')) {
      return { status: 'cancelled' };
    }
    if (normalized.includes('permission') || normalized.includes('camera access')) {
      return {
        status: 'permission-denied',
        message: 'Android no permite usar la cámara. Abre los ajustes de la aplicación y activa el permiso Cámara.',
      };
    }
    return { status: 'error', message };
  }
};
