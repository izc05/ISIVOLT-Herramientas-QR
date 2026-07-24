import { useEffect, useState } from 'react';
import {
  CloudCog,
  KeyRound,
  Lock,
  LogOut,
  ShieldCheck,
  UserCog,
  UserRound,
  X,
} from 'lucide-react';
import { getCentralSyncClient } from '../services/centralSync/client';
import { getCurrentSecurityUser } from '../security/session';

const localRoleLabel: Record<string, string> = {
  admin: 'Administrador',
  warehouse: 'Responsable de almacén',
  coordinator: 'Coordinador',
  technician: 'Técnico',
};

const clickSecurityAction = (label: string) => {
  const button = document.querySelector<HTMLButtonElement>(`.security-session-bar button[aria-label="${label}"]`);
  button?.click();
};

export default function AccountSettingsCenter() {
  const [open, setOpen] = useState(false);
  const [, setRevision] = useState(0);
  const localUser = getCurrentSecurityUser();
  const remoteRecord = getCentralSyncClient()?.authStore.record;

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener('isivolt:security-session', refresh);
    window.addEventListener('isivolt:central-account-changed', refresh);
    return () => {
      window.removeEventListener('isivolt:security-session', refresh);
      window.removeEventListener('isivolt:central-account-changed', refresh);
    };
  }, []);

  const launchLocalAction = (label: string) => {
    setOpen(false);
    window.setTimeout(() => clickSecurityAction(label), 40);
  };

  const openRemoteAccount = () => {
    setOpen(false);
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('isivolt:central-sync-center-open')), 40);
  };

  return (
    <>
      <button
        className="security-account-launcher"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir cuenta y seguridad"
      >
        <UserCog size={18} /> Cuenta y seguridad
      </button>

      {open && (
        <div className="account-settings-backdrop" onClick={() => setOpen(false)}>
          <section className="account-settings-center" role="dialog" aria-modal="true" aria-label="Cuenta y seguridad" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span><UserCog size={23} /></span><div><small>Configuración</small><h2>Cuenta y seguridad</h2><p>Perfil, sesiones y acceso al mini PC.</p></div></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={21} /></button>
            </header>

            <main>
              <section className="account-settings-profile">
                <span><UserRound size={28} /></span>
                <div>
                  <small>Sesión local</small>
                  <strong>{localUser?.name ?? 'Sin usuario local'}</strong>
                  <p>{localUser ? localRoleLabel[localUser.role] ?? localUser.role : 'La protección local no está desbloqueada.'}</p>
                </div>
              </section>

              <section className="account-settings-actions">
                {localUser?.role === 'admin' && (
                  <button type="button" onClick={() => launchLocalAction('Administrar usuarios')}>
                    <span><UserCog size={21} /></span><div><strong>Usuarios y permisos</strong><small>Crear, editar, vincular y desactivar usuarios locales.</small></div>
                  </button>
                )}
                <button type="button" onClick={() => launchLocalAction('Bloquear')} disabled={!localUser}>
                  <span><Lock size={21} /></span><div><strong>Bloquear aplicación</strong><small>Solicitar de nuevo el PIN local.</small></div>
                </button>
                <button type="button" onClick={() => launchLocalAction('Cerrar sesión')} disabled={!localUser}>
                  <span><LogOut size={21} /></span><div><strong>Cerrar sesión local</strong><small>Salir del perfil utilizado en este dispositivo.</small></div>
                </button>
              </section>

              <section className="account-settings-remote">
                <div><CloudCog size={22} /><span><small>Cuenta del mini PC</small><strong>{remoteRecord?.email ?? 'No conectada'}</strong></span></div>
                <p>{remoteRecord
                  ? `${remoteRecord.name ?? remoteRecord.email} · ${localRoleLabel[String(remoteRecord.role)] ?? String(remoteRecord.role ?? 'usuario')}`
                  : 'Inicia sesión con correo para sincronizar y reconocer automáticamente al técnico.'}</p>
                <button type="button" onClick={openRemoteAccount}><KeyRound size={18} /> {remoteRecord ? 'Gestionar cuenta central' : 'Iniciar sesión con correo'}</button>
              </section>

              <footer><ShieldCheck size={16} /> Las contraseñas del mini PC no se guardan dentro del repositorio.</footer>
            </main>
          </section>
        </div>
      )}
    </>
  );
}
