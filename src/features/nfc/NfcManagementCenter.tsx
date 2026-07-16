import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Check, ScanLine, Search, Unlink, UserRound, Wrench, X } from 'lucide-react';
import type { AppData, Technician, Tool } from '../../domain/types';
import { assertPermission, hasPermission } from '../../security/permissions';
import { normalizeNfcUid, scanNfcTag } from '../../services/nfcScanner';
import { loadAppData, saveAppData } from '../../services/storage';

type EntityMode = 'technician' | 'tool';
type SelectableEntity = Technician | Tool;

type Feedback = {
  tone: 'success' | 'warning' | 'error';
  text: string;
} | null;

const normalizeSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es-ES')
  .trim();

const shortUid = (uid?: string) => {
  const normalized = normalizeNfcUid(uid);
  if (!normalized) return 'Sin vincular';
  if (normalized.length <= 12) return normalized;
  return `${normalized.slice(0, 6)}…${normalized.slice(-6)}`;
};

export default function NfcManagementCenter() {
  const [allowed, setAllowed] = useState(() => hasPermission('inventory.manage') || hasPermission('technicians.manage'));
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<EntityMode>('technician');
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    const refresh = () => setAllowed(hasPermission('inventory.manage') || hasPermission('technicians.manage'));
    window.addEventListener('isivolt:security-session', refresh);
    return () => window.removeEventListener('isivolt:security-session', refresh);
  }, []);

  const entities = useMemo<SelectableEntity[]>(() => {
    const needle = normalizeSearch(query);
    const source: SelectableEntity[] = mode === 'technician' ? data.technicians : data.tools;
    return source
      .filter((entity) => entity.active !== false)
      .filter((entity) => !needle || [
        entity.name,
        entity.code,
        'specialty' in entity ? entity.specialty : entity.category,
        entity.nfcUid ?? '',
      ].some((value) => normalizeSearch(value).includes(needle)))
      .sort((a, b) => {
        const linkedDifference = Number(Boolean(b.nfcUid)) - Number(Boolean(a.nfcUid));
        if (linkedDifference !== 0) return linkedDifference;
        return a.name.localeCompare(b.name, 'es');
      });
  }, [data, mode, query]);

  const openCenter = () => {
    setData(loadAppData());
    setFeedback(null);
    setOpen(true);
  };

  const ensureUniqueUid = (snapshot: AppData, uid: string, entityId: string) => {
    const technicianConflict = snapshot.technicians.find(
      (item) => item.id !== entityId && normalizeNfcUid(item.nfcUid) === uid,
    );
    if (technicianConflict) return `La tarjeta ya pertenece al técnico ${technicianConflict.name}.`;

    const toolConflict = snapshot.tools.find(
      (item) => item.id !== entityId && normalizeNfcUid(item.nfcUid) === uid,
    );
    if (toolConflict) return `La etiqueta ya pertenece a la herramienta ${toolConflict.name}.`;
    return '';
  };

  const linkEntity = async (entity: SelectableEntity) => {
    try {
      assertPermission(mode === 'technician' ? 'technicians.manage' : 'inventory.manage');
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'No tienes permiso para vincular NFC.' });
      return;
    }

    setBusyId(entity.id);
    setFeedback({ tone: 'warning', text: 'Acerca la tarjeta o pegatina NFC a la parte trasera del teléfono.' });
    const result = await scanNfcTag();

    if (result.status !== 'success') {
      setBusyId(null);
      setFeedback({
        tone: result.status === 'cancelled' ? 'warning' : 'error',
        text: result.status === 'cancelled' ? 'Lectura NFC cancelada o agotó el tiempo.' : result.message,
      });
      return;
    }

    const uid = normalizeNfcUid(result.tag.uid);
    const current = loadAppData();
    const conflict = ensureUniqueUid(current, uid, entity.id);
    if (conflict) {
      setBusyId(null);
      setFeedback({ tone: 'error', text: conflict });
      return;
    }

    const timestamp = new Date().toISOString();
    const next: AppData = mode === 'technician'
      ? {
          ...current,
          technicians: current.technicians.map((item) => item.id === entity.id
            ? { ...item, nfcUid: uid, updatedAt: timestamp }
            : item),
        }
      : {
          ...current,
          tools: current.tools.map((item) => item.id === entity.id
            ? { ...item, nfcUid: uid, updatedAt: timestamp }
            : item),
        };

    saveAppData(next);
    setData(next);
    setBusyId(null);
    setFeedback({ tone: 'success', text: `${entity.name} vinculado correctamente al UID ${shortUid(uid)}.` });
  };

  const unlinkEntity = (entity: SelectableEntity) => {
    try {
      assertPermission(mode === 'technician' ? 'technicians.manage' : 'inventory.manage');
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'No tienes permiso para desvincular NFC.' });
      return;
    }

    const current = loadAppData();
    const timestamp = new Date().toISOString();
    const next: AppData = mode === 'technician'
      ? {
          ...current,
          technicians: current.technicians.map((item) => item.id === entity.id
            ? { ...item, nfcUid: undefined, updatedAt: timestamp }
            : item),
        }
      : {
          ...current,
          tools: current.tools.map((item) => item.id === entity.id
            ? { ...item, nfcUid: undefined, updatedAt: timestamp }
            : item),
        };

    saveAppData(next);
    setData(next);
    setFeedback({ tone: 'success', text: `${entity.name} ya no tiene una identificación NFC asociada.` });
  };

  if (!allowed) return null;

  return (
    <>
      <motion.button
        className="nfc-management-launcher"
        type="button"
        onClick={openCenter}
        whileTap={{ scale: 0.9 }}
        aria-label="Gestionar tarjetas y etiquetas NFC"
      >
        <ScanLine size={20} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div className="nfc-management-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section
              className="nfc-management-center"
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              role="dialog"
              aria-modal="true"
              aria-label="Gestión NFC"
            >
              <header>
                <div><span><ScanLine size={24} /></span><div><small>Identificación rápida</small><h2>Tarjetas y etiquetas NFC</h2><p>Vincula técnicos y herramientas sin modificar el sistema de puertas.</p></div></div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={21} /></button>
              </header>

              <div className="nfc-management-tabs">
                <button type="button" className={mode === 'technician' ? 'active' : ''} onClick={() => { setMode('technician'); setQuery(''); }}><UserRound size={18} /> Técnicos</button>
                <button type="button" className={mode === 'tool' ? 'active' : ''} onClick={() => { setMode('tool'); setQuery(''); }}><Wrench size={18} /> Herramientas</button>
              </div>

              <label className="nfc-management-search">
                <Search size={18} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, código, categoría o UID…" />
              </label>

              {feedback && (
                <div className={`nfc-management-feedback tone-${feedback.tone}`}>
                  {feedback.tone === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
                  <span>{feedback.text}</span>
                </div>
              )}

              <main className="nfc-management-list">
                {entities.map((entity) => {
                  const linked = Boolean(entity.nfcUid);
                  const detail = 'specialty' in entity ? entity.specialty : `${entity.category} · ${entity.location}`;
                  return (
                    <article key={entity.id} className={linked ? 'linked' : ''}>
                      <span>{mode === 'technician' ? <UserRound size={20} /> : <Wrench size={20} />}</span>
                      <div><strong>{entity.name}</strong><small>{entity.code} · {detail}</small><em>{linked ? `NFC ${shortUid(entity.nfcUid)}` : 'NFC pendiente'}</em></div>
                      <button type="button" disabled={busyId === entity.id} onClick={() => { void linkEntity(entity); }}>
                        <ScanLine size={17} /> {busyId === entity.id ? 'Leyendo…' : linked ? 'Cambiar' : 'Vincular'}
                      </button>
                      {linked && <button className="unlink" type="button" onClick={() => unlinkEntity(entity)} aria-label={`Desvincular NFC de ${entity.name}`}><Unlink size={17} /></button>}
                    </article>
                  );
                })}
                {entities.length === 0 && <div className="nfc-management-empty"><ScanLine size={30} /><strong>No hay resultados</strong><span>Cambia la búsqueda o el tipo de elemento.</span></div>}
              </main>

              <footer>
                <span>El UID se usa solo para seleccionar el registro local. No concede permisos ni abre puertas.</span>
              </footer>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
