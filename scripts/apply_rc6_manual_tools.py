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
    "import { formatOperationDateTime, getDeliveryAlert } from './features/inventory/inventoryOperations';",
    "import { formatOperationDateTime, getDeliveryAlert } from './features/inventory/inventoryOperations';\nimport ToolSelectorPanel from './features/inventory/ToolSelectorPanel';",
    'import ToolSelectorPanel',
)

content = replace_once(
    content,
    "  const [selectorOpen, setSelectorOpen] = useState(false);",
    "  const [selectorOpen, setSelectorOpen] = useState(false);\n  const [toolSelectorOpen, setToolSelectorOpen] = useState(false);",
    'estado selector herramientas',
)

content = content.replace(
    "    setSelectorOpen(false);\n    setScanAlert(null);",
    "    setSelectorOpen(false);\n    setToolSelectorOpen(false);\n    setScanAlert(null);",
)

marker = "  const handleScan = async () => {"
select_tool = """  const selectTool = (toolId: string) => {
    const foundTool = sessionData.tools.find((item) => item.id === toolId);
    if (!foundTool) {
      setScannerMessage('La herramienta seleccionada ya no existe en el inventario.');
      return false;
    }

    if (mode === 'delivery') {
      const deliveryAlert = getDeliveryAlert(foundTool, technician?.id);
      if (deliveryAlert) {
        setScanAlert({ tool: foundTool, title: deliveryAlert.title, detail: deliveryAlert.detail });
        setScannerMessage(`${deliveryAlert.title}: ${deliveryAlert.detail}`);
        setFeedback({ title: deliveryAlert.title, detail: deliveryAlert.detail, tone: 'error' });
        navigator.vibrate?.([180, 70, 180, 70, 220]);
        return false;
      }
    }

    const requiredStatus: ToolStatus = mode === 'delivery' ? 'available' : 'loaned';
    if (foundTool.status !== requiredStatus) {
      setScannerMessage(`${foundTool.name} está ${toolStatusLabel[foundTool.status].toLowerCase()} y no puede usarse en esta operación.`);
      navigator.vibrate?.([120, 60, 120]);
      return false;
    }

    if (tools.some((tool) => tool.id === foundTool.id)) {
      setScannerMessage(`${foundTool.name} ya estaba añadida a esta operación.`);
      return false;
    }

    setTools((current) => [...current, foundTool]);
    setScannerMessage(`${foundTool.name} añadida. Puedes escanear o buscar otra herramienta y confirmar.`);
    navigator.vibrate?.([60, 35, 80]);
    return true;
  };

"""
if select_tool not in content:
    if marker not in content:
        raise RuntimeError('No se encontró handleScan')
    content = content.replace(marker, select_tool + marker, 1)

old_validation = """    if (mode === 'delivery') {
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
"""
content = replace_once(content, old_validation, "    selectTool(foundTool.id);\n", 'validación común QR/manual')

old_selector = """              {selectorOpen ? (
                <TechnicianSelectorPanel
                  technicians={sessionData.technicians}
                  tools={sessionData.tools}
                  onSelect={selectTechnician}
                  onBack={() => setSelectorOpen(false)}
                />
              ) : (
                <>"""
new_selector = """              {selectorOpen ? (
                <TechnicianSelectorPanel
                  technicians={sessionData.technicians}
                  tools={sessionData.tools}
                  onSelect={selectTechnician}
                  onBack={() => setSelectorOpen(false)}
                />
              ) : toolSelectorOpen ? (
                <ToolSelectorPanel
                  tools={sessionData.tools}
                  technicians={sessionData.technicians}
                  mode={mode}
                  selectedIds={tools.map((tool) => tool.id)}
                  onSelect={selectTool}
                  onBack={() => setToolSelectorOpen(false)}
                />
              ) : (
                <>"""
content = replace_once(content, old_selector, new_selector, 'render selector herramientas')

manual_technician = """                  {mode === 'delivery' && !technician && (
                    <button className="native-manual-technician" type="button" onClick={() => setSelectorOpen(true)}>
                      <ListFilter size={19} />
                      <span><strong>Seleccionar técnico manualmente</strong><small>Buscar por nombre, código o categoría</small></span>
                    </button>
                  )}
"""
manual_tool = manual_technician + """
                  {(mode === 'return' || technician) && (
                    <button className="native-manual-tool" type="button" onClick={() => setToolSelectorOpen(true)}>
                      <ListFilter size={19} />
                      <span><strong>Buscar herramienta manualmente</strong><small>Filtrar por nombre, código, ubicación o categoría</small></span>
                    </button>
                  )}
"""
content = replace_once(content, manual_technician, manual_tool, 'botón selección manual herramienta')

path.write_text(content, encoding='utf-8')

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
if 'feature/rc6-labels-manual-selection' not in workflow:
    workflow = workflow.replace('      - feature/inventory-operations-1.0.0-rc.5', '      - feature/inventory-operations-1.0.0-rc.5\n      - feature/rc6-labels-manual-selection')
workflow_path.write_text(workflow, encoding='utf-8')

print('Integración rc.6 aplicada correctamente.')
