import { Capacitor } from '@capacitor/core';
import {
  Camera,
  CameraDirection,
  MediaTypeSelection,
  type MediaResult,
} from '@capacitor/camera';
import { Directory, Filesystem } from '@capacitor/filesystem';

export type ToolImageSource = 'camera' | 'gallery';

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen.'));
  reader.readAsDataURL(blob);
});

const mediaResultToDataUrl = async (result: MediaResult): Promise<string> => {
  const format = result.metadata?.format || 'jpeg';
  if (result.thumbnail) return `data:image/${format};base64,${result.thumbnail}`;
  if (result.webPath) {
    const response = await fetch(result.webPath);
    return blobToDataUrl(await response.blob());
  }
  throw new Error('La cámara no ha devuelto una imagen utilizable.');
};

const dataUrlPayload = (dataUrl: string) => {
  const match = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('La imagen no tiene un formato compatible.');
  return { format: match[1].replace('jpeg', 'jpg'), base64: match[2] };
};

const persistNativeImage = async (dataUrl: string): Promise<string> => {
  const { format, base64 } = dataUrlPayload(dataUrl);
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = `tool-images/${id}.${format}`;
  const result = await Filesystem.writeFile({
    path,
    data: base64,
    directory: Directory.Data,
    recursive: true,
  });
  return Capacitor.convertFileSrc(result.uri);
};

const prepareImageResult = async (result: MediaResult): Promise<string> => {
  const dataUrl = await mediaResultToDataUrl(result);
  return Capacitor.isNativePlatform() ? persistNativeImage(dataUrl) : dataUrl;
};

const isCancellation = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel|cancelled|canceled|user/i.test(message);
};

export const acquireToolImage = async (source: ToolImageSource): Promise<string | null> => {
  try {
    if (source === 'camera') {
      const result = await Camera.takePhoto({
        quality: 72,
        targetWidth: 960,
        targetHeight: 960,
        cameraDirection: CameraDirection.Rear,
        correctOrientation: true,
        saveToGallery: false,
        includeMetadata: false,
        editable: 'no',
        webUseInput: true,
      });
      return prepareImageResult(result);
    }

    const { results } = await Camera.chooseFromGallery({
      mediaType: MediaTypeSelection.Photo,
      allowMultipleSelection: false,
      quality: 72,
      targetWidth: 960,
      targetHeight: 960,
      correctOrientation: true,
      includeMetadata: false,
      editable: 'no',
      webUseInput: true,
    });
    if (!results[0]) return null;
    return prepareImageResult(results[0]);
  } catch (error) {
    if (isCancellation(error)) return null;
    throw error;
  }
};
