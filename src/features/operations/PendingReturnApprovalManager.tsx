import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  Clock3,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  UserRound,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { getPendingReturnRequests, reviewPendingReturn } from '../../domain/pendingReturnEngine';
import type { AppData, ReturnCondition } from '../../domain/types';
import { getCurrentOperatorName, getCurrentSecurityUser } from '../../security/session';
import { loadAppData, saveAppData, waitForPendingAppDataWrites } from '../../services/storage';

const formatDate = (value: string) => new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value));

export default function PendingReturnApprovalManager() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [navTarget, setNavTarget] = useState<HTMLElement | null>(null);
  const [conditions, setConditions] = useState<Record<string, ReturnCondition>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyToolId, setBusyToolId] = useState('');
  const [message, setMessage] = useState('');
  const user = getCurrentSecurityUser();
  const isAdmin = user?.active && user.role === 'admin';
  const pending = useMemo(() => getPendingReturnRequests(data), [data]);

  const refresh = () => setData(loadAppData());

  useEffect(() => {
    const sync = () => {
      setNavTarget(document.querySelector<HTMLElement>('.professional-navigation-secondary'));
      refresh();
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('isivolt:data-updated', sync);
    window.addEventListener('isivolt:security-session', sync);
    sync();
    return () => {
      observer.disconnect();
      window.removeEventListener('isivolt:data-updated', sync);
      window.removeEventListener('isivolt:security-session', sync);
    };
  }, []);

  useEffect(() => {
    setConditions((current) => {
      const next = { ...current };
      pending.forEach((request) => {
        next[request.tool.id] ??= request.movement.condition ?? 'ok';
      });
      return next;
    });
  }, [pending]);

  const decide = async (toolId: string, approve: boolean) => {
    if (!isAdmin || busyToolId) return;
    setBusyToolId(toolId);
    setMessage('');
    try {
      const result = reviewPendingReturn(loadAppData(), {
        toolId,
        approve,
        condition: conditions[toolId] ?? 'ok',
        notes: notes[toolId],
        operatorName: getCurrentOperatorName(),
      });
      saveAppData(result.data);
      await waitForPendingAppDataWrites();
      refresh();
      setMessage(approve ? 'Devolución validada correctamente.' : 'Devolución rechazada; la herramienta vuelve a figurar como prestada.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se ha podido revisar la devolución.');
    } finally {
      setBusyToolId('');
    }
  };

  if (!isAdmin) return null;

  const launcher = (
    <button className="rc54-return-launcher" type="button" onClick={() => { refresh(); setOpen(true); }} title="Devoluciones pendientes">
      <span><ClipboardCheck size={19} /></span>
      <span><strong>Devoluciones</strong><small>{pending.length ? `${pending.length} pendiente${pending.length === 1 ? '' : 's'}` : 'Sin pendientes'}</small></span>
      {pending.length > 0 && <b>{pending.length}</b>}
    </button>
  );

  return (
    <>
      {navTarget ? createPortal(launcher, navTarget) : launcher}
      {open && (
        <div className="rc54-return-backdrop" onClick={() => !busyToolId && setOpen(false)}>
          <section className="rc54-return-manager" role="dialog" aria-modal="true" aria-label="Devoluciones pendientes" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span><ClipboardCheck size={25} /></span><div><small>Control de almacén</small><h2>Devoluciones pendientes</h2><p>La herramienta no queda disponible hasta que confirmes su recepción y estado.</p></div></div>
              <button type="button" onClick={() => setOpen(false)} disabled={Boolean(busyToolId)} aria-label="Cerrar"><X size={21} /></button>
            </header>

            <main>
              {pending.length === 0 ? (
                <section className="rc54-return-empty"><ShieldCheck size={42} /><h3>Todo revisado</h3><p>No hay devoluciones pendientes de validación.</p></section>
              ) : pending.map((request) => (
                <article className="rc54-return-card" key={request.tool.id}>
                  <div className="rc54-return-card-title">
                    <span><Wrench size={22} /></span>
                    <div><small>{request.tool.code}</small><h3>{request.tool.name}</h3><p><UserRound size={14} /> {request.technicianName}</p></div>
                    <time><Clock3 size={14} /> {formatDate(request.movement.occurredAt)}</time>
                  </div>
                  <div className="rc54-return-requested">
                    <strong>Estado declarado por el técnico</strong>
                    <span>{request.movement.condition === 'ok' ? 'Correcta' : request.movement.condition === 'review' ? 'Necesita revisión' : 'Averiada'}</span>
                    {request.movement.notes && <p>{request.movement.notes}</p>}
                  </div>
                  <label>Estado confirmado<select value={conditions[request.tool.id] ?? 'ok'} onChange={(event) => setConditions((current) => ({ ...current, [request.tool.id]: event.target.value as ReturnCondition }))}>
                    <option value="ok">Correcta · queda disponible</option>
                    <option value="review">Enviar a revisión</option>
                    <option value="damaged">Marcar como averiada</option>
                  </select></label>
                  <label>Observaciones del administrador<textarea rows={2} value={notes[request.tool.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [request.tool.id]: event.target.value }))} placeholder="Motivo, comprobaciones o incidencia…" /></label>
                  <div className="rc54-return-actions">
                    <button className="reject" type="button" onClick={() => void decide(request.tool.id, false)} disabled={Boolean(busyToolId) || !(notes[request.tool.id] ?? '').trim()}><XCircle size={18} /> Rechazar devolución</button>
                    <button className="approve" type="button" onClick={() => void decide(request.tool.id, true)} disabled={Boolean(busyToolId)}>{busyToolId === request.tool.id ? <LoaderCircle className="boot-spin" size={18} /> : conditions[request.tool.id] === 'ok' ? <Check size={18} /> : conditions[request.tool.id] === 'review' ? <RotateCcw size={18} /> : <AlertTriangle size={18} />} Validar devolución</button>
                  </div>
                </article>
              ))}
            </main>
            {message && <footer>{message}</footer>}
          </section>
        </div>
      )}
    </>
  );
}
