#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = '1.0.0-rc.6'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise RuntimeError(f'No se encontró el bloque: {label}')
    return text.replace(old, new, 1)


path = ROOT / 'src/AppV4.tsx'
content = path.read_text(encoding='utf-8')

content = replace_once(
    content,
    "import TechnicianSelectorPanel from './features/technicians/TechnicianSelectorPanel';",
    "import TechnicianSelectorPanel from './features/technicians/TechnicianSelectorPanel';\nimport ToolSelectorPanel from './features/inventory/ToolSelectorPanel';",
    'import selector de herramientas',
)

content = replace_once(
    content,
    "  const [selectorOpen, setSelectorOpen] = useState(false);",
    "  const [selectorOpen, setSelectorOpen] = useState(false);\n  const [toolSelectorOpen, setToolSelectorOpen] = useState(false);",
    'estado selector herramientas',
)

content = replace_once(
    content,
    "    setSelectorOpen(false);\n    setScanAlert(null);",
    "    setSelectorOpen(false);\n    setToolSelectorOpen(false);\n    setScanAlert(null);",
    'reset selector herramientas',
)

content = replace_once(
    content,
    "    setSelectorOpen(false);\n    setScanAlert(null);\n    setWorkflowOpen(false);",
    "    setSelectorOpen(false);\n    setToolSelectorOpen(false);\n    setScanAlert(null);\n    setWorkflowOpen(false);",
    'cierre selector herramientas',
)

insert_marker = "  const handleScan = async () => {"
helper = '''  const selectToolManually = (toolId: string) => {
    const foundTool = sessionData.tools.find((item) => item.id === toolId);
    if (!foundTool) {
      setScannerMessage('La herramienta seleccionada ya no existe.');
      return false;
    }

    if (mode === 'delivery') {
      const deliveryAlert = getDeliveryAlert(foundTool, technician?.id);
      if (deliveryAlert) {
        setToolSelectorOpen(false);
        setScanAlert({ tool: foundTool, title: deliveryAlert.title, detail: deliveryAlert.detail });
        setScannerMessage(`${deliveryAlert.title}: ${deliveryAlert.detail}`);
        navigator.vibrate?.([180, 70, 180]);
        return false;
      }
    }

    const requiredStatus: ToolStatus = mode === 'delivery' ? 'available' : 'loaned';
    if (foundTool.status !== requiredStatus) {
      setScannerMessage(`${foundTool.name} está ${toolStatusLabel[foundTool.status].toLowerCase()} y no puede añadirse.`);
      return false;
    }
    if (tools.some((item) => item.id === foundTool.id)) {
      setScannerMessage(`${foundTool.name} ya estaba añadida a esta operación.`);
      return false;
    }

    setTools((current) => [...current, foundTool]);
    setToolSelectorOpen(false);
    setScannerMessage(`${foundTool.name} añadida manualmente. Puedes añadir otra o confirmar.`);
    navigator.vibrate?.([60, 35, 80]);
    return true;
  };

'''
if helper not in content:
    if insert_marker not in content:
        raise RuntimeError('No se encontró handleScan')
    content = content.replace(insert_marker, helper + insert_marker, 1)

old_scan_block = '''    if (mode === 'delivery') {
      const deliveryAlert = getDeliveryAlert(foundTool, technician?.id);
      if (deliveryAlert) {
        setScanAlert({ tool: foundTool, title: deliveryAlert.title, detail: deliveryAlert.detail });
        setScannerMessage(`${deliveryAlert.title}: ${deliveryAlert.detail}`);
        setFeedback({ title: deliveryAlert.title, detail: deliveryAlert.detail, tone: 'error' });
        navigator.vibrate?.([180, 70, 180, 70, 220]);
        return;
      }
    }

    const requiredStatus: ToolStatus = mode === 'delivery' ? 'available' : 'loaned';
    if (foundTool.status !== requiredStatus) {
      setScannerMessage(
        `${foundTool.name} está ${toolStatusLabel[foundTool.status].toLowerCase()} y no puede usarse en esta operación.`,
      );
      navigator.vibrate?.([120, 60, 120]);
      return;
    }

    if (tools.some((tool) => tool.id === foundTool.id)) {
      setScannerMessage(`${foundTool.name} ya estaba añadida a esta operación.`);
      return;
    }

    setTools((current) => [...current, foundTool]);
    setScannerMessage(`${foundTool.name} añadida. Puedes escanear otra o confirmar la operación.`);
    navigator.vibrate?.([60, 35, 80]);
'''
new_scan_block = '''    selectToolManually(foundTool.id);
'''
content = replace_once(content, old_scan_block, new_scan_block, 'reutilización de selección de herramienta')

old_selector = '''              {selectorOpen ? (
                <TechnicianSelectorPanel
                  technicians={sessionData.technicians}
                  tools={sessionData.tools}
                  onSelect={selectTechnician}
                  onBack={() => setSelectorOpen(false)}
                />
              ) : (
'''
new_selector = '''              {selectorOpen ? (
                <TechnicianSelectorPanel
                  technicians={sessionData.technicians}
                  tools={sessionData.tools}
                  onSelect={selectTechnician}
                  onBack={() => setSelectorOpen(false)}
                />
              ) : toolSelectorOpen ? (
                <ToolSelectorPanel
                  tools={sessionData.tools}
                  mode={mode}
                  selectedIds={tools.map((tool) => tool.id)}
                  onSelect={selectToolManually}
                  onBack={() => setToolSelectorOpen(false)}
                />
              ) : (
'''
content = replace_once(content, old_selector, new_selector, 'selector manual de herramientas')

manual_marker = '''                  {mode === 'delivery' && !technician && (
                    <button className="native-manual-technician" type="button" onClick={() => setSelectorOpen(true)}>
                      <ListFilter size={19} />
                      <span><strong>Seleccionar técnico manualmente</strong><small>Buscar por nombre, código o categoría</small></span>
                    </button>
                  )}
'''
manual_new = manual_marker + '''
                  {(mode === 'return' || technician) && (
                    <button className="native-manual-tool" type="button" onClick={() => setToolSelectorOpen(true)}>
                      <ListFilter size={19} />
                      <span><strong>Seleccionar herramienta manualmente</strong><small>Buscar por nombre, código, categoría o ubicación</small></span>
                    </button>
                  )}
'''
content = replace_once(content, manual_marker, manual_new, 'botón selección herramienta')

path.write_text(content, encoding='utf-8')

# Refuerza el texto de categoría del selector de técnicos.
tech_path = ROOT / 'src/features/technicians/TechnicianSelectorPanel.tsx'
tech = tech_path.read_text(encoding='utf-8')
tech = tech.replace('placeholder="Nombre, código o especialidad…"', 'placeholder="Nombre, código, oficio o categoría…"')
tech = tech.replace('<option value="Todas">Todas las categorías</option>', '<option value="Todas">Todas las categorías / oficios</option>')
tech_path.write_text(tech, encoding='utf-8')

main_path = ROOT / 'src/main.tsx'
main = main_path.read_text(encoding='utf-8')
if "import './rc6-mobile.css';" not in main:
    main = main.replace("import './mobile-optimization-rc4.css';", "import './mobile-optimization-rc4.css';\nimport './rc6-mobile.css';")
main_path.write_text(main, encoding='utf-8')

package_path = ROOT / 'package.json'
package = json.loads(package_path.read_text(encoding='utf-8'))
package['version'] = VERSION
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

lock_path = ROOT / 'package-lock.json'
lock = json.loads(lock_path.read_text(encoding='utf-8'))
lock['version'] = VERSION
if isinstance(lock.get('packages', {}).get(''), dict):
    lock['packages']['']['version'] = VERSION
lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

config_path = ROOT / 'src/config/app.ts'
config = config_path.read_text(encoding='utf-8')
config = re.sub(r"APP_VERSION = '[^']+'", f"APP_VERSION = '{VERSION}'", config)
config_path.write_text(config, encoding='utf-8')

workflow_path = ROOT / '.github/workflows/production-readiness.yml'
workflow = workflow_path.read_text(encoding='utf-8')
workflow = workflow.replace('ISIVOLT-Herramientas-QR-v1.0.0-rc.5-debug', 'ISIVOLT-Herramientas-QR-v1.0.0-rc.6-debug')
workflow = workflow.replace('ISIVOLT-v1.0.0-rc.5-metadata', 'ISIVOLT-v1.0.0-rc.6-metadata')
if 'feature/rc6-mobile-operations-printing' not in workflow:
    workflow = workflow.replace('      - feature/inventory-operations-1.0.0-rc.5', '      - feature/inventory-operations-1.0.0-rc.5\n      - feature/rc6-mobile-operations-printing')
workflow_path.write_text(workflow, encoding='utf-8')

print('Integración rc.6 aplicada correctamente.')
