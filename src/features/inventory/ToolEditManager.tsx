import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CircleDollarSign,
  MapPin,
  Pencil,
  Tag,
  Wrench,
  X,
} from 'lucide-react';
import type { Tool } from '../../domain/types';
import { saveManagedTool } from '../management/managementService';
import { assertPermission } from '../../security/permissions';
import { loadAppData } from '../../services/storage';

const findToolByCode = (code: string) => loadAppData().tools.find((tool) => tool.code === code);

const numberOrUndefined = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const decorateToolSheet = () => {
  const sheet = document.querySelector<HTMLElement>('.tool-sheet');
  const footer = sheet?.querySelector<HTMLElement>('.tool-sheet-footer');
  const code = sheet?.querySelector<HTMLElement>('.tool-sheet-title p')?.textContent?.split('·')[0]?.trim();
  if (!footer || !code || footer.querySelector('.rc36-edit-button')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rc36-edit-button';
  button.dataset.toolCode = code;
  button.innerHTML = '<span>Editar datos</span>';
  footer.insertBefore(button, footer.querySelector('.rc36-state-button, .primary'));
};

export default function ToolEditManager() {
  const [tool, setTool] = useState<Tool | null>(null);
  const [draft, setDraft] = useState<Tool | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        decorateToolSheet();
      });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.rc36-edit-button');
      if (!button?.dataset.toolCode) return;
      event.preventDefault();
      event.stopPropagation();
      const selected = findToolByCode(button.dataset.toolCode);
      if (!selected) return;
      setTool(selected);
      setDraft({ ...selected });
      setError('');
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('rc36-edit-open', Boolean(draft));
    if (!draft) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDraft(null);
        setTool(null);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.body.classList.remove('rc36-edit-open');
    };
  }, [draft]);

  const patch = <K extends keyof Tool>(key: K, value: Tool[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const close = () => {
    setDraft(null);
    setTool(null);
    setError('');
  };

  const save = () => {
    if (!draft) return;
    try {
      assertPermission('inventory.manage');
      const next = saveManagedTool({
        ...draft,
        status: tool?.status ?? draft.status,
        serviceStatus: tool?.serviceStatus ?? draft.serviceStatus,
        active: tool?.active ?? draft.active,
        holderTechnicianId: tool?.holderTechnicianId,
        loanedAt: tool?.loanedAt,
      });
      const updated = next.tools.find((item) => item.id === draft.id);
      setSaved(`${updated?.code ?? draft.code}: ficha actualizada`);
      window.setTimeout(() => setSaved(''), 2600);
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido guardar la herramienta.');
    }
  };

  return (
    <>
      {saved && <div className="rc36-edit-toast" role="status"><Check size={18} /> {saved}</div>}
      {draft && (
        <div className="rc36-edit-backdrop" onClick={close}>
          <section className="rc36-edit-panel" role="dialog" aria-modal="true" aria-label={`Editar ${draft.name}`} onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span><Pencil size={21} /></span><div><small>Edición rápida</small><h2>{draft.name}</h2><p>El estado se gestiona por separado para conservar la auditoría.</p></div></div>
              <button type="button" onClick={close} aria-label="Cerrar"><X size={21} /></button>
            </header>

            <div className="rc36-edit-scroll">
              <section>
                <h3><Tag size={17} /> Identificación</h3>
                <div className="rc36-edit-grid">
                  <label><span>Código</span><input value={draft.code} onChange={(event) => patch('code', event.target.value.toUpperCase())} /></label>
                  <label className="wide"><span>Nombre</span><input value={draft.name} onChange={(event) => patch('name', event.target.value)} /></label>
                  <label><span>Categoría</span><input value={draft.category} onChange={(event) => patch('category', event.target.value)} /></label>
                  <label><span>Ubicación</span><input value={draft.location} onChange={(event) => patch('location', event.target.value)} /></label>
                  <label><span>Marca</span><input value={draft.brand ?? ''} onChange={(event) => patch('brand', event.target.value || undefined)} /></label>
                  <label><span>Modelo</span><input value={draft.model ?? ''} onChange={(event) => patch('model', event.target.value || undefined)} /></label>
                  <label className="wide"><span>Número de serie</span><input value={draft.serialNumber ?? ''} onChange={(event) => patch('serialNumber', event.target.value || undefined)} /></label>
                </div>
              </section>

              <section>
                <h3><CircleDollarSign size={17} /> Compra y control</h3>
                <div className="rc36-edit-grid">
                  <label><span>Fecha de compra</span><input type="date" value={draft.purchaseDate ?? ''} onChange={(event) => patch('purchaseDate', event.target.value || undefined)} /></label>
                  <label><span>Coste (€)</span><input inputMode="decimal" value={draft.purchaseCost ?? ''} onChange={(event) => patch('purchaseCost', numberOrUndefined(event.target.value))} /></label>
                  <label className="wide"><span>Proveedor</span><input value={draft.supplier ?? ''} onChange={(event) => patch('supplier', event.target.value || undefined)} /></label>
                  <label><span>Próxima revisión</span><input type="date" value={draft.nextReviewDate ?? ''} onChange={(event) => patch('nextReviewDate', event.target.value || undefined)} /></label>
                  <label><span>Próxima calibración</span><input type="date" value={draft.nextCalibrationDate ?? ''} onChange={(event) => patch('nextCalibrationDate', event.target.value || undefined)} /></label>
                  <label className="wide"><span>Préstamo máximo (días)</span><input inputMode="numeric" value={draft.maxLoanDays ?? ''} onChange={(event) => patch('maxLoanDays', numberOrUndefined(event.target.value))} /></label>
                </div>
              </section>

              <section>
                <h3><MapPin size={17} /> Observaciones</h3>
                <label className="rc36-edit-notes"><textarea rows={4} value={draft.notes ?? ''} onChange={(event) => patch('notes', event.target.value || undefined)} placeholder="Accesorios, características o instrucciones de uso…" /></label>
              </section>

              <div className="rc36-edit-state-note"><CalendarClock size={19} /><span><strong>Estado protegido</strong><small>{tool?.status ?? draft.status} · Utiliza Gestionar estado para bloquear, revisar, retirar o reactivar.</small></span></div>
              {error && <p className="rc36-edit-error"><AlertTriangle size={17} /> {error}</p>}
            </div>

            <footer>
              <button type="button" onClick={close}>Cancelar</button>
              <button type="button" className="primary" disabled={!draft.code.trim() || !draft.name.trim()} onClick={save}><Check size={18} /> Guardar ficha</button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
