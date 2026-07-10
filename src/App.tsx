import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Boxes,
  ChevronRight,
  Clock3,
  FileSpreadsheet,
  History,
  PackageCheck,
  QrCode,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';

type ToolStatus = 'available' | 'loaned' | 'review' | 'alert';

type Movement = {
  id: number;
  tool: string;
  technician: string;
  action: 'Entrega' | 'Devolución' | 'Incidencia';
  time: string;
  status: ToolStatus;
};

const stats = [
  { label: 'Disponibles', value: 148, icon: PackageCheck, tone: 'success', detail: '72% del inventario' },
  { label: 'Prestadas', value: 43, icon: Users, tone: 'warning', detail: '12 vencen esta semana' },
  { label: 'En revisión', value: 8, icon: Wrench, tone: 'violet', detail: '3 requieren calibración' },
  { label: 'Incidencias', value: 3, icon: AlertTriangle, tone: 'danger', detail: '1 de prioridad alta' },
] as const;

const movements: Movement[] = [
  { id: 1, tool: 'Multímetro Fluke 289', technician: 'Antonio Ruiz', action: 'Entrega', time: '09:42', status: 'loaned' },
  { id: 2, tool: 'Taladro Hilti TE 30', technician: 'Marta López', action: 'Devolución', time: '09:31', status: 'available' },
  { id: 3, tool: 'Cámara termográfica', technician: 'Carlos Martín', action: 'Incidencia', time: '09:18', status: 'alert' },
  { id: 4, tool: 'Pinza amperimétrica', technician: 'Javier Moreno', action: 'Entrega', time: '08:56', status: 'loaned' },
];

const quickActions = [
  { label: 'Entregar', description: 'Asignar una o varias herramientas', icon: QrCode, tone: 'primary' },
  { label: 'Devolver', description: 'Registrar entrada y comprobar estado', icon: RotateCcw, tone: 'secondary' },
  { label: 'Inventario', description: 'Consultar ubicación y disponibilidad', icon: Boxes, tone: 'neutral' },
  { label: 'Exportar', description: 'Generar informe profesional en Excel', icon: FileSpreadsheet, tone: 'neutral' },
] as const;

function AnimatedBackdrop() {
  return (
    <div className="ambient" aria-hidden="true">
      <motion.div
        className="orb orb-one"
        animate={{ x: [0, 36, -18, 0], y: [0, -24, 18, 0], scale: [1, 1.12, 0.96, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="orb orb-two"
        animate={{ x: [0, -44, 22, 0], y: [0, 30, -16, 0], scale: [1, 0.94, 1.1, 1] }}
        transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="grid-glow" />
    </div>
  );
}

function ScannerModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [isReading, setIsReading] = useState(false);

  const simulateScan = () => {
    if (isReading) return;
    setIsReading(true);
    window.setTimeout(() => {
      onSuccess();
      onClose();
    }, 1150);
  };

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.section
        className="scanner-modal"
        initial={{ opacity: 0, scale: 0.92, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 24 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        onClick={(event) => event.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-labelledby="scanner-title"
      >
        <button className="icon-button modal-close" onClick={onClose} aria-label="Cerrar escáner">
          <X size={20} />
        </button>
        <div className="scanner-heading">
          <span className="eyebrow"><Zap size={14} /> Escaneo inteligente</span>
          <h2 id="scanner-title">Apunta al código QR</h2>
          <p>Identificaremos automáticamente si pertenece a una herramienta o a un técnico.</p>
        </div>

        <button className="scanner-viewport" onClick={simulateScan} type="button">
          <div className="scanner-corner corner-tl" />
          <div className="scanner-corner corner-tr" />
          <div className="scanner-corner corner-bl" />
          <div className="scanner-corner corner-br" />
          <motion.div
            className="scan-line"
            animate={{ y: [18, 220, 18] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="scan-target"
            animate={isReading ? { scale: [1, 1.08, 1], opacity: [0.72, 1, 0.72] } : { scale: [1, 1.03, 1] }}
            transition={{ duration: isReading ? 0.55 : 2, repeat: Infinity }}
          >
            <QrCode size={72} strokeWidth={1.25} />
          </motion.div>
          <span>{isReading ? 'Verificando herramienta…' : 'Toca para simular una lectura'}</span>
        </button>

        <div className="scanner-status">
          <span className="live-dot" />
          Cámara preparada · lectura local y sin conexión
        </div>
      </motion.section>
    </motion.div>
  );
}

export default function App() {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('Inicio');
  const [highlightedMovement, setHighlightedMovement] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setHighlightedMovement((current) => (current + 1) % movements.length);
    }, 3600);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!toastVisible) return;
    const timeout = window.setTimeout(() => setToastVisible(false), 2800);
    return () => window.clearTimeout(timeout);
  }, [toastVisible]);

  const currentDate = useMemo(
    () => new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()),
    [],
  );

  return (
    <div className="app-shell">
      <AnimatedBackdrop />

      <header className="topbar">
        <motion.div className="brand" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <motion.div className="brand-mark" whileHover={{ rotate: 8, scale: 1.05 }}>
            <Wrench size={22} />
          </motion.div>
          <div>
            <strong>ISIVOLT</strong>
            <span>Herramientas QR</span>
          </div>
        </motion.div>
        <div className="topbar-actions">
          <button className="icon-button" aria-label="Buscar"><Search size={20} /></button>
          <button className="profile-button" aria-label="Perfil de responsable de almacén">
            <span>IZ</span>
            <i />
          </button>
        </div>
      </header>

      <main>
        <motion.section
          className="hero"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <span className="eyebrow"><Sparkles size={14} /> Centro de control</span>
            <h1>Buenos días, Isi</h1>
            <p className="hero-date">{currentDate}</p>
          </div>
          <motion.button
            className="scan-main-button"
            onClick={() => setScannerOpen(true)}
            whileHover={{ scale: 1.025 }}
            whileTap={{ scale: 0.96 }}
          >
            <motion.span
              className="button-aura"
              animate={{ scale: [1, 1.18, 1], opacity: [0.35, 0, 0.35] }}
              transition={{ duration: 2.2, repeat: Infinity }}
            />
            <QrCode size={25} />
            <span>
              <strong>Escanear QR</strong>
              <small>Entrega o devolución inmediata</small>
            </span>
            <ChevronRight size={20} />
          </motion.button>
        </motion.section>

        <section className="status-line" aria-label="Estado del sistema">
          <span className="live-dot" />
          Sistema operativo
          <span className="status-divider" />
          <ShieldCheck size={15} /> Datos protegidos localmente
        </section>

        <section className="stats-grid" aria-label="Resumen de inventario">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.article
                className={`stat-card tone-${stat.tone}`}
                key={stat.label}
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + index * 0.08, duration: 0.5 }}
                whileHover={{ y: -5, scale: 1.01 }}
              >
                <div className="stat-card-header">
                  <span className="stat-icon"><Icon size={20} /></span>
                  <span className="mini-trend">+{index + 1}</span>
                </div>
                <motion.strong
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35 + index * 0.08, type: 'spring' }}
                >
                  {stat.value}
                </motion.strong>
                <h3>{stat.label}</h3>
                <p>{stat.detail}</p>
              </motion.article>
            );
          })}
        </section>

        <section className="content-grid">
          <div className="panel actions-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Operaciones</span>
                <h2>Acciones rápidas</h2>
              </div>
              <span className="keyboard-hint">QR</span>
            </div>
            <div className="quick-actions">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <motion.button
                    key={action.label}
                    className={`quick-action action-${action.tone}`}
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + index * 0.07 }}
                    whileHover={{ x: 5 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => action.label === 'Entregar' || action.label === 'Devolver' ? setScannerOpen(true) : undefined}
                  >
                    <span className="quick-icon"><Icon size={22} /></span>
                    <span>
                      <strong>{action.label}</strong>
                      <small>{action.description}</small>
                    </span>
                    <ChevronRight size={18} />
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="panel movements-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow"><span className="live-dot" /> En vivo</span>
                <h2>Últimos movimientos</h2>
              </div>
              <button className="text-button">Ver todos</button>
            </div>
            <div className="movement-list">
              {movements.map((movement, index) => (
                <motion.article
                  key={movement.id}
                  className={`movement movement-${movement.status} ${highlightedMovement === index ? 'movement-active' : ''}`}
                  layout
                  animate={highlightedMovement === index ? { scale: [1, 1.015, 1] } : { scale: 1 }}
                  transition={{ duration: 0.55 }}
                >
                  <span className="movement-icon">
                    {movement.action === 'Devolución' ? <RotateCcw size={18} /> : movement.action === 'Incidencia' ? <AlertTriangle size={18} /> : <QrCode size={18} />}
                  </span>
                  <div className="movement-main">
                    <strong>{movement.tool}</strong>
                    <span>{movement.action} · {movement.technician}</span>
                  </div>
                  <time><Clock3 size={13} /> {movement.time}</time>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <nav className="bottom-nav" aria-label="Navegación principal">
        {[
          { label: 'Inicio', icon: Zap },
          { label: 'Inventario', icon: Boxes },
          { label: 'Escanear', icon: QrCode, primary: true },
          { label: 'Historial', icon: History },
          { label: 'Ajustes', icon: Settings2 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.label}
              className={`${activeNav === item.label ? 'nav-active' : ''} ${item.primary ? 'nav-primary' : ''}`}
              onClick={() => {
                setActiveNav(item.label);
                if (item.primary) setScannerOpen(true);
              }}
              whileTap={{ scale: 0.9 }}
            >
              <Icon size={item.primary ? 25 : 20} />
              <span>{item.label}</span>
            </motion.button>
          );
        })}
      </nav>

      <AnimatePresence>
        {scannerOpen && <ScannerModal onClose={() => setScannerOpen(false)} onSuccess={() => setToastVisible(true)} />}
      </AnimatePresence>

      <AnimatePresence>
        {toastVisible && (
          <motion.div
            className="success-toast"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
          >
            <span><PackageCheck size={20} /></span>
            <div>
              <strong>Herramienta identificada</strong>
              <small>Multímetro Fluke 289 · Disponible</small>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
