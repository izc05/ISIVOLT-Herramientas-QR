import {
  Camera,
  CameraDirection,
  MediaTypeSelection,
  type MediaResult,
} from '@capacitor/camera';

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
        includeMetadata: true,
        editable: 'no',
        webUseInput: true,
      });
      return mediaResultToDataUrl(result);
    }

    const { results } = await Camera.chooseFromGallery({
      mediaType: MediaTypeSelection.Photo,
      allowMultipleSelection: false,
      quality: 72,
      targetWidth: 960,
      targetHeight: 960,
      correctOrientation: true,
      includeMetadata: true,
      editable: 'no',
      webUseInput: true,
    });
    if (!results[0]) return null;
    return mediaResultToDataUrl(results[0]);
  } catch (error) {
    if (isCancellation(error)) return null;
    throw error;
  }
};
