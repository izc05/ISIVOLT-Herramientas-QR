import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  KeyRound,
  Mail,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { AppData, Technician } from '../../domain/types';
import { createManagedTechnician, getManagementData, saveManagedTechnician } from '../management/managementService';
import { getCentralSyncClient } from '../../services/centralSync/client';
import { getCentralSyncConfig } from '../../services/centralSync/config';

type TechnicianAccount = {
  id: string;
  email: string;
  name: string;
  technicianId: string;
  active: boolean;
  verified: boolean;
};

type AccountListResponse = { accounts: TechnicianAccount[] };
type AccountSaveResponse = { ok: boolean; account: TechnicianAccount; created: boolean };

const normalize = (value: string) => value.trim().toLocaleLowerCase('es-ES');

export default function TechnicianAccountManager() {
  const config = useMemo(() => getCentralSyncConfig(), []);
  const client = useMemo(() => getCentralSyncClient(), []);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AppData>(() => getManagementData());
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Technician | null>(null);
  const [accounts, setAccounts] = useState<TechnicianAccount[]>([]);
  const [password, setPassword] = useState('');
  const [accountActive, setAccountActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const remoteRole = String(client?.authStore.record?.role ?? '');
  const canManageRemoteAccounts = Boolean(config.enabled && client?.authStore.isValid && remoteRole === 'admin');

  const loadAccounts = async () => {
    if (!canManageRemoteAccounts || !client || !config.workspaceId) {
      setAccounts([]);
      return;
    }
    try {
      const response = await client.send<AccountListResponse>(
        `/api/isivolt/technician-accounts?workspace=${encodeURIComponent(config.workspaceId)}`,
        { method: 'GET' },
      );
      setAccounts(response.accounts ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se han podido consultar las cuentas técnicas.');
    }
  };

  const openManager = (technicianId?: string) => {
    const next = getManagementData();
    setData(next);
    setQuery('');
    setError('');
    setNotice('');
    setOpen(true);
    setDraft(technicianId ? next.technicians.find((item) => item.id === technicianId) ?? null : null);
    void loadAccounts();
  };

  useEffect(() => {
    const openFromEvent = (event: Event) => openManager((event as CustomEvent<string | undefined>).detail);
    window.addEventListener('isivolt:technician-account-manager-open', openFromEvent);
    return () => window.removeEventListener('isivolt:technician-account-manager-open', openFromEvent);
  });

  useEffect(() => {
    let frame: number | null = null;
    const decorateCards = () => {
      frame = null;
      const current = getManagementData();
      document.querySelectorAll<HTMLElement>('.technician-card').forEach((card) => {
        if (card.querySelector('.rc43-technician-edit')) return;
        const code = card.querySelector<HTMLElement>('.tool-code')?.textContent?.trim();
        const name = card.querySelector('h3')?.textContent?.trim();
        const technician = current.technicians.find((item) => item.code === code || normalize(item.name) === normalize(name ?? ''));
        if (!technician) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'rc43-technician-edit';
        button.setAttribute('aria-label', `Editar ${technician.name}`);
        button.innerHTML = '<span>Editar</span>';
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          window.dispatchEvent(new CustomEvent('isivolt:technician-account-manager-open', { detail: technician.id }));
        });
        card.appendChild(button);
      });
    };
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(decorateCards);
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

  const selectedAccount = draft ? accounts.find((item) => item.technicianId === draft.id) : undefined;

  useEffect(() => {
    setPassword('');
    setAccountActive(selectedAccount?.active ?? true);
    setError('');
    setNotice('');
  }, [draft?.id, selectedAccount?.id]);

  const filtered = data.technicians.filter((technician) => [
    technician.name,
    technician.code,
    technician.specialty,
    technician.role ?? '',
    technician.email ?? '',
  ].some((value) => normalize(value).includes(normalize(query))));

  const patch = <K extends keyof Technician>(key: K, value: Technician[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const saveTechnician = () => {
    if (!draft) return;
    try {
      setError('');
      const next = saveManagedTechnician(draft);
      const saved = next.technicians.find((item) => item.id === draft.id) ?? draft;
      setData(next);
      setDraft(saved);
      setNotice('Ficha del técnico guardada correctamente.');
      window.dispatchEvent(new CustomEvent('isivolt:app-refresh'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido guardar el técnico.');
    }
  };

  const saveAccount = async () => {
    if (!draft || !client || !config.workspaceId || !canManageRemoteAccounts) return;
    const email = draft.email?.trim().toLocaleLowerCase('es-ES') ?? '';
    if (!email) {
      setError('Escribe el correo del técnico antes de crear su cuenta.');
      return;
    }
    if (!selectedAccount && password.length < 8) {
      setError('La cuenta nueva necesita una contraseña temporal de al menos 8 caracteres.');
      return;
    }
    if (password && password.length < 8) {
      setError('La contraseña debe contener al menos 8 caracteres.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      saveTechnician();
      const response = await client.send<AccountSaveResponse>('/api/isivolt/technician-account', {
        method: 'POST',
        body: {
          workspaceId: config.workspaceId,
          technicianId: draft.id,
          email,
          password,
          name: draft.name,
          active: accountActive,
        },
      });
      setPassword('');
      setNotice(response.created
        ? 'Cuenta creada. Entrega al técnico el correo y la contraseña temporal por un canal seguro.'
        : 'Cuenta técnica actualizada correctamente.');
      await loadAccounts();
      window.dispatchEvent(new CustomEvent('isivolt:central-account-changed'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido guardar la cuenta técnica.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="technician-account-manager-launcher" type="button" onClick={() => openManager()} aria-label="Abrir técnicos y cuentas">
        <Users size={18} /> Técnicos y cuentas
      </button>

      {open && (
        <div className="technician-account-backdrop" onClick={() => setOpen(false)}>
          <section className="technician-account-center" role="dialog" aria-modal="true" aria-label="Técnicos y cuentas" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span><Users size={24} /></span><div><small>Administración</small><h2>Técnicos y cuentas</h2><p>Edita cualquier dato y vincula el acceso por correo.</p></div></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={21} /></button>
            </header>

            <div className="technician-account-layout">
              <aside>
                <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar técnico…" /></label>
                <button className="technician-account-new" type="button" onClick={() => setDraft(createManagedTechnician())}><Plus size={17} /> Nuevo técnico</button>
                <div className="technician-account-list">
                  {filtered.map((technician) => {
                    const account = accounts.find((item) => item.technicianId === technician.id);
                    return (
                      <button type="button" key={technician.id} className={draft?.id === technician.id ? 'active' : ''} onClick={() => setDraft(technician)}>
                        <span>{technician.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
                        <div><strong>{technician.name}</strong><small>{technician.code} · {technician.specialty}</small><em>{account ? `${account.email} · ${account.active ? 'cuenta activa' : 'cuenta inactiva'}` : 'Sin cuenta central'}</em></div>
                        <Pencil size={16} />
                      </button>
                    );
                  })}
                </div>
              </aside>

              <main>
                {!draft ? (
                  <div className="technician-account-empty"><UserRound size={38} /><strong>Selecciona un técnico</strong><span>Podrás modificar su ficha y crear su cuenta de acceso.</span></div>
                ) : (
                  <>
                    <section className="technician-account-form">
                      <div className="technician-account-section-heading"><div><UserCog size={20} /><span><small>Ficha profesional</small><strong>Datos del técnico</strong></span></div><i className={draft.active ? 'active' : ''}>{draft.active ? 'Activo' : 'Inactivo'}</i></div>
                      <div className="technician-account-grid">
                        <label><span>Código</span><input value={draft.code} onChange={(event) => patch('code', event.target.value.toUpperCase())} /></label>
                        <label className="wide"><span>Nombre y apellidos</span><input value={draft.name} onChange={(event) => patch('name', event.target.value)} /></label>
                        <label><span>Especialidad</span><input value={draft.specialty} onChange={(event) => patch('specialty', event.target.value)} /></label>
                        <label><span>Cargo</span><input value={draft.role ?? ''} onChange={(event) => patch('role', event.target.value || undefined)} /></label>
                        <label><span>Teléfono</span><input inputMode="tel" value={draft.phone ?? ''} onChange={(event) => patch('phone', event.target.value || undefined)} /></label>
                        <label><span>Extensión</span><input inputMode="numeric" value={draft.extension ?? ''} onChange={(event) => patch('extension', event.target.value || undefined)} /></label>
                        <label className="wide"><span>Correo</span><input type="email" value={draft.email ?? ''} onChange={(event) => patch('email', event.target.value || undefined)} /></label>
                        <label className="technician-account-toggle wide"><input type="checkbox" checked={draft.active} onChange={(event) => patch('active', event.target.checked)} /><span>Técnico activo y disponible para operaciones</span></label>
                      </div>
                      <button className="technician-account-primary" type="button" onClick={saveTechnician}><Check size={18} /> Guardar ficha</button>
                    </section>

                    <section className="technician-account-remote">
                      <div className="technician-account-section-heading"><div><KeyRound size={20} /><span><small>Mini PC PocketBase</small><strong>Cuenta personal</strong></span></div>{selectedAccount && <i className={selectedAccount.active ? 'active' : ''}>{selectedAccount.active ? 'Creada' : 'Desactivada'}</i>}</div>
                      {!config.enabled ? (
                        <p className="technician-account-info"><ShieldCheck size={18} /> El mini PC todavía no está configurado en esta instalación. La ficha sí puede editarse y la cuenta se creará al conectarlo.</p>
                      ) : !client?.authStore.isValid ? (
                        <p className="technician-account-info"><Mail size={18} /> Inicia sesión en <strong>Más → Cuenta y seguridad</strong> con una cuenta administradora.</p>
                      ) : remoteRole !== 'admin' ? (
                        <p className="technician-account-info"><AlertTriangle size={18} /> Solo un administrador puede crear o modificar cuentas de técnicos.</p>
                      ) : (
                        <div className="technician-account-grid">
                          <label className="wide"><span>Correo de acceso</span><input type="email" value={draft.email ?? ''} onChange={(event) => patch('email', event.target.value || undefined)} /></label>
                          <label className="wide"><span>{selectedAccount ? 'Nueva contraseña (opcional)' : 'Contraseña temporal'}</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={selectedAccount ? 'Vacío para conservarla' : 'Mínimo 8 caracteres'} /></label>
                          <label className="technician-account-toggle wide"><input type="checkbox" checked={accountActive} onChange={(event) => setAccountActive(event.target.checked)} /><span>Cuenta central activa</span></label>
                          <button className="technician-account-primary wide" type="button" onClick={() => { void saveAccount(); }} disabled={busy}><KeyRound size={18} /> {busy ? 'Guardando…' : selectedAccount ? 'Actualizar cuenta' : 'Crear cuenta técnica'}</button>
                        </div>
                      )}
                      <p className="technician-account-explanation">Al iniciar sesión con esta cuenta, la aplicación reconocerá automáticamente al técnico. Solo tendrá que escanear las herramientas que retira o devuelve.</p>
                    </section>

                    {error && <p className="technician-account-error"><AlertTriangle size={17} /> {error}</p>}
                    {notice && <p className="technician-account-notice"><Check size={17} /> {notice}</p>}
                  </>
                )}
              </main>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
