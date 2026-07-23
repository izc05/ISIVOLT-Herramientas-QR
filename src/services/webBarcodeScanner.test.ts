import { describe, expect, it } from 'vitest';
import {
  classifyWebCameraError,
  isRepeatedWebDetection,
  WEB_BARCODE_FORMATS,
} from './webBarcodeScanner';

describe('lector web de códigos', () => {
  it('clasifica el permiso denegado con instrucciones recuperables', () => {
    expect(classifyWebCameraError({ name: 'NotAllowedError' })).toEqual({
      status: 'permission-denied',
      message: 'El navegador no tiene permiso para usar la cámara. Autorízala desde el candado de la barra de direcciones.',
    });
  });

  it('ofrece selección manual cuando no existe cámara', () => {
    expect(classifyWebCameraError({ name: 'NotFoundError' })).toEqual({
      status: 'unsupported',
      message: 'No se ha encontrado una cámara compatible. Utiliza la búsqueda manual o conecta una webcam.',
    });
  });

  it('diferencia una cámara ocupada de un permiso denegado', () => {
    expect(classifyWebCameraError({ name: 'NotReadableError' })).toEqual({
      status: 'error',
      message: 'La cámara está siendo utilizada por otra aplicación o no puede iniciarse en este momento.',
    });
  });

  it('incluye QR, CODE 39 y CODE 128 entre los formatos prioritarios', () => {
    expect(WEB_BARCODE_FORMATS).toContain('qr_code');
    expect(WEB_BARCODE_FORMATS).toContain('code_39');
    expect(WEB_BARCODE_FORMATS).toContain('code_128');
  });

  it('bloquea el mismo código mientras permanece delante de la cámara', () => {
    expect(isRepeatedWebDetection('HER-015', 'HER-015', 1_000, 2_000, 1_600)).toBe(true);
  });

  it('permite volver a leer el mismo código después del tiempo de seguridad', () => {
    expect(isRepeatedWebDetection('HER-015', 'HER-015', 1_000, 2_700, 1_600)).toBe(false);
  });

  it('acepta inmediatamente un código diferente', () => {
    expect(isRepeatedWebDetection('HER-016', 'HER-015', 1_000, 1_100, 1_600)).toBe(false);
  });
});
