import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle2, CircleAlert, CircleX, Settings2, Volume2, VolumeX, Vibrate } from 'lucide-react';
import { createPortal } from 'react-dom';

type FeedbackKind = 'success' | 'warning' | 'error' | 'complete';

type FeedbackState = {
  id: number;
  kind: FeedbackKind;
  title: string;
  detail: string;
};

type FeedbackPreferences = {
  sound: boolean;
  vibration: boolean;
  reducedMotion: boolean;
};

const STORAGE_KEY = 'isivoltpro:scan-feedback-preferences';
const DEFAULT_PREFERENCES: FeedbackPreferences = {
  sound: true,
  vibration: true,
  reducedMotion: false,
};

function loadPreferences(): FeedbackPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<FeedbackPreferences> | null;
    return {
      sound: value?.sound ?? true,
      vibration: value?.vibration ?? true,
      reducedMotion: value?.reducedMotion ?? false,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function classifyMessage(message: string): FeedbackKind | null {
  const normalized = message.toLocaleLowerCase('es-ES');
  if (!normalized) return null;
  if (normalized.includes('registrado') || normalized.includes('devolución registrada')) return 'complete';
  if (normalized.includes('añadido') || normalized.includes('identificado correctamente') || normalized.includes('seleccionado manualmente')) return 'success';
  if (normalized.includes('ya está incluido') || normalized.includes('no está disponible') || normalized.includes('no figura prestado') || normalized.includes('requiere android')) return 'warning';
  if (normalized.includes('no se ha encontrado') || normalized.includes('no se ha podido') || normalized.includes('no contiene')) return 'error';
  return null;
}

function feedbackCopy(kind: FeedbackKind, message: string): Omit<FeedbackState, 'id'> {
  if (kind === 'complete') return { kind, title: 'Operación finalizada', detail: message };
  if (kind === 'success') return { kind, title: 'Lectura correcta', detail: message };
  if (kind === 'warning') return { kind, title: 'Revisar artículo', detail: message };
  return { kind, title: 'Lectura rechazada', detail: message };
}

function playTone(kind: FeedbackKind, audioContextRef: React.MutableRefObject<AudioContext | null>) {
  const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return;
  const context = audioContextRef.current ?? new AudioContextConstructor();
  audioContextRef.current = context;
  void context.resume();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  const frequency = kind === 'success' ? 880 : kind === 'complete' ? 660 : kind === 'warning' ? 420 : 220;
  oscillator.type = kind === 'error' ? 'square' : 'sine';
  oscillator.frequency.setValueAtTime(frequency, now);
  if (kind === 'complete') oscillator.frequency.exponentialRampToValueAtTime(990, now + 0.16);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'complete' ? 0.28 : 0.16));
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + (kind === 'complete' ? 0.3 : 0.18));
}

function vibrate(kind: FeedbackKind) {
  if (!navigator.vibrate) return;
  if (kind === 'success') navigator.vibrate(45);
  else if (kind === 'complete') navigator.vibrate([60, 40, 100]);
  else if (kind === 'warning') navigator.vibrate([50, 45, 50]);
  else navigator.vibrate([80, 45, 80]);
}

export default function ScanFeedbackLayer() {
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [preferences, setPreferences] = useState<FeedbackPreferences>(() => loadPreferences());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [headerTarget, setHeaderTarget] = useState<Element | null>(null);
  const previousMessage = useRef('');
  const previousCount = useRef(0);
  const feedbackSequence = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const persistPreferences = (next: FeedbackPreferences) => {
    setPreferences(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    let feedbackTimer = 0;
    const emit = (kind: FeedbackKind, message: string) => {
      const next = { id: ++feedbackSequence.current, ...feedbackCopy(kind, message) };
      setFeedback(next);
      window.clearTimeout(feedbackTimer);
      feedbackTimer = window.setTimeout(() => setFeedback((current) => current?.id === next.id ? null : current), kind === 'complete' ? 2400 : 1250);
      if (preferences.sound) playTone(kind, audioContextRef);
      if (preferences.vibration) vibrate(kind);
    };

    const inspect = () => {
      const header = document.querySelector('.scan-session-header');
      setHeaderTarget((current) => current === header ? current : header);
      if (!header) {
        previousMessage.current = '';
        previousCount.current = 0;
        setSettingsOpen(false);
        return;
      }

      const message = document.querySelector('.scan-message')?.textContent?.trim() ?? '';
      if (message && message !== previousMessage.current) {
        previousMessage.current = message;
        const kind = classifyMessage(message);
        if (kind) emit(kind, message);
      }

      const count = document.querySelectorAll('.scan-tool-list article').length;
      if (count > previousCount.current && !message.includes('añadido')) {
        emit('success', `${count} artículo${count === 1 ? '' : 's'} en el lote.`);
      }
      previousCount.current = count;

      if (document.querySelector('.scan-complete-screen') && !message) {
        emit('complete', 'El lote se ha guardado correctamente.');
      }
    };

    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    inspect();
    return () => {
      observer.disconnect();
      window.clearTimeout(feedbackTimer);
    };
  }, [preferences.sound, preferences.vibration]);

  useEffect(() => () => {
    void audioContextRef.current?.close();
  }, []);

  const launcher = headerTarget ? createPortal(
    <button className="scan-feedback-settings-trigger" type="button" onClick={() => setSettingsOpen((current) => !current)} aria-label="Preferencias de respuesta del escáner" title="Sonido, vibración y animaciones">
      <Settings2 size={18} />
    </button>,
    headerTarget,
  ) : null;

  return (
    <>
      {launcher}
      {feedback && createPortal(
        <div className={`scan-feedback-flash kind-${feedback.kind}${preferences.reducedMotion ? ' reduced-motion' : ''}`} role="status" aria-live="polite">
          <div className="scan-feedback-icon">
            {feedback.kind === 'success' && <CheckCircle2 size={48} />}
            {feedback.kind === 'complete' && <Bell size={48} />}
            {feedback.kind === 'warning' && <CircleAlert size={48} />}
            {feedback.kind === 'error' && <CircleX size={48} />}
          </div>
          <div><strong>{feedback.title}</strong><p>{feedback.detail}</p></div>
        </div>,
        document.body,
      )}

      {settingsOpen && createPortal(
        <div className="scan-feedback-settings" role="dialog" aria-label="Preferencias del escáner">
          <header><div><small>RESPUESTA DEL ESCÁNER</small><strong>Confirmaciones</strong></div><button type="button" onClick={() => setSettingsOpen(false)} aria-label="Cerrar"><CircleX size={19} /></button></header>
          <label><span>{preferences.sound ? <Volume2 size={19} /> : <VolumeX size={19} />}<span><strong>Sonido</strong><small>Tono distinto para acierto, aviso y error.</small></span></span><input type="checkbox" checked={preferences.sound} onChange={(event) => persistPreferences({ ...preferences, sound: event.target.checked })} /></label>
          <label><span><Vibrate size={19} /><span><strong>Vibración</strong><small>Respuesta háptica cuando el dispositivo sea compatible.</small></span></span><input type="checkbox" checked={preferences.vibration} onChange={(event) => persistPreferences({ ...preferences, vibration: event.target.checked })} /></label>
          <label><span><Settings2 size={19} /><span><strong>Reducir animaciones</strong><small>Mantiene color y texto sin movimientos intensos.</small></span></span><input type="checkbox" checked={preferences.reducedMotion} onChange={(event) => persistPreferences({ ...preferences, reducedMotion: event.target.checked })} /></label>
        </div>,
        document.body,
      )}
    </>
  );
}
