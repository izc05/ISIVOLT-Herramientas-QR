import { useEffect, useRef, useState } from 'react';
import { Check, Settings2, UserRound, X } from 'lucide-react';
import { Preferences } from '@capacitor/preferences';

const GREETING_NAME_KEY = 'isivolt.greeting-name.v1';
const DEFAULT_NAME = 'Isi';

const greetingForHour = (hour: number) => {
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
};

const cleanName = (value: string) => value.trim().replace(/\s+/g, ' ').slice(0, 36);

export default function GreetingSettings() {
  const [name, setName] = useState(DEFAULT_NAME);
  const [draft, setDraft] = useState(DEFAULT_NAME);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const nameRef = useRef(DEFAULT_NAME);

  const applyGreeting = () => {
    const greeting = `${greetingForHour(new Date().getHours())}, ${nameRef.current}`;
    document.querySelectorAll<HTMLElement>('.game-hero h1').forEach((heading) => {
      if (heading.textContent !== greeting) heading.textContent = greeting;
    });
  };

  useEffect(() => {
    let active = true;
    void Preferences.get({ key: GREETING_NAME_KEY }).then(({ value }) => {
      if (!active) return;
      const restored = cleanName(value ?? '') || DEFAULT_NAME;
      nameRef.current = restored;
      setName(restored);
      setDraft(restored);
      applyGreeting();
    });

    const observer = new MutationObserver(applyGreeting);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(applyGreeting, 60_000);

    const interceptProfile = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.profile-button')) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setDraft(nameRef.current);
      setSaved(false);
      setOpen(true);
    };

    document.addEventListener('click', interceptProfile, true);
    return () => {
      active = false;
      observer.disconnect();
      window.clearInterval(timer);
      document.removeEventListener('click', interceptProfile, true);
    };
  }, []);

  const save = async () => {
    const nextName = cleanName(draft) || DEFAULT_NAME;
    await Preferences.set({ key: GREETING_NAME_KEY, value: nextName });
    nameRef.current = nextName;
    setName(nextName);
    setDraft(nextName);
    setSaved(true);
    applyGreeting();
    navigator.vibrate?.([50, 30, 80]);
    window.setTimeout(() => setOpen(false), 700);
  };

  const initials = name.split(' ').map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'IZ';

  useEffect(() => {
    document.querySelectorAll<HTMLElement>('.profile-button span').forEach((element) => {
      element.textContent = initials;
    });
  }, [initials]);

  if (!open) return null;

  return (
    <div className="greeting-settings-backdrop" onClick={() => setOpen(false)}>
      <section className="greeting-settings-panel" role="dialog" aria-modal="true" aria-label="Personalizar saludo" onClick={(event) => event.stopPropagation()}>
        <header>
          <div><span><Settings2 size={22} /></span><div><small>Personalización local</small><h2>Saludo de inicio</h2><p>Este nombre solo se guarda en el dispositivo.</p></div></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20} /></button>
        </header>

        <div className="greeting-settings-preview">
          <span><UserRound size={24} /></span>
          <div><small>Vista previa</small><strong>{greetingForHour(new Date().getHours())}, {cleanName(draft) || DEFAULT_NAME}</strong></div>
        </div>

        <label>
          Nombre mostrado
          <input value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus placeholder="Isi" maxLength={36} />
        </label>

        <footer>
          <button type="button" onClick={() => setOpen(false)}>Cancelar</button>
          <button className="primary" type="button" onClick={() => { void save(); }}>
            {saved ? <Check size={18} /> : <Settings2 size={18} />}
            {saved ? 'Guardado' : 'Guardar saludo'}
          </button>
        </footer>
      </section>
    </div>
  );
}
