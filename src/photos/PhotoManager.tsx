import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Star, Trash2 } from 'lucide-react';
import type { PhotoReference } from '../types';
import { getPhotoUrl, removeLocalPhoto, saveLocalPhoto } from './photoStore';

type PhotoManagerProps = {
  entityId: string;
  photos: PhotoReference[];
  onChange(photos: PhotoReference[]): void;
  onMessage(message: string): void;
  maxPhotos?: number;
};

type PhotoPreview = {
  reference: PhotoReference;
  url: string | null;
};

export default function PhotoManager({ entityId, photos, onChange, onMessage, maxPhotos = 5 }: PhotoManagerProps) {
  const [previews, setPreviews] = useState<PhotoPreview[]>([]);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    void Promise.all(photos.map(async (reference) => {
      const url = await getPhotoUrl(reference);
      if (url) urls.push(url);
      return { reference, url };
    })).then((next) => {
      if (!cancelled) setPreviews(next);
      else urls.forEach((url) => URL.revokeObjectURL(url));
    });
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photos]);

  const addPhoto = async (file?: File) => {
    if (!file || busy) return;
    if (photos.length >= maxPhotos) {
      onMessage(`Puedes guardar un máximo de ${maxPhotos} fotografías.`);
      return;
    }
    setBusy(true);
    try {
      const reference = await saveLocalPhoto(file, entityId);
      const next = photos.length === 0
        ? [{ ...reference, primary: true }]
        : [...photos, reference];
      onChange(next);
      onMessage('Fotografía guardada y comprimida en este dispositivo.');
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'No se pudo guardar la fotografía.');
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  const setPrimary = (id: string) => {
    onChange(photos.map((photo) => ({ ...photo, primary: photo.id === id })));
    onMessage('Fotografía principal actualizada.');
  };

  const remove = async (reference: PhotoReference) => {
    setBusy(true);
    try {
      await removeLocalPhoto(reference);
      const remaining = photos.filter((photo) => photo.id !== reference.id);
      if (reference.primary && remaining.length > 0) remaining[0] = { ...remaining[0], primary: true };
      onChange(remaining);
      onMessage('Fotografía eliminada.');
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'No se pudo eliminar la fotografía.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="photo-manager">
      <header>
        <div><strong>Fotografías</strong><p>{photos.length} de {maxPhotos} · La estrella indica la fotografía principal.</p></div>
        <div className="photo-actions">
          <button type="button" disabled={busy || photos.length >= maxPhotos} onClick={() => cameraRef.current?.click()}><Camera size={17} /> Cámara</button>
          <button type="button" disabled={busy || photos.length >= maxPhotos} onClick={() => galleryRef.current?.click()}><ImagePlus size={17} /> Galería</button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => void addPhoto(event.target.files?.[0])} />
          <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(event) => void addPhoto(event.target.files?.[0])} />
        </div>
      </header>

      {previews.length > 0 ? (
        <div className="photo-grid">
          {previews.map(({ reference, url }) => (
            <article key={reference.id} className={reference.primary ? 'primary' : ''}>
              {url ? <img src={url} alt="Fotografía de la ficha" /> : <div className="photo-missing"><ImagePlus size={26} /><span>No disponible</span></div>}
              <div className="photo-overlay">
                <button type="button" className={reference.primary ? 'selected' : ''} onClick={() => setPrimary(reference.id)} aria-label="Marcar como principal" title="Marcar como principal"><Star size={17} fill={reference.primary ? 'currentColor' : 'none'} /></button>
                <button type="button" onClick={() => void remove(reference)} aria-label="Eliminar fotografía" title="Eliminar fotografía"><Trash2 size={17} /></button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="photo-empty"><Camera size={30} /><strong>Sin fotografías</strong><p>Haz una foto o selecciónala desde la galería.</p></div>
      )}
    </section>
  );
}
