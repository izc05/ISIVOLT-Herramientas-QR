import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Pencil } from 'lucide-react';
import { ADMIN_OPEN_ENTITY_EVENT } from '../admin/AdminDeepLinkBridge';
import PhotoManager from '../photos/PhotoManager';
import { getPhotoUrl, removeLocalPhoto } from '../photos/photoStore';
import { loadData, saveData, WORKSPACE_DATA_EVENT } from '../storage';
import type { AppData, PhotoReference } from '../types';

type DraftType = 'tool' | 'technician';
type PendingCreation = {
  type: DraftType;
  photos: PhotoReference[];
  existingIds: Set<string>;
};

const uid = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

const primaryPhoto = (photos?: PhotoReference[]) => photos?.find((photo) => photo.primary) ?? photos?.[0];

async function setElementPhoto(element: HTMLElement, reference?: PhotoReference) {
  const currentId = element.dataset.photoId ?? '';
  const nextId = reference?.id ?? '';
  if (currentId === nextId) return;

  const oldUrl = element.dataset.photoUrl;
  if (oldUrl) URL.revokeObjectURL(oldUrl);
  delete element.dataset.photoUrl;
  element.dataset.photoId = nextId;
  element.querySelector('img.main-entity-photo')?.remove();

  if (!reference) return;
  const url = await getPhotoUrl(reference);
  if (!url || element.dataset.photoId !== reference.id) {
    if (url) URL.revokeObjectURL(url);
    return;
  }

  const image = document.createElement('img');
  image.className = 'main-entity-photo';
  image.alt = '';
  image.src = url;
  element.dataset.photoUrl = url;
  element.prepend(image);
}

function addEditButton(container: Element, mode: DraftType, entityId: string) {
  const existing = container.querySelector<HTMLButtonElement>(`.main-edit-entity[data-entity-id="${CSS.escape(entityId)}"]`);
  if (existing) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'main-edit-entity';
  button.dataset.entityMode = mode;
  button.dataset.entityId = entityId;
  button.setAttribute('aria-label', 'Editar ficha completa');
  button.innerHTML = '<span aria-hidden="true">✎</span><strong>Editar ficha</strong>';
  container.append(button);
}

function decorateMainLists(data: AppData) {
  const managerAllowed = document.body.dataset.accessRole !== 'technician';

  document.querySelectorAll<HTMLTableRowElement>('.tools-table-card tbody tr').forEach((row) => {
    const code = row.querySelector('.code-chip')?.textContent?.trim();
    const tool = data.tools.find((entry) => entry.code === code);
    if (!tool) return;

    const nameCell = row.querySelectorAll<HTMLTableCellElement>('td')[1];
    if (nameCell) {
      nameCell.classList.add('main-tool-name-cell');
      let photoHost = nameCell.querySelector<HTMLElement>('.main-tool-photo');
      if (!photoHost) {
        photoHost = document.createElement('span');
        photoHost.className = 'main-tool-photo';
        nameCell.prepend(photoHost);
      }
      void setElementPhoto(photoHost, primaryPhoto(tool.photos));
    }

    const actions = row.querySelector('.row-actions');
    if (managerAllowed && actions) addEditButton(actions, 'tool', tool.id);
    if (!managerAllowed) actions?.querySelectorAll('.main-edit-entity').forEach((button) => button.remove());
  });

  document.querySelectorAll<HTMLElement>('.technician-card').forEach((card) => {
    const code = card.querySelector('small')?.textContent?.trim();
    const technician = data.technicians.find((entry) => entry.code === code);
    if (!technician) return;

    const initials = card.querySelector<HTMLElement>('.initials');
    if (initials) {
      initials.classList.toggle('has-photo', Boolean(primaryPhoto(technician.photos)));
      void setElementPhoto(initials, primaryPhoto(technician.photos));
    }

    if (managerAllowed) {
      card.classList.add('main-technician-editable');
      addEditButton(card, 'technician', technician.id);
    } else {
      card.classList.remove('main-technician-editable');
      card.querySelectorAll('.main-edit-entity').forEach((button) => button.remove());
    }
  });
}

export default function MainScreenEnhancer() {
  const [photoTarget, setPhotoTarget] = useState<Element | null>(null);
  const [draftType, setDraftType] = useState<DraftType | null>(null);
  const [draftEntityId, setDraftEntityId] = useState('');
  const [draftPhotos, setDraftPhotos] = useState<PhotoReference[]>([]);
  const [photoMessage, setPhotoMessage] = useState('');
  const photosRef = useRef<PhotoReference[]>([]);
  const modalRef = useRef<Element | null>(null);
  const pendingRef = useRef<PendingCreation | null>(null);

  useEffect(() => {
    photosRef.current = draftPhotos;
  }, [draftPhotos]);

  useEffect(() => {
    const resolveModal = () => {
      const modal = document.querySelector('.modal');
      if (modal === modalRef.current) return;

      if (modalRef.current && !document.body.contains(modalRef.current) && !pendingRef.current && photosRef.current.length > 0) {
        const orphaned = [...photosRef.current];
        photosRef.current = [];
        setDraftPhotos([]);
        orphaned.forEach((photo) => void removeLocalPhoto(photo));
      }

      modalRef.current = modal;
      const title = modal?.querySelector('.modal-header h2')?.textContent?.trim();
      const nextType: DraftType | null = title === 'Nueva herramienta'
        ? 'tool'
        : title === 'Nuevo técnico'
          ? 'technician'
          : null;

      if (!nextType || !modal) {
        setPhotoTarget(null);
        setDraftType(null);
        setPhotoMessage('');
        return;
      }

      setDraftType(nextType);
      setDraftEntityId(uid(nextType === 'tool' ? 'tool-draft' : 'tech-draft'));
      setDraftPhotos([]);
      photosRef.current = [];
      setPhotoMessage('');
      setPhotoTarget(modal.querySelector('.modal-body'));
    };

    const refresh = (data = loadData()) => {
      decorateMainLists(data);
      const pending = pendingRef.current;
      if (!pending) return;

      const items = pending.type === 'tool' ? data.tools : data.technicians;
      const created = items
        .filter((entry) => !pending.existingIds.has(entry.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!created) return;

      pendingRef.current = null;
      const photos = pending.photos.map((photo, index) => ({ ...photo, primary: index === 0 ? true : photo.primary }));
      const updatedAt = new Date().toISOString();
      const next: AppData = pending.type === 'tool'
        ? { ...data, tools: data.tools.map((tool) => tool.id === created.id ? { ...tool, photos, updatedAt } : tool) }
        : { ...data, technicians: data.technicians.map((technician) => technician.id === created.id ? { ...technician, photos, updatedAt } : technician) };
      photosRef.current = [];
      setDraftPhotos([]);
      saveData(next);
    };

    const observer = new MutationObserver(() => {
      resolveModal();
      decorateMainLists(loadData());
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-access-role', 'class'] });
    resolveModal();
    refresh();

    const handleData = (event: Event) => refresh((event as CustomEvent<AppData>).detail ?? loadData());
    const handleSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      const type: DraftType | null = form?.id === 'tool-form' ? 'tool' : form?.id === 'technician-form' ? 'technician' : null;
      if (!type || photosRef.current.length === 0) return;
      const current = loadData();
      pendingRef.current = {
        type,
        photos: [...photosRef.current],
        existingIds: new Set((type === 'tool' ? current.tools : current.technicians).map((entry) => entry.id)),
      };
    };
    const handleEdit = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.main-edit-entity') : null;
      if (!button?.dataset.entityId || !button.dataset.entityMode) return;
      event.preventDefault();
      event.stopPropagation();
      window.dispatchEvent(new CustomEvent(ADMIN_OPEN_ENTITY_EVENT, {
        detail: { mode: button.dataset.entityMode, entityId: button.dataset.entityId },
      }));
    };

    window.addEventListener(WORKSPACE_DATA_EVENT, handleData);
    document.addEventListener('submit', handleSubmit, true);
    document.addEventListener('click', handleEdit, true);
    return () => {
      observer.disconnect();
      window.removeEventListener(WORKSPACE_DATA_EVENT, handleData);
      document.removeEventListener('submit', handleSubmit, true);
      document.removeEventListener('click', handleEdit, true);
      document.querySelectorAll<HTMLElement>('[data-photo-url]').forEach((element) => {
        if (element.dataset.photoUrl) URL.revokeObjectURL(element.dataset.photoUrl);
      });
    };
  }, []);

  if (!photoTarget || !draftType || !draftEntityId) return null;

  return createPortal(
    <section className="main-create-photo-slot" aria-label="Fotografía inicial">
      <header><span><Camera size={18} /></span><div><strong>Fotografía inicial</strong><p>Puedes hacerla ahora o añadir más desde Editar ficha.</p></div></header>
      <PhotoManager
        entityId={draftEntityId}
        photos={draftPhotos}
        maxPhotos={3}
        onChange={setDraftPhotos}
        onMessage={setPhotoMessage}
      />
      {photoMessage && <p className="main-photo-message" role="status">{photoMessage}</p>}
      <p className="main-photo-note"><Pencil size={15} /> La imagen se vinculará automáticamente al crear {draftType === 'tool' ? 'la herramienta' : 'el técnico'}.</p>
    </section>,
    photoTarget,
  );
}
