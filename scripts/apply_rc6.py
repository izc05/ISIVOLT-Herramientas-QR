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


app_path = ROOT / 'src/AppV4.tsx'
app = app_path.read_text(encoding='utf-8')

app = replace_once(
    app,
    "import { formatOperationDateTime, getDeliveryAlert } from './features/inventory/inventoryOperations';",
    "import { formatOperationDateTime, getDeliveryAlert } from './features/inventory/inventoryOperations';\nimport ToolSelectorPanel from './features/inventory/ToolSelectorPanel';",
    'import del selector de herramientas',
)

app = replace_once(
    app,
    "  const [selectorOpen, setSelectorOpen] = useState(false);",
    "  const [selectorOpen, setSelectorOpen] = useState(false);\n  const [toolSelectorOpen, setToolSelectorOpen] = useState(false);",
    'estado del selector de herramientas',
)

app = replace_once(
    app,
    "    setSelectorOpen(false);\n    setScanAlert(null);",
    "    setSelectorOpen(false);\n    setToolSelectorOpen(false);\n    setScanAlert(null);",
    'reinicio de selectores',
)

app = replace_once(
    app,
    "  const closeWorkflow = () => {\n    setSelectorOpen(false);\n    setScanAlert(null);",
    "  const closeWorkflow = () => {\n    setSelectorOpen(false);\n    setToolSelectorOpen(false);\n    setScanAlert(null);",
    'cierre de selectores',
)

app = replace_once(
    app,
    "    setTechnician(foundTechnician);\n    setSelectorOpen(false);",
    "    setTechnician(foundTechnician);\n    setSelectorOpen(false);\n    setToolSelectorOpen(false);",
    'selección de técnico',
)

insert_marker = "  const handleScan = async () => {\n"
add_tool_function = """  const addToolToOperation = (foundTool: Tool) => {
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
      setScannerMessage(
        `${foundTool.name} está ${toolStatusLabel[foundTool.status].toLowerCase()} y no puede usarse en esta operación.`,
      );
      navigator.vibrate?.([120, 60, 120]);
      return false;
    }

    if (tools.some((tool) => tool.id === foundTool.id)) {
      setScannerMessage(`${foundTool.name} ya estaba añadida a esta operación.`);
      return false;
    }

    setTools((current) => [...current, foundTool]);
    setScannerMessage(`${foundTool.name} añadida. Puedes incorporar otra o confirmar la operación.`);
    navigator.vibrate?.([60, 35, 80]);
    return true;
  };

  const selectToolManually = (toolId: string) => {
    const foundTool = sessionData.tools.find((item) => item.id === toolId);
    if (!foundTool) {
      setScannerMessage('La herramienta seleccionada ya no existe en el inventario.');
      return false;
    }
    return addToolToOperation(foundTool);
  };

"""
if add_tool_function not in app:
    if insert_marker not in app:
        raise RuntimeError('No se encontró handleScan')
    app = app.replace(insert_marker, add_tool_function + insert_marker, 1)

old_scan_block = """    if (mode === 'delivery') {
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
app = replace_once(
    app,
    old_scan_block,
    "    addToolToOperation(foundTool);\n",
    'validación común de herramienta',
)

app = replace_once(
    app,
    "      setScannerMessage('Lectura cancelada. Puedes volver a intentarlo o seleccionar el técnico manualmente.');",
    "      setScannerMessage('Lectura cancelada. Puedes volver a intentarlo o usar la selección manual.');",
    'mensaje de cancelación',
)

old_selector = """              {selectorOpen ? (
                <TechnicianSelectorPanel
                  technicians={sessionData.technicians}
                  tools={sessionData.tools}
                  onSelect={selectTechnician}
                  onBack={() => setSelectorOpen(false)}
                />
              ) : (
"""
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
                  technicianId={technician?.id}
                  selectedIds={tools.map((tool) => tool.id)}
                  onSelect={selectToolManually}
                  onBack={() => setToolSelectorOpen(false)}
                />
              ) : (
"""
app = replace_once(app, old_selector, new_selector, 'panel selector de herramienta')

manual_technician_block = """                  {mode === 'delivery' && !technician && (
                    <button className="native-manual-technician" type="button" onClick={() => setSelectorOpen(true)}>
                      <ListFilter size={19} />
                      <span><strong>Seleccionar técnico manualmente</strong><small>Buscar por nombre, código o categoría</small></span>
                    </button>
                  )}
"""
manual_tool_block = manual_technician_block + """

                  {(mode === 'return' || Boolean(technician)) && (
                    <button className="native-manual-tool" type="button" onClick={() => setToolSelectorOpen(true)}>
                      <ListFilter size={19} />
                      <span><strong>Buscar herramienta manualmente</strong><small>Nombre, código, categoría, ubicación o marca</small></span>
                    </button>
                  )}
"""
app = replace_once(app, manual_technician_block, manual_tool_block, 'botón manual de herramientas')

app = replace_once(
    app,
    "  const canConfirm = tools.length > 0 && (mode === 'return' || Boolean(technician));",
    "  const canConfirm = tools.length > 0\n    && (mode === 'return' || Boolean(technician))\n    && (mode !== 'return' || condition === 'ok' || notes.trim().length > 0);",
    'validación de observaciones',
)

app = replace_once(
    app,
    '<label className="native-notes-field">Observaciones<textarea',
    '<label className="native-notes-field">{mode === \'return\' && condition !== \'ok\' ? \'Observaciones obligatorias\' : \'Observaciones\'}<textarea',
    'etiqueta de observaciones',
)

app_path.write_text(app, encoding='utf-8')

main_path = ROOT / 'src/main.tsx'
main = main_path.read_text(encoding='utf-8')
if "import './rc6-mobile.css';" not in main:
    main = main.replace("import './mobile-optimization-rc4.css';", "import './mobile-optimization-rc4.css';\nimport './rc6-mobile.css';\nimport './qr-print-rc6.css';")
main_path.write_text(main, encoding='utf-8')

package_path = ROOT / 'package.json'
package = json.loads(package_path.read_text(encoding='utf-8'))
package['version'] = VERSION
package.setdefault('dependencies', {})['@capgo/capacitor-printer'] = '^8.1.0'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

config_path = ROOT / 'src/config/app.ts'
config = config_path.read_text(encoding='utf-8')
config = re.sub(r"APP_VERSION = '[^']+'", f"APP_VERSION = '{VERSION}'", config)
config_path.write_text(config, encoding='utf-8')

workflow_path = ROOT / '.github/workflows/production-readiness.yml'
workflow = workflow_path.read_text(encoding='utf-8')
workflow = workflow.replace('ISIVOLT-Herramientas-QR-v1.0.0-rc.5-debug', 'ISIVOLT-Herramientas-QR-v1.0.0-rc.6-debug')
workflow = workflow.replace('ISIVOLT-v1.0.0-rc.5-metadata', 'ISIVOLT-v1.0.0-rc.6-metadata')
if 'feature/rc6-manual-tools-print-safearea' not in workflow:
    workflow = workflow.replace('      - feature/inventory-operations-1.0.0-rc.5', '      - feature/inventory-operations-1.0.0-rc.5\n      - feature/rc6-manual-tools-print-safearea')
workflow_path.write_text(workflow, encoding='utf-8')

print('Integración rc.6 aplicada correctamente.')
