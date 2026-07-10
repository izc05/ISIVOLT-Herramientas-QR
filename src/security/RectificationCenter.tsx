import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  History,
  RotateCcw,
  Search,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import type { AppData, Movement, ToolStatus } from '../domain/types';
import { loadAppData } from '../services/storage';
import { hasPermission } from './permissions';
import { rectifyMovement } from './rectificationService';
import { getCurrentSecurityUser } from './session';

const statusLabel: Record<ToolStatus, string> = {
  available: 'Disponible',
  loaned: 'Prestada',
  review: 'En revisión',
  damaged: 'Averiada',
  retired: 'Baja',
};

const movementLabel: Record<Movement['type'], string> = {
  delivery: 'Entrega',
  return: 'Devolución',
  incident: 'Incidencia',
  adjustment: 'Rectificación',
};

export default function RectificationCenter() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [allowed, setAllowed] = useState(() => hasPermission('audit.view'));
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Movement | null>(null);
  const [nextStatus, setNextStatus] = useState<ToolStatus>('available');
  const [technicianId, setTechnicianId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const refreshPermission = () => setAllowed(hasPermission('audit.view'));
    const refreshData = () => setData(loadAppData());
    window.addEventListener('isivolt:security-session', refreshPermission);
    window.addEventListener('isivolt:data-updated', refreshData);
    return () => {
      window.removeEventListener('isivolt:security-session', refreshPermission);
      window.removeEventListener('isivolt:data-updated', refreshData);
    };
  }, []);

  const movements = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.movements
      .filter((movement) => {
        const tool = data.tools.find((item) => item.id === movement.toolId);
        const technician = data.technicians.find((item) => item.id === movement.technicianId);
        return [
          movement.id,
          movementLabel[movement.type],
          tool?.code ?? '',
          tool?.name ?? '',
          technician?.name ?? '',
          movement.operatorName,
        ].some((value) => value.toLowerCase().includes(normalized));
      })
      .slice(0, 250);
  }, [data, query]);

  const startRectification = (movement: Movement) => {
    const tool = data.tools.find((item) => item.id === movement.toolId);
    setSelected(movement);
    setNextStatus(tool?.status ?? movement.nextStatus);
    setTechnicianId(tool?.holderTechnicianId ?? movement.technicianId ?? '');
    setNotes('');
    setError('');
  };

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const next = await rectifyMovement({
        originalMovementId: selected.id,
        nextStatus,
        technicianId: nextStatus === 'loaned' ? technicianId : undefined,
        notes,
      });
      setData(next);
      setSelected(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido registrar la rectificación.');
    } finally {
      setBusy(false);
    }
  };

  if (!allowed || !getCurrentSecurityUser()) return null;

  return (
    <>
      <motion.button className="rectification-launcher" onClick={() => { setData(loadAppData()); setOpen(true); }} whileTap={{ scale: 0.9 }} aria-label="Abrir rectificaciones">
        <History size={19} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div className="rectification-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="rectification-center" initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 25, scale: 0.97 }}>
              <header><div><RotateCcw size={23} /><span><small>Historial inmutable</small><strong>Rectificaciones</strong></span></div><button onClick={() => setOpen(false)}><X size={21} /></button></header>
              <label className="rectification-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Movimiento, herramienta, técnico…" /></label>
              <p className="rectification-info"><ShieldCheck size={17} /> El movimiento original no se modifica. La corrección crea un ajuste nuevo enlazado al registro anterior.</p>
              <main>
                {movements.map((movement) => {
                  const tool = data.tools.find((item) => item.id === movement.toolId);
                  const technician = data.technicians.find((item) => item.id === movement.technicianId);
                  const rectified = data.movements.some((item) => item.reversedMovementId === movement.id);
                  return (
                    <button key={movement.id} className={rectified ? 'rectified' : ''} onClick={() => !rectified && startRectification(movement)} disabled={rectified}>
                      <span><Wrench size={18} /></span>
                      <div><small>{tool?.code ?? 'Sin código'} · {movementLabel[movement.type]}</small><strong>{tool?.name ?? 'Herramienta no disponible'}</strong><p>{technician?.name ?? 'Almacén'} · {movement.operatorName}</p><time>{new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(movement.occurredAt))}</time></div>
                      <b>{rectified ? 'Rectificado' : `${statusLabel[movement.previousStatus]} → ${statusLabel[movement.nextStatus]}`}</b>
                    </button>
                  );
                })}
              </main>
            </motion.section>
          </motion.div>
        )}

        {selected && (
          <motion.div className="rectification-editor-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)}>
            <motion.section className="rectification-editor" initial={{ y: 50, scale: 0.94 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, scale: 0.97 }} onClick={(event) => event.stopPropagation()}>
              <header><div><ClipboardCheck size={22} /><span><small>Nuevo ajuste inmutable</small><strong>Rectificar movimiento</strong></span></div><button onClick={() => setSelected(null)}><X size={20} /></button></header>
              <div className="rectification-editor-body">
                <label>Estado correcto<select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as ToolStatus)}>{Object.entries(statusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                {nextStatus === 'loaned' && <label>Técnico responsable<select value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}><option value="">Selecciona técnico</option>{data.technicians.filter((item) => item.active).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
                <label>Motivo y resultado<textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Describe el error original y la corrección aplicada…" /></label>
                {error && <p className="rectification-error"><AlertTriangle size={17} /> {error}</p>}
              </div>
              <footer><button onClick={() => setSelected(null)}>Cancelar</button><button className="rectification-save" onClick={() => { void save(); }} disabled={busy}><Check size={18} /> {busy ? 'Guardando…' : 'Registrar rectificación'}</button></footer>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
