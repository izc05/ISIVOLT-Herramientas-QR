import { Capacitor } from '@capacitor/core';
import {
  BarcodeFormat,
  BarcodeScanner,
} from '@capacitor-mlkit/barcode-scanning';

export type NativeScanResult =
  | { status: 'success'; value: string }
  | { status: 'cancelled' }
  | { status: 'unsupported'; message: string }
  | { status: 'module-installing'; message: string }
  | { status: 'error'; message: string };

export type IsivoltQrPayload =
  | { type: 'technician'; code: string; raw: string }
  | { type: 'tool'; code: string; raw: string }
  | { type: 'unknown'; raw: string };

export const isNativeScannerAvailable = () => Capacitor.isNativePlatform();

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

    if (Capacitor.getPlatform() === 'android') {
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
        return {
          status: 'module-installing',
          message: 'Android está instalando el módulo de lectura QR. Repite el escaneo en unos segundos.',
        };
      }
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
    return { status: 'error', message };
  }
};
