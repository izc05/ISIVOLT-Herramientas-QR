import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Info,
  ListFilter,
  ScanLine,
  Search,
  Smartphone,
  Unlink,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import type { AppData, Technician, Tool } from '../../domain/types';
import { assertPermission, hasPermission } from '../../security/permissions';
import { isNfcScannerAvailable, normalizeNfcUid, scanNfcTag } from '../../services/nfcScanner';
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

const entityKey = (mode: EntityMode, id: string) => `${mode}:${id}`;

export default function NfcManagementCenter() {
  const [allowed, setAllowed] = useState(() => hasPermission('inventory.manage') || hasPermission('technicians.manage'));
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<EntityMode>('tool');
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [query, setQuery] = useState('');
  const [showPendingOnly, setShowPendingOnly] = useState(true);
  const [sessionLinkedKeys, setSessionLinkedKeys] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const nativeReader = isNfcScannerAvailable();

  useEffect(() => {
    const refresh = () => setAllowed(hasPermission('inventory.manage') || hasPermission('technicians.manage'));
    window.addEventListener('isivolt:security-session', refresh);
    return () => window.removeEventListener('isivolt:security-session', refresh);
  }, []);

  const allEntities = useMemo<SelectableEntity[]>(() => {
    const source: SelectableEntity[] = mode === 'technician' ? data.technicians : data.tools;
    return source
      .filter((entity) => entity.active !== false)
      .sort((a, b) => {
        const linkedDifference = Number(Boolean(a.nfcUid)) - Number(Boolean(b.nfcUid));
        if (linkedDifference !== 0) return linkedDifference;
        return a.name.localeCompare(b.name, 'es');
      });
  }, [data, mode]);

  const entities = useMemo<SelectableEntity[]>(() => {
    const needle = normalizeSearch(query);
    return allEntities
      .filter((entity) => !showPendingOnly || !entity.nfcUid)
      .filter((entity) => !needle || [
        entity.name,
        entity.code,
        'specialty' in entity ? entity.specialty : entity.category,
        entity.nfcUid ?? '',
      ].some((value) => normalizeSearch(value).includes(needle)));
  }, [allEntities, query, showPendingOnly]);

  const linkedCount = allEntities.filter((entity) => Boolean(entity.nfcUid)).length;
  const pendingCount = allEntities.length - linkedCount;
  const sessionLinkedCount = sessionLinkedKeys.filter((key) => key.startsWith(`${mode}:`)).length;

  const openCenter = () => {
    setData(loadAppData());
    setMode('tool');
    setQuery('');
    setShowPendingOnly(true);
    setSessionLinkedKeys([]);
    setFeedback(null);
    setOpen(true);
  };

  const changeMode = (nextMode: EntityMode) => {
    setMode(nextMode);
    setQuery('');
    setShowPendingOnly(true);
    setFeedback(null);
  };

  const ensureUniqueUid = (
    snapshot: AppData,
    uid: string,
    targetMode: EntityMode,
    entityId: string,
  ) => {
    const technicianConflict = snapshot.technicians.find(
      (item) => !(targetMode === 'technician' && item.id === entityId)
        && normalizeNfcUid(item.nfcUid) === uid,
    );
    if (technicianConflict) return `La tarjeta ya pertenece al técnico ${technicianConflict.name}.`;

    const toolConflict = snapshot.tools.find(
      (item) => !(targetMode === 'tool' && item.id === entityId)
        && normalizeNfcUid(item.nfcUid) === uid,
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

    if (entity.nfcUid && !window.confirm(
      `${entity.name} ya tiene el UID ${shortUid(entity.nfcUid)}. ¿Quieres sustituirlo por otra etiqueta?`,
    )) return;

    setBusyId(entity.id);
    setFeedback({
      tone: 'warning',
      text: nativeReader
        ? `Acerca ahora la etiqueta que vas a pegar en ${entity.name}.`
        : 'Modo web de prueba: introduce el UID impreso o leído por un dispositivo NFC.',
    });
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
    const conflict = ensureUniqueUid(current, uid, mode, entity.id);
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
    setSessionLinkedKeys((currentKeys) => {
      const key = entityKey(mode, entity.id);
      return currentKeys.includes(key) ? currentKeys : [...currentKeys, key];
    });
    setBusyId(null);
    setFeedback({
      tone: 'success',
      text: `${entity.name} vinculado al UID ${shortUid(uid)}. Ya puedes pegar esa etiqueta en la herramienta.`,
    });
  };

  const unlinkEntity = (entity: SelectableEntity) => {
    try {
      assertPermission(mode === 'technician' ? 'technicians.manage' : 'inventory.manage');
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'No tienes permiso para desvincular NFC.' });
      return;
    }

    if (!window.confirm(`¿Desvincular el NFC de ${entity.name}? La etiqueta quedará libre para otro registro.`)) return;

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
    setSessionLinkedKeys((currentKeys) => currentKeys.filter((key) => key !== entityKey(mode, entity.id)));
    setFeedback({ tone: 'success', text: `${entity.name} ya no tiene una identificación NFC asociada.` });
  };

  if (!allowed) return null;

  const guideTitle = mode === 'tool' ? 'Registro en lote de etiquetas NFC' : 'Vinculación de tarjetas de técnicos';
  const guideCopy = mode === 'tool'
    ? 'Trabaja una herramienta cada vez: localízala, pulsa Vincular, lee una etiqueta sin usar y pégala únicamente después de ver la confirmación verde.'
    : 'Busca al técnico, pulsa Vincular y acerca su tarjeta NFC al móvil. La tarjeta quedará asociada únicamente a su ficha.';

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
                <div><span><ScanLine size={24} /></span><div><small>Identificación rápida</small><h2>Tarjetas y etiquetas NFC</h2><p>Asocia un UID único a cada herramienta o técnico.</p></div></div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={21} /></button>
              </header>

              <div className="nfc-management-tabs">
                <button type="button" className={mode === 'tool' ? 'active' : ''} onClick={() => changeMode('tool')}><Wrench size={18} /> Herramientas</button>
                <button type="button" className={mode === 'technician' ? 'active' : ''} onClick={() => changeMode('technician')}><UserRound size={18} /> Técnicos</button>
              </div>

              <aside className="nfc-management-guide">
                <Info size={20} />
                <div>
                  <strong>{guideTitle}</strong>
                  <span>{guideCopy}</span>
                  <small><Smartphone size={13} /> {nativeReader ? 'Lector Android disponible. Mantén la etiqueta quieta hasta recibir la confirmación.' : 'En el PC se permite introducir un UID manual para pruebas. La lectura física se hará desde la app Android.'}</small>
                </div>
              </aside>

              <div className="nfc-management-summary nfc-batch-summary">
                <div className="nfc-management-counts">
                  <span>{allEntities.length} registros</span>
                  <span>{linkedCount} vinculados</span>
                  <span>{pendingCount} pendientes</span>
                </div>
                <div className="nfc-batch-session" aria-label={`${sessionLinkedCount} vinculaciones realizadas en esta sesión`}>
                  <CheckCircle2 size={18} />
                  <strong>{sessionLinkedCount}</strong>
                  <small>en esta sesión</small>
                </div>
                <button
                  className={showPendingOnly ? 'active' : ''}
                  type="button"
                  onClick={() => setShowPendingOnly((current) => !current)}
                  aria-pressed={showPendingOnly}
                >
                  <ListFilter size={16} /> {showPendingOnly ? 'Solo pendientes' : 'Mostrar pendientes'}
                </button>
              </div>

              {pendingCount === 0 && mode === 'tool' && (
                <div className="nfc-batch-complete">
                  <CheckCircle2 size={20} />
                  <div><strong>Todas las herramientas activas tienen NFC</strong><span>Puedes desactivar el filtro para revisar o cambiar una vinculación.</span></div>
                </div>
              )}

              <label className="nfc-management-search">
                <Search size={18} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === 'tool' ? 'Buscar herramienta, código, categoría o UID…' : 'Buscar técnico, código, especialidad o UID…'} />
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
                  const linkedNow = sessionLinkedKeys.includes(entityKey(mode, entity.id));
                  const detail = 'specialty' in entity ? entity.specialty : `${entity.category} · ${entity.location}`;
                  return (
                    <article key={entity.id} className={`${linked ? 'linked' : ''} ${linkedNow ? 'linked-now' : ''}`}>
                      <span>{mode === 'technician' ? <UserRound size={20} /> : <Wrench size={20} />}</span>
                      <div><strong>{entity.name}</strong><small>{entity.code} · {detail}</small><em>{linkedNow ? `Vinculada ahora · NFC ${shortUid(entity.nfcUid)}` : linked ? `NFC ${shortUid(entity.nfcUid)}` : 'NFC pendiente'}</em></div>
                      <button type="button" disabled={busyId === entity.id} onClick={() => { void linkEntity(entity); }}>
                        <ScanLine size={17} /> {busyId === entity.id ? 'Leyendo…' : linked ? 'Cambiar' : 'Vincular'}
                      </button>
                      {linked && <button className="unlink" type="button" onClick={() => unlinkEntity(entity)} aria-label={`Desvincular NFC de ${entity.name}`}><Unlink size={17} /></button>}
                    </article>
                  );
                })}
                {entities.length === 0 && (
                  <div className="nfc-management-empty">
                    <ScanLine size={30} />
                    <strong>{showPendingOnly && pendingCount === 0 ? 'No quedan registros pendientes' : 'No hay resultados'}</strong>
                    <span>{showPendingOnly && pendingCount === 0 ? 'Desactiva Solo pendientes para revisar las vinculaciones.' : 'Cambia la búsqueda o el filtro.'}</span>
                  </div>
                )}
              </main>

              <footer>
                <span>La aplicación lee el UID de la etiqueta; no necesita escribir datos en ella. Un mismo UID no puede pertenecer a dos registros.</span>
              </footer>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
