import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, UserRound, X } from 'lucide-react';
import type { Technician } from '../../domain/types';
import { assertPermission } from '../../security/permissions';
import { loadAppData, saveAppData } from '../../services/storage';
import { buildTechnicianCategories } from './selector';

type Props = { onSaved: () => void };

const newId = () => `tech-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

const nextTechnicianCode = (technicians: Technician[]) => {
  const used = new Set(technicians.map((item) => item.code.toUpperCase()));
  let sequence = technicians.length + 1;
  while (used.has(`TEC-${String(sequence).padStart(3, '0')}`)) sequence += 1;
  return `TEC-${String(sequence).padStart(3, '0')}`;
};

export default function TechnicianQuickCreate({ onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Mantenimiento');
  const [customCategory, setCustomCategory] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [extension, setExtension] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const data = useMemo(() => loadAppData(), [open]);
  const categories = useMemo(() => buildTechnicianCategories(data.technicians), [data.technicians]);
  const code = useMemo(() => nextTechnicianCode(data.technicians), [data.technicians]);
  const finalCategory = category === 'Otra' ? customCategory.trim() : category;

  const reset = () => {
    setName('');
    setCategory('Mantenimiento');
    setCustomCategory('');
    setRole('');
    setPhone('');
    setExtension('');
    setEmail('');
    setError('');
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  useEffect(() => {
    const intercept = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button || !button.textContent?.includes('Nuevo técnico')) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setError('');
      setOpen(true);
    };
    document.addEventListener('click', intercept, true);
    return () => document.removeEventListener('click', intercept, true);
  }, []);

  const save = () => {
    try {
      assertPermission('technicians.manage');
      if (!name.trim()) throw new Error('Escribe el nombre y los apellidos.');
      if (!finalCategory) throw new Error('Selecciona o escribe una categoría.');
      if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Revisa el correo electrónico.');

      const current = loadAppData();
      const timestamp = new Date().toISOString();
      const technician: Technician = {
        id: newId(),
        code: nextTechnicianCode(current.technicians),
        name: name.trim(),
        specialty: finalCategory,
        role: role.trim() || undefined,
        phone: phone.trim() || undefined,
        extension: extension.trim() || undefined,
        email: email.trim() || undefined,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      saveAppData({ ...current, technicians: [technician, ...current.technicians] });
      close();
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido crear el técnico.');
    }
  };

  if (!open) return null;

  return (
    <div className="technician-create-backdrop" onClick={close}>
      <section className="technician-create-modal" role="dialog" aria-modal="true" aria-label="Nuevo técnico" onClick={(event) => event.stopPropagation()}>
        <header>
          <div><span><UserRound size={23} /></span><div><small>Personal</small><h2>Nuevo técnico</h2><p>Clasifica el profesional para encontrarlo rápidamente en las entregas.</p></div></div>
          <button type="button" onClick={close} aria-label="Cerrar"><X size={21} /></button>
        </header>

        <main>
          <label className="wide">Nombre y apellidos<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre y apellidos" autoFocus /></label>
          <label className="wide">Categoría principal
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => <option value={item} key={item}>{item}</option>)}
              <option value="Otra">Otra categoría…</option>
            </select>
          </label>
          {category === 'Otra' && <label className="wide">Nueva categoría<input value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} placeholder="Ej. Albañilería" /></label>}
          <label>Cargo o función<input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Oficial, encargado…" /></label>
          <label>Teléfono<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" /></label>
          <label>Extensión<input value={extension} onChange={(event) => setExtension(event.target.value)} inputMode="numeric" /></label>
          <label>Correo<input value={email} onChange={(event) => setEmail(event.target.value)} inputMode="email" /></label>
          {error && <p className="technician-create-error"><AlertTriangle size={17} /> {error}</p>}
        </main>

        <footer>
          <span>Código automático: <strong>{code}</strong></span>
          <button type="button" onClick={save} disabled={!name.trim() || !finalCategory}><Plus size={18} /> Crear técnico</button>
        </footer>
      </section>
    </div>
  );
}
