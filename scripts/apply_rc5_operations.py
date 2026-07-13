#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'src/AppV4.tsx'
content = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global content
    if new in content:
        return
    if old not in content:
        raise RuntimeError(f'No se encontró el bloque para {label}')
    content = content.replace(old, new, 1)

replace_once(
    "import { loadAppData, saveAppData } from './services/storage';",
    "import { loadAppData, saveAppData } from './services/storage';\nimport { formatOperationDateTime, getDeliveryAlert } from './features/inventory/inventoryOperations';",
    'import de alertas',
)

replace_once(
    "  const [feedback, setFeedback] = useState<NativeFeedback>(null);",
    "  const [feedback, setFeedback] = useState<NativeFeedback>(null);\n  const [scanAlert, setScanAlert] = useState<{ tool: Tool; title: string; detail: string } | null>(null);",
    'estado de alerta',
)

replace_once(
    "    setSelectorOpen(false);\n    setScannerMessage(",
    "    setSelectorOpen(false);\n    setScanAlert(null);\n    setScannerMessage(",
    'limpieza de alerta',
)

replace_once(
    "    const requiredStatus: ToolStatus = mode === 'delivery' ? 'available' : 'loaned';\n    if (foundTool.status !== requiredStatus) {",
    "    if (mode === 'delivery') {\n      const deliveryAlert = getDeliveryAlert(foundTool, technician?.id);\n      if (deliveryAlert) {\n        setScanAlert({ tool: foundTool, title: deliveryAlert.title, detail: deliveryAlert.detail });\n        setScannerMessage(`${deliveryAlert.title}: ${deliveryAlert.detail}`);\n        setFeedback({ title: deliveryAlert.title, detail: deliveryAlert.detail, tone: 'error' });\n        navigator.vibrate?.([180, 70, 180, 70, 220]);\n        return;\n      }\n    }\n\n    const requiredStatus: ToolStatus = mode === 'delivery' ? 'available' : 'loaned';\n    if (foundTool.status !== requiredStatus) {",
    'validación de herramienta',
)

replace_once(
    "      detail: `${movementBatch.length} movimiento${movementBatch.length === 1 ? '' : 's'} guardado${movementBatch.length === 1 ? '' : 's'} en el dispositivo.`,",
    "      detail: `${movementBatch.length} movimiento${movementBatch.length === 1 ? '' : 's'} guardado${movementBatch.length === 1 ? '' : 's'} · ${formatOperationDateTime(occurredAt)}.`,",
    'fecha de confirmación',
)

alert_block = """
        {scanAlert && (
          <motion.div className="native-tool-alert-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setScanAlert(null)}>
            <motion.section className="native-tool-alert" initial={{ opacity: 0, y: 30, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.97 }} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Aviso de herramienta bloqueada">
              <span className="native-tool-alert-icon"><AlertTriangle size={34} /></span>
              <small>Entrega bloqueada</small>
              <h2>{scanAlert.title}</h2>
              <strong>{scanAlert.tool.code} · {scanAlert.tool.name}</strong>
              <p>{scanAlert.detail}</p>
              {scanAlert.tool.notes && <blockquote>{scanAlert.tool.notes}</blockquote>}
              <button type="button" onClick={() => setScanAlert(null)}><X size={18} /> Entendido</button>
            </motion.section>
          </motion.div>
        )}

"""
feedback_marker = "        {feedback && (\n"
if alert_block not in content:
    if feedback_marker not in content:
        raise RuntimeError('No se encontró la zona de feedback')
    content = content.replace(feedback_marker, alert_block + feedback_marker, 1)

replace_once(
    "            <Check size={21} /><span><strong>{feedback.title}</strong><small>{feedback.detail}</small></span>",
    "            {feedback.tone === 'success' ? <Check size={21} /> : <AlertTriangle size={21} />}<span><strong>{feedback.title}</strong><small>{feedback.detail}</small></span>",
    'icono del feedback',
)

path.write_text(content, encoding='utf-8')
print('Alertas QR y marcas de tiempo rc.5 aplicadas.')
