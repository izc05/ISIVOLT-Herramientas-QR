import { useEffect, useMemo, useState } from 'react';
import { Check, Laptop, Moon, Palette, Sun, X } from 'lucide-react';
import { getCurrentSecurityUser } from '../../security/session';

export type AppearanceMode = 'dark' | 'light' | 'system';
type EffectiveTheme = 'dark' | 'light';

const STORAGE_PREFIX = 'isivolt:appearance-mode';

const options: Array<{
  mode: AppearanceMode;
  label: string;
  detail: string;
  Icon: typeof Sun;
}> = [
  { mode: 'light', label: 'Claro', detail: 'Fondo blanco y alto contraste', Icon: Sun },
  { mode: 'dark', label: 'Oscuro', detail: 'Aspecto técnico actual', Icon: Moon },
  { mode: 'system', label: 'Automático', detail: 'Sigue la configuración del dispositivo', Icon: Laptop },
];

const storageKey = () => `${STORAGE_PREFIX}:${getCurrentSecurityUser()?.id ?? 'device'}`;

const readMode = (): AppearanceMode => {
  const stored = window.localStorage.getItem(storageKey());
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
};

const resolveTheme = (mode: AppearanceMode, prefersDark: boolean): EffectiveTheme =>
  mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;

const applyTheme = (mode: AppearanceMode, prefersDark: boolean) => {
  const theme = resolveTheme(mode, prefersDark);
  document.documentElement.dataset.appearance = mode;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new CustomEvent('isivolt:appearance-changed', { detail: { mode, theme } }));
};

export default function AppearanceController() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AppearanceMode>(() => readMode());
  const media = useMemo(() => window.matchMedia('(prefers-color-scheme: dark)'), []);

  useEffect(() => {
    const synchronize = () => applyTheme(mode, media.matches);
    synchronize();
    media.addEventListener('change', synchronize);
    return () => media.removeEventListener('change', synchronize);
  }, [media, mode]);

  useEffect(() => {
    const refreshIdentity = () => setMode(readMode());
    const openPanel = () => setOpen(true);
    window.addEventListener('isivolt:security-session', refreshIdentity);
    window.addEventListener('isivolt:central-account-changed', refreshIdentity);
    window.addEventListener('isivolt:appearance-open', openPanel);
    return () => {
      window.removeEventListener('isivolt:security-session', refreshIdentity);
      window.removeEventListener('isivolt:central-account-changed', refreshIdentity);
      window.removeEventListener('isivolt:appearance-open', openPanel);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const choose = (nextMode: AppearanceMode) => {
    window.localStorage.setItem(storageKey(), nextMode);
    setMode(nextMode);
  };

  return (
    <>
      <button
        className="appearance-launcher"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cambiar apariencia"
      >
        <Palette size={18} />
      </button>

      {open && (
        <div className="appearance-backdrop" onClick={() => setOpen(false)}>
          <section
            className="appearance-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="appearance-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span><Palette size={22} /></span>
                <div>
                  <small>Personalización</small>
                  <h2 id="appearance-title">Apariencia de la aplicación</h2>
                  <p>Elige el estilo más cómodo para este dispositivo.</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar apariencia"><X size={20} /></button>
            </header>

            <div className="appearance-options">
              {options.map(({ mode: optionMode, label, detail, Icon }) => (
                <button
                  type="button"
                  key={optionMode}
                  className={mode === optionMode ? 'active' : ''}
                  onClick={() => choose(optionMode)}
                >
                  <span><Icon size={23} /></span>
                  <span><strong>{label}</strong><small>{detail}</small></span>
                  {mode === optionMode && <Check size={20} />}
                </button>
              ))}
            </div>

            <footer>
              La preferencia queda guardada para tu usuario en este equipo.
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
