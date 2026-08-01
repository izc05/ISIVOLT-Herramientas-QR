import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  CheckCircle2,
  CircleDot,
  Clock3,
  Grid3X3,
  History,
  PackagePlus,
  QrCode,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import { activeEcosystemModule, ecosystemModules } from './modules';
import { loadData, WORKSPACE_DATA_EVENT } from '../storage';
import type { AppData, Movement } from '../types';

const movementLabels: Record<Movement['type'], string> = {
  loan: 'Préstamo registrado',
  return: 'Devolución registrada',
  tool_created: 'Herramienta creada',
  technician_created: 'Técnico creado',
  nfc_linked: 'Etiqueta NFC vinculada',
};

const viewByLabel: Record<string, string> = {
  Inicio: 'dashboard',
  Herramientas: 'tools',
  Técnicos: 'technicians',
  Movimientos: 'movements',
};

const formatMovementDate = (value: string) => new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value));

function activate(selector: string) {
  document.querySelector<HTMLButtonElement>(selector)?.click();
}

export default function OperationalCenter() {
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const [data, setData] = useState<AppData>(() => loadData());
  const ActiveIcon = activeEcosystemModule.icon;

  useEffect(() => {
    const target = document.querySelector('.workspace main');
    setPortalTarget(target);

    const syncView = () => {
      const label = document.querySelector<HTMLButtonElement>('.sidebar nav button.active span')?.textContent?.trim() ?? 'Inicio';
      document.documentElement.dataset.isivoltView = viewByLabel[label] ?? 'dashboard';
    };

    syncView();
    const navigation = document.querySelector('.sidebar nav');
    const observer = navigation
      ? new MutationObserver(syncView)
      : null;
    observer?.observe(navigation as Node, { attributes: true, subtree: true, attributeFilter: ['class'] });

    const handleDataChange = (event: Event) => {
      const customEvent = event as CustomEvent<AppData>;
      setData(customEvent.detail ?? loadData());
    };
    window.addEventListener(WORKSPACE_DATA_EVENT, handleDataChange);

    return () => {
      observer?.disconnect();
      window.removeEventListener(WORKSPACE_DATA_EVENT, handleDataChange);
      delete document.documentElement.dataset.isivoltView;
    };
  }, []);

  const metrics = useMemo(() => ({
    tools: data.tools.filter((tool) => tool.status !== 'retired').length,
    available: data.tools.filter((tool) => tool.status === 'available').length,
    loaned: data.tools.filter((tool) => tool.status === 'loaned').length,
    technicians: data.technicians.filter((technician) => technician.active).length,
  }), [data]);

  const setupSteps = useMemo(() => [
    { label: 'Crear el primer técnico', complete: metrics.technicians > 0 },
    { label: 'Registrar la primera herramienta', complete: metrics.tools > 0 },
    { label: 'Completar un préstamo o devolución', complete: data.movements.some((movement) => movement.type === 'loan' || movement.type === 'return') },
  ], [data.movements, metrics.technicians, metrics.tools]);

  const setupComplete = setupSteps.filter((step) => step.complete).length;
  const setupProgress = Math.round((setupComplete / setupSteps.length) * 100);
  const recentMovements = data.movements.slice(0, 4);
  const nextModules = ecosystemModules.filter((module) => module.status === 'next');
  const plannedCount = ecosystemModules.filter((module) => module.status === 'planned').length;

  if (!portalTarget) return null;

  return createPortal(
    <section className="operational-center" aria-labelledby="operational-center-title">
      <article className="operations-hero">
        <div className="operations-hero-copy">
          <span className="operations-eyebrow"><Sparkles size={15} /> ECOSISTEMA ISIVOLTPRO</span>
          <h1 id="operational-center-title">Centro operativo</h1>
          <p>Una entrada común para gestionar mantenimiento, inventario, inspecciones y utilidades técnicas con la misma identidad.</p>
          <div className="operations-hero-actions">
            <button className="operations-primary" type="button" onClick={() => activate('.quick-panel > button.quick-primary')}>
              <PackagePlus size={18} /> Añadir herramienta
            </button>
            <button className="operations-secondary" type="button" onClick={() => activate('.ecosystem-trigger')}>
              <Grid3X3 size={18} /> Abrir ecosistema
            </button>
          </div>
        </div>
        <div className="operations-active-module">
          <span className="operations-module-icon"><ActiveIcon size={29} /></span>
          <div>
            <small>MÓDULO OPERATIVO</small>
            <strong>{activeEcosystemModule.name}</strong>
            <p>{activeEcosystemModule.description}</p>
          </div>
          <span className="operations-live"><CircleDot size={13} /> En uso</span>
        </div>
      </article>

      <section className="operations-kpis" aria-label="Resumen del módulo Herramientas">
        {[
          { label: 'Herramientas', value: metrics.tools, Icon: Wrench, detail: 'Inventario activo' },
          { label: 'Disponibles', value: metrics.available, Icon: CheckCircle2, detail: 'Listas para asignar' },
          { label: 'En préstamo', value: metrics.loaned, Icon: ArrowUpFromLine, detail: 'Fuera del almacén' },
          { label: 'Técnicos', value: metrics.technicians, Icon: Users, detail: 'Responsables activos' },
        ].map(({ label, value, Icon, detail }) => (
          <article key={label} className="operations-kpi">
            <span><Icon size={21} /></span>
            <div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div>
          </article>
        ))}
      </section>

      <div className="operations-main-grid">
        <section className="surface operations-activity">
          <header>
            <div><span><History size={18} /></span><div><h2>Actividad reciente</h2><p>Últimas operaciones del módulo activo</p></div></div>
            <button type="button" onClick={() => activate('.sidebar nav button:nth-of-type(4)')}>Ver historial <ArrowRight size={15} /></button>
          </header>
          {recentMovements.length === 0 ? (
            <div className="operations-empty">
              <Clock3 size={28} />
              <strong>Aún no hay actividad</strong>
              <p>Las altas, préstamos, devoluciones y etiquetas aparecerán aquí.</p>
            </div>
          ) : (
            <div className="operations-activity-list">
              {recentMovements.map((movement) => (
                <article key={movement.id}>
                  <span className="operations-activity-dot" />
                  <div><strong>{movementLabels[movement.type]}</strong><p>{movement.detail}</p></div>
                  <time>{formatMovementDate(movement.occurredAt)}</time>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="surface operations-setup">
          <header>
            <div><span><ShieldCheck size={18} /></span><div><h2>Puesta en marcha</h2><p>Configuración inicial del espacio local</p></div></div>
            <strong>{setupProgress}%</strong>
          </header>
          <div className="operations-progress"><i style={{ width: `${setupProgress}%` }} /></div>
          <div className="operations-checklist">
            {setupSteps.map((step) => (
              <div key={step.label} className={step.complete ? 'complete' : ''}>
                <span>{step.complete ? <CheckCircle2 size={17} /> : <CircleDot size={17} />}</span>
                <p>{step.label}</p>
              </div>
            ))}
          </div>
          <div className="operations-setup-actions">
            <button type="button" onClick={() => activate('.quick-panel > button:nth-of-type(2)')}><UserPlus size={17} /> Crear técnico</button>
            <button type="button" onClick={() => activate('.quick-panel > button:nth-of-type(3)')}><ArrowUpFromLine size={17} /> Préstamo</button>
            <button type="button" onClick={() => activate('.quick-panel > button:nth-of-type(4)')}><ArrowDownToLine size={17} /> Devolución</button>
          </div>
        </section>
      </div>

      <section className="surface operations-roadmap">
        <header>
          <div><span><Activity size={18} /></span><div><h2>Expansión del ecosistema</h2><p>Los próximos módulos compartirán esta misma base visual y de navegación.</p></div></div>
          <button type="button" onClick={() => activate('.ecosystem-trigger')}>Ver los {ecosystemModules.length} módulos <ArrowRight size={15} /></button>
        </header>
        <div className="operations-roadmap-grid">
          <article className="operations-roadmap-card active">
            <span><QrCode size={22} /></span>
            <div><small>EN USO</small><strong>Herramientas</strong><p>Inventario, responsables, QR y NFC.</p></div>
          </article>
          {nextModules.map((module) => {
            const Icon = module.icon;
            return (
              <article className="operations-roadmap-card next" key={module.id}>
                <span><Icon size={22} /></span>
                <div><small>SIGUIENTE</small><strong>{module.shortName}</strong><p>{module.description}</p></div>
              </article>
            );
          })}
          <article className="operations-roadmap-card planned">
            <span><Grid3X3 size={22} /></span>
            <div><small>PLANIFICADOS</small><strong>{plannedCount} módulos</strong><p>Inspecciones, RITE, PCI, Legionella, almacén y cálculos.</p></div>
          </article>
        </div>
      </section>
    </section>,
    portalTarget,
  );
}
