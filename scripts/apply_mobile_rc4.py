#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = '1.0.0-rc.4'

package_path = ROOT / 'package.json'
package = json.loads(package_path.read_text(encoding='utf-8'))
package['version'] = VERSION
package_path.write_text(json.dumps(package, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

lock_path = ROOT / 'package-lock.json'
if lock_path.exists():
    lock = json.loads(lock_path.read_text(encoding='utf-8'))
    lock['version'] = VERSION
    if isinstance(lock.get('packages'), dict) and isinstance(lock['packages'].get(''), dict):
        lock['packages']['']['version'] = VERSION
    lock_path.write_text(json.dumps(lock, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

config_path = ROOT / 'src/config/app.ts'
config = config_path.read_text(encoding='utf-8')
config = re.sub(r"APP_VERSION = '[^']+'", f"APP_VERSION = '{VERSION}'", config)
config_path.write_text(config, encoding='utf-8')

app_path = ROOT / 'src/AppV2.tsx'
app = app_path.read_text(encoding='utf-8')
import_marker = "import { hospitalTechnicians, technicianSpecialties } from './data/technicians';"
extra_import = "import { BASE_TECHNICIAN_CATEGORIES } from './features/technicians/selector';"
if extra_import not in app:
    app = app.replace(import_marker, import_marker + '\n' + extra_import, 1)

start = app.index('function TechnicianFormModal({')
end = app.index('\nfunction AppHeader(', start)
replacement = r'''function TechnicianFormModal({
  technicianCount,
  onClose,
  onSave,
}: {
  technicianCount: number;
  onClose: () => void;
  onSave: (technician: Technician) => void;
}) {
  const categories = useMemo(
    () => [...new Set([...BASE_TECHNICIAN_CATEGORIES, ...technicianSpecialties])],
    [],
  );
  const [name, setName] = useState('');
  const [specialtyChoice, setSpecialtyChoice] = useState('Mantenimiento');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [extension, setExtension] = useState('');
  const [email, setEmail] = useState('');
  const specialty = specialtyChoice === 'Otra' ? customSpecialty.trim() : specialtyChoice;

  const save = () => {
    if (!name.trim() || !specialty) return;
    const timestamp = new Date().toISOString();
    onSave({
      id: newId('tech'),
      name: name.trim(),
      code: `TEC-${String(technicianCount + 1).padStart(3, '0')}`,
      specialty,
      role: role.trim() || undefined,
      phone: phone.trim() || undefined,
      extension: extension.trim() || undefined,
      email: email.trim() || undefined,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  };

  return (
    <ModalFrame onClose={onClose}>
      <div className="modal-heading">
        <span className="eyebrow"><UserRound size={14} /> Personal</span>
        <h2>Nuevo técnico</h2>
        <p>Se añadirá al directorio con una categoría clara y podrá recibir herramientas inmediatamente.</p>
      </div>
      <div className="form-grid technician-create-grid">
        <label className="field-label full-field">Nombre y apellidos<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre y apellidos" /></label>
        <label className="field-label full-field">Categoría principal
          <select value={specialtyChoice} onChange={(event) => setSpecialtyChoice(event.target.value)}>
            {categories.map((item) => <option value={item} key={item}>{item}</option>)}
            <option value="Otra">Otra categoría…</option>
          </select>
        </label>
        {specialtyChoice === 'Otra' && (
          <label className="field-label full-field">Nueva categoría<input value={customSpecialty} onChange={(event) => setCustomSpecialty(event.target.value)} placeholder="Ej. Albañilería" /></label>
        )}
        <label className="field-label">Cargo o función<input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Oficial, encargado…" /></label>
        <label className="field-label">Teléfono<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" /></label>
        <label className="field-label">Extensión<input value={extension} onChange={(event) => setExtension(event.target.value)} inputMode="numeric" /></label>
        <label className="field-label">Correo<input value={email} onChange={(event) => setEmail(event.target.value)} inputMode="email" /></label>
      </div>
      <div className="modal-footer">
        <span>Código automático: TEC-{String(technicianCount + 1).padStart(3, '0')}</span>
        <button className="primary-button" disabled={!name.trim() || !specialty} onClick={save}>
          <Plus size={18} /> Crear técnico
        </button>
      </div>
    </ModalFrame>
  );
}
'''
app = app[:start] + replacement + app[end:]
app_path.write_text(app, encoding='utf-8')

workflow_path = ROOT / '.github/workflows/production-readiness.yml'
workflow = workflow_path.read_text(encoding='utf-8')
branch_line = '      - fix/mobile-ui-technician-selector-1.0.0-rc.4'
if branch_line not in workflow:
    workflow = workflow.replace('      - fix/android-assets-1.0.0-rc.3', '      - fix/android-assets-1.0.0-rc.3\n' + branch_line)
workflow = re.sub(r'ISIVOLT-Herramientas-QR-v1\.0\.0-rc\.\d+-debug', 'ISIVOLT-Herramientas-QR-v1.0.0-rc.4-debug', workflow)
workflow = re.sub(r'ISIVOLT-v1\.0\.0-rc\.\d+-metadata', 'ISIVOLT-v1.0.0-rc.4-metadata', workflow)
workflow_path.write_text(workflow, encoding='utf-8')

print('Parche móvil rc.4 aplicado.')
