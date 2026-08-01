import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clipboard,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import {
  getCloudProfile,
  getPocketBaseToken,
  getPocketBaseUrl,
  type CloudProfile,
} from '../cloud/config';
import {
  createRecord,
  deleteRecord,
  listRecords,
  PocketBaseRequestError,
  type PocketBaseRecord,
  updateRecord,
} from '../cloud/pocketbaseClient';
import type { AppData } from '../types';

type ManagedRole = 'coordinator' | 'technician';

type ManagedAccount = {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | ManagedRole;
  technicianExternalId?: string;
  active: boolean;
  updated?: string;
};

type AccountAdminProps = {
  data: AppData;
  onMessage(message: string): void;
};

type AccountDraft = {
  displayName: string;
  role: ManagedRole;
  technicianExternalId: string;
  active: boolean;
};

const roleLabel = (role: ManagedAccount['role']) => (
  role === 'admin' ? 'Administrador' : role === 'coordinator' ? 'Coordinador' : 'Técnico'
);

const accountFromRecord = (record: PocketBaseRecord): ManagedAccount => ({
  id: record.id,
  email: String(record.email ?? ''),
  displayName: String(record.display_name ?? record.email ?? 'Usuario IsiVoltPro'),
  role: record.role === 'admin' || record.role === 'coordinator' ? record.role : 'technician',
  technicianExternalId: record.technician_external_id ? String(record.technician_external_id) : undefined,
  active: record.active !== false,
  updated: typeof record.updated === 'string' ? record.updated : undefined,
});

const generatePassword = (): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_';
  const bytes = new Uint32Array(18);
  globalThis.crypto.getRandomValues(bytes);
  const random = [...bytes].map((value) => alphabet[value % alphabet.length]).join('');
  return `Ivp!${random}`;
};

const readableError = (error: unknown): string => {
  if (error instanceof PocketBaseRequestError) {
    if (error.status === 0) return 'No se puede conectar con PocketBase.';
    if (error.status === 403) return 'La cuenta no tiene permiso para gestionar usuarios.';
    if (error.status === 400) return 'PocketBase ha rechazado los datos. Revisa correo, contraseña y técnico vinculado.';
    return error.message;
  }
  return error instanceof Error ? error.message : 'No se ha podido completar la operación.';
};

export default function AccountAdmin({ data, onMessage }: AccountAdminProps) {
  const [profile] = useState<CloudProfile | null>(() => getCloudProfile());
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<AccountDraft | null>(null);
  const [createEmail, setCreateEmail] = useState('');
  const [createName, setCreateName] = useState('');
  const [createRole, setCreateRole] = useState<ManagedRole>('technician');
  const [createTechnicianId, setCreateTechnicianId] = useState('');
  const [createPassword, setCreatePassword] = useState(generatePassword);
  const [issuedCredential, setIssuedCredential] = useState<{ email: string; password: string } | null>(null);

  const connected = Boolean(profile?.role === 'admin' && getPocketBaseUrl() && getPocketBaseToken());
  const selected = accounts.find((account) => account.id === selectedId) ?? null;
  const manageableAccounts = accounts.filter((account) => account.role !== 'admin');
  const activeTechnicians = useMemo(
    () => [...data.technicians].filter((technician) => technician.active).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [data.technicians],
  );
  const usedTechnicianIds = useMemo(
    () => new Set(accounts.filter((account) => account.id !== selectedId).map((account) => account.technicianExternalId).filter(Boolean)),
    [accounts, selectedId],
  );

  const refresh = async () => {
    if (!profile || profile.role !== 'admin') return;
    setLoading(true);
    setError('');
    try {
      const records = await listRecords('isivolt_users', profile.workspace);
      const next = records.map(accountFromRecord).sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (b.role === 'admin' && a.role !== 'admin') return 1;
        return a.displayName.localeCompare(b.displayName, 'es');
      });
      setAccounts(next);
      if (selectedId && !next.some((account) => account.id === selectedId)) setSelectedId('');
    } catch (loadError) {
      setError(readableError(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!selected || selected.role === 'admin') {
      setDraft(null);
      return;
    }
    setDraft({
      displayName: selected.displayName,
      role: selected.role,
      technicianExternalId: selected.technicianExternalId ?? '',
      active: selected.active,
    });
  }, [selected]);

  const validateRoleLink = (role: ManagedRole, technicianId: string): string | null => {
    if (role === 'technician' && !technicianId) return 'Selecciona la ficha del técnico.';
    if (role === 'technician' && usedTechnicianIds.has(technicianId)) return 'La ficha ya está vinculada a otra cuenta.';
    return null;
  };

  const createAccount = async () => {
    if (!profile || profile.role !== 'admin') return;
    const email = createEmail.trim().toLowerCase();
    const displayName = createName.trim();
    const technicianId = createRole === 'technician' ? createTechnicianId : '';
    const roleError = validateRoleLink(createRole, technicianId);
    if (!email || !displayName) {
      setError('Indica correo y nombre visible.');
      return;
    }
    if (createPassword.length < 10) {
      setError('La contraseña debe tener al menos 10 caracteres.');
      return;
    }
    if (roleError) {
      setError(roleError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await createRecord('isivolt_users', {
        email,
        password: createPassword,
        passwordConfirm: createPassword,
        display_name: displayName,
        role: createRole,
        workspace: profile.workspace,
        technician_external_id: technicianId,
        active: true,
      });
      setIssuedCredential({ email, password: createPassword });
      setCreateEmail('');
      setCreateName('');
      setCreateTechnicianId('');
      setCreatePassword(generatePassword());
      onMessage(`Cuenta ${email} creada correctamente.`);
      await refresh();
    } catch (createError) {
      setError(readableError(createError));
    } finally {
      setLoading(false);
    }
  };

  const saveAccount = async () => {
    if (!selected || selected.role === 'admin' || !draft) return;
    const technicianId = draft.role === 'technician' ? draft.technicianExternalId : '';
    const roleError = validateRoleLink(draft.role, technicianId);
    if (!draft.displayName.trim()) {
      setError('El nombre visible es obligatorio.');
      return;
    }
    if (roleError) {
      setError(roleError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await updateRecord('isivolt_users', selected.id, {
        display_name: draft.displayName.trim(),
        role: draft.role,
        technician_external_id: technicianId,
        active: draft.active,
      });
      onMessage(`Cuenta ${selected.email} actualizada.`);
      await refresh();
    } catch (updateError) {
      setError(readableError(updateError));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!selected || selected.role === 'admin' || !draft) return;
    const password = generatePassword();
    const technicianId = draft.role === 'technician' ? draft.technicianExternalId : '';
    setLoading(true);
    setError('');
    try {
      await updateRecord('isivolt_users', selected.id, {
        display_name: draft.displayName.trim(),
        role: draft.role,
        technician_external_id: technicianId,
        active: draft.active,
        password,
        passwordConfirm: password,
      });
      setIssuedCredential({ email: selected.email, password });
      onMessage(`Contraseña de ${selected.email} restablecida.`);
    } catch (resetError) {
      setError(readableError(resetError));
    } finally {
      setLoading(false);
    }
  };

  const removeAccount = async () => {
    if (!selected || selected.role === 'admin') return;
    const confirmed = window.confirm(`¿Eliminar la cuenta ${selected.email}? La ficha del técnico y su historial no se borrarán.`);
    if (!confirmed) return;
    setLoading(true);
    setError('');
    try {
      await deleteRecord('isivolt_users', selected.id);
      setSelectedId('');
      onMessage(`Cuenta ${selected.email} eliminada.`);
      await refresh();
    } catch (deleteError) {
      setError(readableError(deleteError));
    } finally {
      setLoading(false);
    }
  };

  const copyCredential = async () => {
    if (!issuedCredential) return;
    await navigator.clipboard.writeText(`Usuario: ${issuedCredential.email}\nContraseña temporal: ${issuedCredential.password}`);
    onMessage('Credenciales copiadas. Entrégalas mediante un canal seguro.');
  };

  if (!connected) {
    return <div className="account-admin-empty"><ShieldCheck size={40} /><h3>Conecta una cuenta administradora</h3><p>La gestión de usuarios aparecerá cuando PocketBase esté configurado y la sesión tenga rol administrador.</p></div>;
  }

  return (
    <div className="account-admin">
      <section className="account-create-card">
        <header><span><UserPlus size={22} /></span><div><h3>Nueva cuenta</h3><p>Crea técnicos y coordinadores dentro de {profile?.workspace}.</p></div></header>
        <div className="account-form-grid">
          <label>Nombre visible<input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Nombre y apellidos" /></label>
          <label>Correo<input type="email" value={createEmail} onChange={(event) => setCreateEmail(event.target.value)} placeholder="tecnico@empresa.es" /></label>
          <label>Rol<select value={createRole} onChange={(event) => { const role = event.target.value as ManagedRole; setCreateRole(role); if (role === 'coordinator') setCreateTechnicianId(''); }}><option value="technician">Técnico</option><option value="coordinator">Coordinador</option></select></label>
          <label>Ficha vinculada<select value={createTechnicianId} onChange={(event) => setCreateTechnicianId(event.target.value)} disabled={createRole !== 'technician'}><option value="">Selecciona un técnico</option>{activeTechnicians.map((technician) => <option key={technician.id} value={technician.id} disabled={usedTechnicianIds.has(technician.id)}>{technician.code} · {technician.name}{usedTechnicianIds.has(technician.id) ? ' · ya vinculada' : ''}</option>)}</select></label>
          <label className="account-password-field">Contraseña temporal<div><input value={createPassword} onChange={(event) => setCreatePassword(event.target.value)} /><button type="button" onClick={() => setCreatePassword(generatePassword())}><RefreshCw size={16} /> Generar</button></div></label>
        </div>
        <button className="admin-primary" type="button" disabled={loading} onClick={() => void createAccount()}>{loading ? <LoaderCircle className="cloud-spin" size={18} /> : <UserPlus size={18} />} Crear cuenta</button>
      </section>

      <section className="account-list-card">
        <header><span><UsersRound size={22} /></span><div><h3>Cuentas del espacio</h3><p>{accounts.length} cuentas · {manageableAccounts.filter((account) => account.active).length} operativas gestionables</p></div><button type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw className={loading ? 'cloud-spin' : ''} size={17} /></button></header>
        <div className="account-list">
          {accounts.map((account) => (
            <button key={account.id} type="button" className={`${selectedId === account.id ? 'selected' : ''} ${account.role === 'admin' ? 'protected' : ''}`} onClick={() => setSelectedId(account.id)}>
              <span><UserCog size={18} /></span><div><strong>{account.displayName}</strong><small>{account.email} · {roleLabel(account.role)}</small></div><em className={account.active ? 'active' : ''}>{account.active ? 'Activa' : 'Inactiva'}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="account-edit-card">
        {!selected ? <div className="account-selection-empty"><UserCog size={38} /><strong>Selecciona una cuenta</strong><p>Podrás cambiar su rol, técnico vinculado, estado o contraseña.</p></div> : selected.role === 'admin' ? <div className="account-protected"><ShieldCheck size={38} /><h3>{selected.displayName}</h3><p>La cuenta administradora principal se protege desde PocketBase y no puede modificarse desde este panel.</p></div> : draft && <>
          <header><span><UserCog size={22} /></span><div><h3>{selected.displayName}</h3><p>{selected.email}</p></div></header>
          <div className="account-form-grid">
            <label>Nombre visible<input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label>
            <label>Rol<select value={draft.role} onChange={(event) => { const role = event.target.value as ManagedRole; setDraft({ ...draft, role, technicianExternalId: role === 'coordinator' ? '' : draft.technicianExternalId }); }}><option value="technician">Técnico</option><option value="coordinator">Coordinador</option></select></label>
            <label>Ficha vinculada<select value={draft.technicianExternalId} onChange={(event) => setDraft({ ...draft, technicianExternalId: event.target.value })} disabled={draft.role !== 'technician'}><option value="">Selecciona un técnico</option>{activeTechnicians.map((technician) => <option key={technician.id} value={technician.id} disabled={usedTechnicianIds.has(technician.id)}>{technician.code} · {technician.name}{usedTechnicianIds.has(technician.id) ? ' · ya vinculada' : ''}</option>)}</select></label>
            <label className="account-active-toggle"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /><span /> Cuenta activa</label>
          </div>
          <div className="account-edit-actions"><button className="admin-primary" type="button" disabled={loading} onClick={() => void saveAccount()}><Check size={17} /> Guardar</button><button type="button" disabled={loading} onClick={() => void resetPassword()}><KeyRound size={17} /> Restablecer clave</button><button className="danger" type="button" disabled={loading} onClick={() => void removeAccount()}><Trash2 size={17} /> Eliminar</button></div>
        </>}
      </section>

      {issuedCredential && <section className="issued-credential"><span><KeyRound size={23} /></span><div><small>CREDENCIAL GENERADA</small><strong>{issuedCredential.email}</strong><code>{issuedCredential.password}</code><p>Esta contraseña solo se mantiene en esta pantalla. El usuario deberá guardarla de forma segura.</p></div><button type="button" onClick={() => void copyCredential()}><Clipboard size={17} /> Copiar</button></section>}
      {error && <p className="account-admin-error">{error}</p>}
    </div>
  );
}
