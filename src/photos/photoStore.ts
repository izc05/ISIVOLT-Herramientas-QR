import type { PhotoReference } from '../types';

const DATABASE_NAME = 'isivoltpro-media-v1';
const DATABASE_VERSION = 1;
const STORE_NAME = 'photos';
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

type StoredPhoto = {
  id: string;
  entityId: string;
  blob: Blob;
  filename: string;
  mimeType: string;
  createdAt: string;
};

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('entityId', 'entityId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir el almacén de fotografías.'));
  });
  return databasePromise;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen.'));
    };
    image.src = url;
  });
}

async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo seleccionado no es una imagen.');
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('El navegador no permite procesar la fotografía.');
  context.drawImage(image, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('No se pudo comprimir la fotografía.')),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

function putPhoto(photo: StoredPhoto): Promise<void> {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(photo);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo guardar la fotografía.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Se canceló el guardado de la fotografía.'));
  }));
}

function readPhoto(id: string): Promise<StoredPhoto | null> {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as StoredPhoto | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('No se pudo leer la fotografía.'));
  }));
}

export async function saveLocalPhoto(file: File, entityId: string): Promise<PhotoReference> {
  const blob = await compressImage(file);
  const id = `photo-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const createdAt = new Date().toISOString();
  const filename = `${entityId}-${id}.jpg`;
  await putPhoto({ id, entityId, blob, filename, mimeType: 'image/jpeg', createdAt });
  return {
    id,
    storage: 'indexeddb',
    filename,
    mimeType: 'image/jpeg',
    createdAt,
  };
}

export async function getPhotoUrl(reference: PhotoReference): Promise<string | null> {
  if (reference.storage !== 'indexeddb') return null;
  const photo = await readPhoto(reference.id);
  return photo ? URL.createObjectURL(photo.blob) : null;
}

export async function removeLocalPhoto(reference: PhotoReference): Promise<void> {
  if (reference.storage !== 'indexeddb') return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(reference.id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo eliminar la fotografía.'));
  });
}

export async function hasLocalPhoto(reference: PhotoReference): Promise<boolean> {
  if (reference.storage !== 'indexeddb') return false;
  return Boolean(await readPhoto(reference.id));
}
