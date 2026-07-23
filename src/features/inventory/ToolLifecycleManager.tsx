import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleOff,
  RotateCcw,
  Settings2,
  ShieldAlert,
  Wrench,
  X,
} from 'lucide-react';
import type { Tool } from '../../domain/types';
import { assertPermission } from '../../security/permissions';
import { getCurrentOperatorName } from '../../security/session';
import { loadAppData, saveAppData } from '../../services/storage';
import {
  applyToolLifecycleAction,
  listToolLifecycleActions,
  resolveToolLifecyclePresentation,
  type ToolLifecycleAction,
} from './toolLifecycle';

const actionIcons = {
  review: Settings2,
  damage: AlertTriangle,
  block: Ban,
  retire: CircleOff,
  reactivate: RotateCcw,
} as const;

const findToolByCode = (code: string) => loadAppData().tools.find((tool) => tool.code === code);

const readSheetTool = (): Tool | null => {
  const sheet = document.querySelector<HTMLElement>('.tool-sheet');
  const code = sheet?.querySelector<HTMLElement>('.tool-sheet-title p')?.textContent?.split('·')[0]?.trim();
  return code ? findToolByCode(code) ?? null : null;
};

const decorateSheet = () => {
  const sheet = document.querySelector<HTMLElement>('.tool-sheet');
  const tool = readSheetTool();
  if (!sheet || !tool) return;

  const lifecycle = resolveToolLifecyclePresentation(tool);
  const status = sheet.querySelector<HTMLElement>('.tool-status-chip');
  if (status) {
    status.classList.remove('status-available', 'status-loaned', 'status-review', 'status-damaged', 'status-retired', 'status-blocked');
    status.classList.add(`status-${lifecycle.key}`);
    const icon = status.querySelector('svg')?.outerHTML ?? '';
    status.innerHTML = `${icon}${lifecycle.label}`;
  }

  const footer = sheet.querySelector<HTMLElement>('.tool-sheet-footer');
  if (!footer || footer.querySelector('.rc36-state-button')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rc36-state-button';
  button.dataset.toolCode = tool.code;
  button.innerHTML = '<span>Gestionar estado</span>';
  footer.insertBefore(button, footer.querySelector('.primary'));
};

export default function ToolLifecycleManager() {
  const [tool, setTool] = useState<Tool | null>(null);
  const [action, setAction] = useState<ToolLifecycleAction | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        decorateSheet();
      });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('isivolt:data-updated', schedule);
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener('isivolt:data-updated', schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.rc36-state-button');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const selected = button.dataset.toolCode ? findToolByCode(button.dataset.toolCode) : readSheetTool();
      if (!selected) return;
      setTool(selected);
      setAction(null);
      setReason('');
      setError('');
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  useEffect(() => {
    const update = () => {
      if (!tool) return;
      const refreshed = loadAppData().tools.find((item) => item.id === tool.id);
      if (refreshed) setTool(refreshed);
    };
    window.addEventListener('isivolt:data-updated', update);
    return () => window.removeEventListener('isivolt:data-updated', update);
  }, [tool]);

  const actions = useMemo(() => tool ? listToolLifecycleActions(tool) : [], [tool]);
  const current = tool ? resolveToolLifecyclePresentation(tool) : null;

  const close = () => {
    setTool(null);
    setAction(null);
    setReason('');
    setError('');
  };

  const apply = () => {
    if (!tool || !action) return;
    setError('');
    try {
      assertPermission('inventory.manage');
      const result = applyToolLifecycleAction(
        loadAppData(),
        tool.id,
        action,
        reason,
        getCurrentOperatorName(),
      );
      saveAppData(result.data);
      const next = resolveToolLifecyclePresentation(result.tool);
      setSavedMessage(`${tool.code}: ${next.label}. Cambio registrado.`);
      window.setTimeout(() => setSavedMessage(''), 2800);
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido cambiar el estado.');
    }
  };

  return (
    <>
      {savedMessage && <div className="rc36-state-toast" role="status"><CheckCircle2 size={19} /><span>{savedMessage}</span></div>}
      {tool && current && (
        <div className="rc36-state-backdrop" onClick={close}>
          <section className="rc36-state-modal" role="dialog" aria-modal="true" aria-label={`Gestionar estado de ${tool.name}`} onClick={(event) => event.stopPropagation()}>
            <header>
              <span><Wrench size={23} /></span>
              <div><small>Gestión del activo</small><h2>{tool.name}</h2><p>{tool.code} · Estado actual: <strong className={`status-${current.key}`}>{current.label}</strong></p></div>
              <button type="button" onClick={close} aria-label="Cerrar"><X size={20} /></button>
            </header>

            {tool.status === 'loaned' ? (
              <div className="rc36-state-warning"><ShieldAlert size={23} /><div><strong>Herramienta prestada</strong><span>Registra primero su devolución antes de cambiar el estado administrativo.</span></div></div>
            ) : (
              <>
                <div className="rc36-state-actions">
                  {actions.map((item) => {
                    const Icon = actionIcons[item.action];
                    return (
                      <button
                        type="button"
                        key={item.action}
                        className={action === item.action ? 'active' : ''}
                        onClick={() => { setAction(item.action); setError(''); }}
                      >
                        <span><Icon size={21} /></span>
                        <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                      </button>
                    );
                  })}
                </div>

                <label className="rc36-state-reason">
                  <span>Motivo del cambio</span>
                  <textarea
                    rows={4}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Ejemplo: revisión preventiva completada, aislamiento dañado, equipo pendiente de calibración…"
                  />
                  <small>El motivo quedará visible en el historial y en el registro técnico.</small>
                </label>
              </>
            )}

            {error && <p className="rc36-state-error"><AlertTriangle size={17} /> {error}</p>}

            <footer>
              <button type="button" onClick={close}>Cancelar</button>
              <button type="button" className="primary" disabled={!action || !reason.trim() || tool.status === 'loaned'} onClick={apply}>
                <CheckCircle2 size={18} /> Confirmar cambio
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
