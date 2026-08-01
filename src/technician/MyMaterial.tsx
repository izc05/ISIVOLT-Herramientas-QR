import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  History,
  PackageOpen,
  QrCode,
  UserRoundCheck,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { CLOUD_PROFILE_EVENT, getCloudProfile, type CloudProfile } from '../cloud/config';
import { SCAN_SESSION_EVENT } from '../scan/ScanSession';
import { loadData, WORKSPACE_DATA_EVENT } from '../storage';
import type { AppData, BatchOperation, Technician } from '../types';

export const OPEN_MY_MATERIAL_EVENT = 'isivoltpro:open-my-material';

const technicianPayload = (technician: Technician) => technician.qrPayload ?? `ISIVOLTPRO:TECH:${technician.code}`;

export default function MyMaterial() {
  const [target, setTarget] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<CloudProfile | null>(() => getCloudProfile());
  const [data, setData] = useState<AppData>(() => loadData());

  useEffect(() => {
    const resolveTarget = () => setTarget(document.querySelector('.topbar-actions'));
    resolveTarget();
    const observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });

    const handleProfile = (event: Event) => {
      setProfile((event as CustomEvent<CloudProfile | null>).detail ?? getCloudProfile());
    };
    const handleData = (event: Event) => setData((event as CustomEvent<AppData>).detail ?? loadData());
    const handleOpen = () => setOpen(true);

    window.addEventListener(CLOUD_PROFILE_EVENT, handleProfile);
    window.addEventListener(WORKSPACE_DATA_EVENT, handleData);
    window.addEventListener(OPEN_MY_MATERIAL_EVENT, handleOpen);
    return () => {
      observer.disconnect();
      window.removeEventListener(CLOUD_PROFILE_EVENT, handleProfile);
      window.removeEventListener(WORKSPACE_DATA_EVENT, handleData);
      window.removeEventListener(OPEN_MY_MATERIAL_EVENT, handleOpen);
    };
  }, []);

  const technician = useMemo(() => {
    if (profile?.role !== 'technician' || !profile.technicianExternalId) return null;
    return data.technicians.find((item) => item.id === profile.technicianExternalId) ?? null;
  }, [data.technicians, profile]);

  const assignedTools = useMemo(
    () => technician
      ? data.tools.filter((tool) => tool.status === 'loaned' && tool.technicianId === technician.id)
      : [],
    [data.tools, technician],
  );

  const recentMovements = useMemo(
    () => technician
      ? data.movements.filter((movement) => movement.technicianId === technician.id).slice(0, 8)
      : [],
    [data.movements, technician],
  );

  const startOperation = (operation: BatchOperation) => {
    if (!technician) return;
    setOpen(false);
    window.dispatchEvent(new CustomEvent(SCAN_SESSION_EVENT, {
      detail: {
        operation,
        mode: 'self-service',
        technicianId: technician.id,
        identificationMethod: 'authenticated',
        startAt: 'items',
      },
    }));
  };

  const isTechnician = profile?.role === 'technician';
  const launcher = target && isTechnician ? createPortal(
    <button className="my-material-launcher" type="button" onClick={() => setOpen(true)}>
      <BriefcaseBusiness size={18} />
      <span>Mi material</span>
      {assignedTools.length > 0 && <strong>{assignedTools.length}</strong>}
    </button>,
    target,
  ) : null;

  return (
    <>
      {launcher}
      {open && createPortal(
        <div className="my-material-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="my-material-panel" role="dialog" aria-modal="true" aria-label="Mi material">
            <header>
              <div><span><UserRoundCheck size={25} /></span><div><small>AUTOSERVICIO ISIVOLTPRO</small><h2>Mi material</h2></div></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={21} /></button>
            </header>

            {!profile ? (
              <div className="my-material-empty"><UserRoundCheck size={42} /><h3>Inicia sesión como técnico</h3><p>La cuenta debe estar vinculada a una ficha de técnico para mostrar su material.</p></div>
            ) : !profile.technicianExternalId ? (
              <div className="my-material-empty"><UserRoundCheck size={42} /><h3>Cuenta sin ficha vinculada</h3><p>El administrador debe indicar el identificador del técnico en PocketBase.</p></div>
            ) : !technician ? (
              <div className="my-material-empty"><PackageOpen size={42} /><h3>Ficha pendiente de sincronizar</h3><p>Sincroniza la aplicación para descargar tu ficha de técnico.</p></div>
            ) : (
              <main>
                <section className="my-material-identity">
                  <div><small>TÉCNICO IDENTIFICADO</small><h3>{technician.name}</h3><p>{technician.code} · {technician.category}</p><span><CheckCircle2 size={15} /> La cuenta sustituye al escaneo del técnico</span></div>
                  <QRCodeSVG value={technicianPayload(technician)} size={112} level="H" includeMargin />
                </section>

                <section className="my-material-actions">
                  <button type="button" onClick={() => startOperation('loan')}><span><ArrowUpFromLine size={24} /></span><div><strong>Recoger material</strong><small>Escanear artículos para préstamo</small></div></button>
                  <button type="button" onClick={() => startOperation('return')}><span><ArrowDownToLine size={24} /></span><div><strong>Devolver material</strong><small>Escanear artículos asignados</small></div></button>
                </section>

                <section className="my-material-block">
                  <div className="my-material-heading"><div><BriefcaseBusiness size={19} /><strong>Material asignado</strong></div><span>{assignedTools.length}</span></div>
                  {assignedTools.length === 0 ? (
                    <div className="my-material-list-empty"><PackageOpen size={29} /><p>No tienes herramientas o material prestado actualmente.</p></div>
                  ) : (
                    <div className="my-material-list">
                      {assignedTools.map((tool) => (
                        <article key={tool.id}><span><BriefcaseBusiness size={18} /></span><div><strong>{tool.name}</strong><small>{tool.code} · {tool.category}</small></div><em>{tool.location || 'Sin ubicación'}</em></article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="my-material-block">
                  <div className="my-material-heading"><div><History size={19} /><strong>Actividad reciente</strong></div><span>{recentMovements.length}</span></div>
                  {recentMovements.length === 0 ? (
                    <div className="my-material-list-empty"><CalendarClock size={29} /><p>Todavía no hay movimientos asociados a tu cuenta.</p></div>
                  ) : (
                    <div className="my-material-history">
                      {recentMovements.map((movement) => (
                        <article key={movement.id}><span className={movement.type === 'return' ? 'return' : ''}>{movement.type === 'return' ? <ArrowDownToLine size={17} /> : <ArrowUpFromLine size={17} />}</span><div><strong>{movement.detail}</strong><small>{new Date(movement.occurredAt).toLocaleString('es-ES')}</small></div>{movement.batchId && <code>{movement.batchId.slice(0, 12)}</code>}</article>
                      ))}
                    </div>
                  )}
                </section>
              </main>
            )}
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
