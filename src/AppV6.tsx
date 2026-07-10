import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  Check,
  ImagePlus,
  Images,
  Settings2,
  Sparkles,
  Trash2,
  Vibrate,
  VibrateOff,
  Volume2,
  VolumeX,
  Wrench,
  X,
} from 'lucide-react';
import AppV5 from './AppV5';
import type { AppData, Movement, Tool } from './domain/types';
import {
  loadExperienceSettings,
  primeExperienceAudio,
  runExperienceCue,
  saveExperienceSettings,
  type ExperienceCue,
  type ExperienceSettings,
} from './services/experience';
import { loadAppData, saveAppData } from './services/storage';
import { acquireToolImage, type ToolImageSource } from './services/toolMedia';

type Celebration = {
  id: string;
  cue: ExperienceCue;
  title: string;
  detail: string;
  technician?: string;
  tools: Tool[];
};

const DEFAULT_SETTINGS: ExperienceSettings = { soundEnabled: true, hapticsEnabled: true };

const findToolByCode = (code: string) =>
  loadAppData().tools.find((tool) => tool.code.toUpperCase() === code.toUpperCase()) ?? null;

const toolCodeFromCard = (card: Element) => card.querySelector('.tool-code')?.textContent?.trim() ?? '';

const buildMediaButton = (tool: Tool) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tool-media-trigger';
  button.dataset.toolPhotoAction = 'open';
  button.dataset.toolCode = tool.code;
  button.setAttribute('aria-label', `Gestionar imagen de ${tool.name}`);

  if (tool.imageDataUrl) {
    const image = document.createElement('img');
    image.src = tool.imageDataUrl;
    image.alt = `Imagen de ${tool.name}`;
    button.append(image);
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'tool-media-placeholder';
    placeholder.textContent = tool.category.slice(0, 2).toUpperCase();
    button.append(placeholder);
  }

  const badge = document.createElement('span');
  badge.className = 'tool-media-badge';
  badge.textContent = tool.imageDataUrl ? 'Cambiar' : '+ Foto';
  button.append(badge);
  return button;
};

const refreshMediaButton = (button: HTMLButtonElement, tool: Tool) => {
  const replacement = buildMediaButton(tool);
  button.replaceWith(replacement);
};

const enhanceToolCards = () => {
  const data = loadAppData();

  document.querySelectorAll<HTMLElement>('.tool-card').forEach((card) => {
    const code = toolCodeFromCard(card);
    const tool = data.tools.find((item) => item.code === code);
    if (!tool) return;
    const current = card.querySelector<HTMLButtonElement>('.tool-media-trigger');
    if (current) {
      const currentImage = current.querySelector('img')?.getAttribute('src') ?? '';
      if (currentImage !== (tool.imageDataUrl ?? '')) refreshMediaButton(current, tool);
      return;
    }
    card.prepend(buildMediaButton(tool));
  });

  document.querySelectorAll<HTMLElement>('.native-scanned-tools button').forEach((row) => {
    const code = row.querySelector('small')?.textContent?.trim() ?? '';
    const tool = data.tools.find((item) => item.code === code);
    if (!tool || row.querySelector('.native-tool-thumb')) return;
    const thumb = document.createElement('span');
    thumb.className = 'native-tool-thumb';
    if (tool.imageDataUrl) {
      const image = document.createElement('img');
      image.src = tool.imageDataUrl;
      image.alt = '';
      thumb.append(image);
    } else {
      thumb.textContent = tool.category.slice(0, 2).toUpperCase();
    }
    row.prepend(thumb);
  });

  const detail = document.querySelector<HTMLElement>('.tool-qr-modal');
  if (detail && !detail.querySelector('.tool-detail-photo-panel')) {
    const detailCode = detail.querySelector('.technician-detail-header p')?.textContent?.split('·')[0]?.trim() ?? '';
    const tool = data.tools.find((item) => item.code === detailCode);
    if (tool) {
      const panel = document.createElement('section');
      panel.className = 'tool-detail-photo-panel no-print';
      if (tool.imageDataUrl) {
        const image = document.createElement('img');
        image.src = tool.imageDataUrl;
        image.alt = `Imagen de ${tool.name}`;
        panel.append(image);
      } else {
        const empty = document.createElement('div');
        empty.className = 'tool-detail-photo-empty';
        empty.textContent = 'Añade una fotografía para identificar este activo de un vistazo.';
        panel.append(empty);
      }
      const action = document.createElement('button');
      action.type = 'button';
      action.dataset.toolPhotoAction = 'open';
      action.dataset.toolCode = tool.code;
      action.textContent = tool.imageDataUrl ? 'Cambiar fotografía' : 'Añadir fotografía';
      panel.append(action);
      detail.querySelector('.technician-detail-grid')?.before(panel);
    }
  }
};

const getRecentMovements = (data: AppData, known: Set<string>) => {
  const now = Date.now();
  return data.movements.filter((movement) => {
    const age = now - new Date(movement.occurredAt).getTime();
    return !known.has(movement.id) && age >= 0 && age < 10_000;
  });
};

const buildCelebration = (data: AppData, movements: Movement[]): Celebration | null => {
  if (!movements.length) return null;
  const first = movements[0];
  const tools = movements
    .map((movement) => data.tools.find((tool) => tool.id === movement.toolId))
    .filter((tool): tool is Tool => Boolean(tool));
  const technician = data.technicians.find((item) => item.id === first.technicianId)?.name;
  const incident = movements.some((movement) => movement.type === 'incident');
  const delivery = first.type === 'delivery';

  return {
    id: `${first.occurredAt}-${first.id}`,
    cue: incident ? 'incident' : delivery ? 'delivery' : 'return',
    title: incident ? 'Entrada con incidencia' : delivery ? 'Salida registrada' : 'Entrada completada',
    detail: incident
      ? `${movements.length} activo${movements.length === 1 ? '' : 's'} queda${movements.length === 1 ? '' : 'n'} bloqueado${movements.length === 1 ? '' : 's'} para revisión.`
      : `${movements.length} movimiento${movements.length === 1 ? '' : 's'} registrado${movements.length === 1 ? '' : 's'} correctamente.`,
    technician,
    tools,
  };
};

function ToolPhotoModal({
  tool,
  onClose,
  onSaved,
  settings,
}: {
  tool: Tool;
  onClose: () => void;
  onSaved: (tool: Tool) => void;
  settings: ExperienceSettings;
}) {
  const [busy, setBusy] = useState<ToolImageSource | null>(null);
  const [error, setError] = useState('');

  const saveImage = async (source: ToolImageSource) => {
    setBusy(source);
    setError('');
    try {
      const imageDataUrl = await acquireToolImage(source);
      if (!imageDataUrl) return;
      const data = loadAppData();
      const timestamp = new Date().toISOString();
      const updated = {
        ...tool,
        imageDataUrl,
        imageUpdatedAt: timestamp,
        updatedAt: timestamp,
      };
      saveAppData({
        ...data,
        tools: data.tools.map((item) => item.id === tool.id ? updated : item),
      });
      await runExperienceCue('photo', settings);
      onSaved(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido guardar la imagen.');
      await runExperienceCue('error', settings);
    } finally {
      setBusy(null);
    }
  };

  const removeImage = () => {
    const data = loadAppData();
    const timestamp = new Date().toISOString();
    const updated = { ...tool, imageDataUrl: undefined, imageUpdatedAt: undefined, updatedAt: timestamp };
    saveAppData({
      ...data,
      tools: data.tools.map((item) => item.id === tool.id ? updated : item),
    });
    onSaved(updated);
  };

  return (
    <motion.div className="tool-photo-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.section
        className="tool-photo-modal"
        initial={{ opacity: 0, y: 42, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="tool-photo-glow" />
        <button className="tool-photo-close" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        <header>
          <span><ImagePlus size={23} /></span>
          <div><small>Identidad visual del activo</small><h2>{tool.name}</h2><p>{tool.code} · {tool.category}</p></div>
        </header>
        <div className={`tool-photo-preview ${tool.imageDataUrl ? 'has-image' : ''}`}>
          {tool.imageDataUrl ? <img src={tool.imageDataUrl} alt={`Imagen de ${tool.name}`} /> : <div><Wrench size={54} /><strong>Sin fotografía</strong><small>Haz una foto o selecciónala de la galería.</small></div>}
          <motion.span animate={{ x: ['-140%', '150%'] }} transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 1.4 }} />
        </div>
        <div className="tool-photo-actions">
          <motion.button onClick={() => saveImage('camera')} disabled={Boolean(busy)} whileTap={{ scale: 0.96 }}>
            <Camera size={20} /><span><strong>{busy === 'camera' ? 'Abriendo cámara…' : 'Hacer fotografía'}</strong><small>Cámara trasera</small></span>
          </motion.button>
          <motion.button onClick={() => saveImage('gallery')} disabled={Boolean(busy)} whileTap={{ scale: 0.96 }}>
            <Images size={20} /><span><strong>{busy === 'gallery' ? 'Abriendo galería…' : 'Elegir de galería'}</strong><small>Imagen existente</small></span>
          </motion.button>
        </div>
        {tool.imageDataUrl && <button className="tool-photo-remove" onClick={removeImage}><Trash2 size={17} /> Eliminar imagen</button>}
        {error && <p className="tool-photo-error"><AlertTriangle size={17} /> {error}</p>}
        <p className="tool-photo-note">La imagen se comprime y queda guardada localmente con el inventario y la copia de seguridad.</p>
      </motion.section>
    </motion.div>
  );
}

function CelebrationOverlay({ celebration }: { celebration: Celebration }) {
  const delivery = celebration.cue === 'delivery';
  const incident = celebration.cue === 'incident';
  const Icon = incident ? AlertTriangle : delivery ? ArrowUpRight : ArrowDownLeft;
  return (
    <motion.div
      className={`operation-celebration celebration-${celebration.cue}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="celebration-particles" aria-hidden="true">
        {Array.from({ length: 22 }, (_, index) => <i key={index} style={{ '--particle': index } as React.CSSProperties} />)}
      </div>
      <motion.div className="celebration-ring ring-one" animate={{ scale: [0.65, 1.55], opacity: [0.9, 0] }} transition={{ duration: 1.6, repeat: Infinity }} />
      <motion.div className="celebration-ring ring-two" animate={{ scale: [0.8, 1.8], opacity: [0.7, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 0.25 }} />
      <motion.section initial={{ scale: 0.7, y: 40, rotateX: 12 }} animate={{ scale: 1, y: 0, rotateX: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 19 }}>
        <motion.div className="celebration-icon" animate={{ y: [0, -8, 0], rotate: incident ? [0, -4, 4, 0] : [0, 4, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
          <Icon size={42} />
        </motion.div>
        <span className="celebration-kicker"><Sparkles size={15} /> Operación sincronizada</span>
        <h2>{celebration.title}</h2>
        <p>{celebration.detail}</p>
        {celebration.technician && <strong className="celebration-technician">{celebration.technician}</strong>}
        <div className="celebration-tools">
          {celebration.tools.slice(0, 4).map((tool, index) => (
            <motion.article key={tool.id} initial={{ opacity: 0, x: delivery ? -30 : 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 + index * 0.08 }}>
              {tool.imageDataUrl ? <img src={tool.imageDataUrl} alt="" /> : <span><Wrench size={20} /></span>}
              <div><strong>{tool.name}</strong><small>{tool.code}</small></div>
              <Check size={18} />
            </motion.article>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}

export default function AppV6() {
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [settings, setSettings] = useState<ExperienceSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const knownMovementIds = useRef(new Set(loadAppData().movements.map((movement) => movement.id)));

  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    void loadExperienceSettings().then((value) => {
      settingsRef.current = value;
      setSettings(value);
    });
    const prime = () => primeExperienceAudio();
    window.addEventListener('pointerdown', prime, { once: true });
    return () => window.removeEventListener('pointerdown', prime);
  }, []);

  useEffect(() => {
    let scheduled = 0;
    const scheduleEnhancement = () => {
      window.clearTimeout(scheduled);
      scheduled = window.setTimeout(enhanceToolCards, 40);
    };
    const observer = new MutationObserver(scheduleEnhancement);
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleEnhancement();

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const action = target?.closest<HTMLElement>('[data-tool-photo-action="open"]');
      if (!action?.dataset.toolCode) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setSelectedTool(findToolByCode(action.dataset.toolCode));
    };
    document.addEventListener('click', handleClick, true);

    const handleDataUpdated = (event: Event) => {
      const data = (event as CustomEvent<AppData>).detail ?? loadAppData();
      const recent = getRecentMovements(data, knownMovementIds.current);
      knownMovementIds.current = new Set(data.movements.map((movement) => movement.id));
      const nextCelebration = buildCelebration(data, recent);
      if (nextCelebration) {
        setCelebration(nextCelebration);
        void runExperienceCue(nextCelebration.cue, settingsRef.current);
      }
      scheduleEnhancement();
    };
    window.addEventListener('isivolt:data-updated', handleDataUpdated);

    return () => {
      observer.disconnect();
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('isivolt:data-updated', handleDataUpdated);
      window.clearTimeout(scheduled);
    };
  }, []);

  useEffect(() => {
    if (!celebration) return undefined;
    const timeout = window.setTimeout(() => setCelebration(null), 3400);
    return () => window.clearTimeout(timeout);
  }, [celebration]);

  const updateSettings = (patch: Partial<ExperienceSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    settingsRef.current = next;
    void saveExperienceSettings(next);
    if (patch.soundEnabled) void runExperienceCue('scan', next);
  };

  return (
    <>
      <AppV5 />

      <motion.button className="experience-settings-button" onClick={() => setSettingsOpen(true)} whileTap={{ scale: 0.9 }} aria-label="Ajustes de sonido y vibración">
        <Settings2 size={20} /><span>{settings.soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}</span>
      </motion.button>

      <AnimatePresence>
        {selectedTool && (
          <ToolPhotoModal
            tool={selectedTool}
            settings={settings}
            onClose={() => setSelectedTool(null)}
            onSaved={(tool) => {
              setSelectedTool(tool);
              window.setTimeout(enhanceToolCards, 60);
            }}
          />
        )}

        {settingsOpen && (
          <motion.div className="experience-settings-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSettingsOpen(false)}>
            <motion.section className="experience-settings-panel" initial={{ y: 38, scale: 0.9 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.96 }} onClick={(event) => event.stopPropagation()}>
              <button className="experience-settings-close" onClick={() => setSettingsOpen(false)}><X size={19} /></button>
              <span className="experience-settings-kicker"><Sparkles size={14} /> Experiencia operativa</span>
              <h2>Respuesta de la aplicación</h2>
              <p>Personaliza los efectos sin cambiar la trazabilidad ni los datos.</p>
              <button className={settings.soundEnabled ? 'active' : ''} onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}>
                {settings.soundEnabled ? <Volume2 size={23} /> : <VolumeX size={23} />}
                <span><strong>Sonidos de operación</strong><small>Escaneo, salida, entrada y avisos</small></span>
                <i>{settings.soundEnabled ? 'ON' : 'OFF'}</i>
              </button>
              <button className={settings.hapticsEnabled ? 'active' : ''} onClick={() => updateSettings({ hapticsEnabled: !settings.hapticsEnabled })}>
                {settings.hapticsEnabled ? <Vibrate size={23} /> : <VibrateOff size={23} />}
                <span><strong>Vibración</strong><small>Confirmaciones y errores</small></span>
                <i>{settings.hapticsEnabled ? 'ON' : 'OFF'}</i>
              </button>
            </motion.section>
          </motion.div>
        )}

        {celebration && <CelebrationOverlay key={celebration.id} celebration={celebration} />}
      </AnimatePresence>
    </>
  );
}
