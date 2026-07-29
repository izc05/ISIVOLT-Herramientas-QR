import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronRight,
  CloudCog,
  KeyRound,
  LogOut,
  Phone,
  ShieldCheck,
  Smartphone,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { getCurrentSecurityUser } from '../../security/session';
import { getCentralSyncClient } from '../../services/centralSync/client';
import { getCentralSyncConfig } from '../../services/centralSync/config';

const click = (selector: string) => document.querySelector<HTMLButtonElement>(selector)?.click();

const clickButtonByText = (root: ParentNode, text: string) => {
  const needle = text.toLocaleLowerCase('es-ES');
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find((item) => (item.textContent ?? '').toLocaleLowerCase('es-ES').includes(needle));
  button?.click();
};

const prepareLocalTechnicianUser = () => {
  click('.security-session-bar button[aria-label="Administrar usuarios"]');
  window.setTimeout(() => {
    const admin = document.querySelector<HTMLElement>('.security-admin');
    if (!admin) return;
    clickButtonByText(admin, 'Nuevo usuario');
    window.setTimeout(() => {
      const role = admin.querySelector<HTMLSelectElement>('.security-user-grid label:nth-child(2) select');
      if (!role) return;
      role.value = 'technician';
      role.dispatchEvent(new Event('change', { bubbles: true }));
    }, 80);
  }, 90);
};

export default function AdminAccessGuide() {
  const config = useMemo(() => getCentralSyncConfig(), []);
  const [open, setOpen] = useState(false);
  const [navTarget, setNavTarget] = useState<HTMLElement | null>(null);
  const [revision, setRevision] = useState(0);
  const localUser = getCurrentSecurityUser();
  const client = getCentralSyncClient();
  const remote = client?.authStore.isValid ? client.authStore.record : null;
  const isAdmin = localUser?.role === 'admin';

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener('isivolt:security-session', refresh);
    window.addEventListener('isivolt:central-account-changed', refresh);
    window.addEventListener('isivolt:local-registration-updated', refresh);
    return () => {
      window.removeEventListener('isivolt:security-session', refresh);
      window.removeEventListener('isivolt:central-account-changed', refresh);
      window.removeEventListener('isivolt:local-registration-updated', refresh);
    };
  }, []);

  useEffect(() => {
    let frame: number | null = null;
    const synchronize = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        setNavTarget(document.querySelector<HTMLElement>('.professional-navigation-secondary'));

        document.querySelectorAll<HTMLElement>('.security-admin > header span').forEach((copy) => {
          const small = copy.querySelector('small');
          const strong = copy.querySelector('strong');
          if (small) small.textContent = 'Seguridad local del dispositivo';
          if (strong) strong.textContent = 'Usuarios locales y auditoría';
        });

        const webTitle = document.querySelector<HTMLElement>('.web-mode-banner strong');
        const webDetail = document.querySelector<HTMLElement>('.web-mode-banner span');
        if (webTitle) webTitle.textContent = 'Modo web RC53';
        if (webDetail) webDetail.textContent = 'Autorregistro local · aprobación administrativa · piloto técnico completo';
      });
    };

    const observer = new MutationObserver(synchronize);
    observer.observe(document.body, { childList: true, subtree: true });
    synchronize();
    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  const openTechnicians = () => {
    setOpen(false);
    window.setTimeout(() => click('.technician-account-manager-launcher'), 40);
  };

  const openRequests = () => {
    setOpen(false);
    window.setTimeout(() => click('.registration-request-manager-launcher'), 40);
  };

  const openLocalRequests = () => {
    setOpen(false);
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('isivolt:local-registration-manager-open')), 40);
  };

  const openCentral = () => {
    setOpen(false);
    window.setTimeout(() => click('.central-sync-open-button'), 40);
  };

  const createLocalTechnician = () => {
    setOpen(false);
    window.setTimeout(prepareLocalTechnicianUser, 50);
  };

  const changeLocalUser = () => {
    setOpen(false);
    window.setTimeout(() => click('.security-session-bar button[aria-label="Cerrar sesión"]'), 40);
  };

  const launcher = isAdmin ? (
    <button className="rc52-admin-access-launcher" type="button" onClick={() => setOpen(true)} title="Técnicos, usuarios y acceso">
      <span><UserCheck size={19} /></span>
      <span><strong>Técnicos y acceso</strong><small>Administrar, registrar y probar</small></span>
      <ChevronRight size={16} />
    </button>
  ) : null;

  return (
    <>
      {launcher && navTarget ? createPortal(launcher, navTarget, `rc53-admin-${revision}`) : launcher}

      {open && (
        <div className="rc52-access-backdrop" onClick={() => setOpen(false)}>
          <section className="rc52-access-guide" role="dialog" aria-modal="true" aria-label="Técnicos y acceso" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span><UserCheck size={24} /></span><div><small>Administración diferenciada</small><h2>Técnicos y acceso</h2><p>Fichas profesionales, piloto local y registro real con el mini PC.</p></div></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={21} /></button>
            </header>

            <main>
              <section className="rc52-access-status">
                <div><ShieldCheck size={20} /><span><small>Sesión local actual</small><strong>{localUser?.name ?? 'Sin sesión'}</strong></span></div>
                <div className={config.enabled ? 'ready' : 'pending'}><CloudCog size={20} /><span><small>Acceso por teléfono o correo</small><strong>{config.enabled ? remote ? 'Cuenta central conectada' : 'Mini PC preparado' : 'Mini PC pendiente'}</strong></span></div>
              </section>

              <section className="rc52-access-card primary">
                <div className="rc52-access-card-heading"><span><Users size={22} /></span><div><small>Directorio y cuentas</small><h3>Administrar técnicos</h3><p>Edita nombre, código, especialidad, teléfono, correo, estado y cuenta central.</p></div></div>
                <button type="button" onClick={openTechnicians}><UserCog size={18} /> Abrir técnicos y cuentas</button>
              </section>

              <section className="rc52-access-card local">
                <div className="rc52-access-card-heading"><span><Smartphone size={22} /></span><div><small>Disponible ahora, sin PocketBase</small><h3>Piloto local completo</h3><p>El técnico solicita acceso, tú revisas la solicitud y la vinculas con una ficha. Después entra con su usuario y PIN.</p></div></div>
                <ol>
                  <li>Cierra la sesión para mostrar “Solicitar acceso local de prueba”.</li>
                  <li>El técnico completa sus datos y elige un PIN.</li>
                  <li>Aprueba la solicitud y vincúlala con su ficha técnica.</li>
                  <li>Cambia de usuario para comprobar su espacio personal.</li>
                </ol>
                <div className="rc52-access-actions">
                  <button type="button" onClick={openLocalRequests}><UserCheck size={18} /> Revisar solicitudes locales</button>
                  <button type="button" onClick={changeLocalUser}><LogOut size={18} /> Cambiar de usuario</button>
                  <button type="button" onClick={createLocalTechnician}><UserPlus size={18} /> Alta manual urgente</button>
                </div>
              </section>

              <section className="rc52-access-card central">
                <div className="rc52-access-card-heading"><span><Phone size={22} /></span><div><small>Funcionamiento real multiusuario</small><h3>Registro con teléfono o correo</h3><p>Al configurar PocketBase, el mismo recorrido funcionará desde cada móvil con contraseña personal y aprobación administrativa.</p></div></div>
                <div className="rc52-login-preview" aria-label="Vista previa del acceso técnico">
                  <div><KeyRound size={18} /><span><small>Inicio de sesión</small><strong>Teléfono o correo + contraseña</strong></span></div>
                  <div><UserPlus size={18} /><span><small>Nueva cuenta</small><strong>Nombre, código, teléfono, correo y contraseña</strong></span></div>
                </div>
                <div className="rc52-access-actions">
                  <button type="button" onClick={openRequests}><UserCheck size={18} /> Solicitudes centrales</button>
                  <button type="button" onClick={openCentral}><CloudCog size={18} /> {config.enabled ? 'Abrir mini PC' : 'Preparar configuración'}</button>
                </div>
              </section>
            </main>
          </section>
        </div>
      )}
    </>
  );
}
