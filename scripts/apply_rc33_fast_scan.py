from __future__ import annotations

import re
from pathlib import Path

PATH = Path('src/AppV4.tsx')
text = PATH.read_text(encoding='utf-8')


def replace(pattern: str, replacement: str, *, label: str, count: int = 1) -> None:
    global text
    updated, matches = re.subn(pattern, replacement, text, count=count, flags=re.S)
    if matches != count:
        raise RuntimeError(f'{label}: se esperaban {count} coincidencias y se encontraron {matches}')
    text = updated


replace(
    r"type IdentificationMode = 'technician' \| 'tool';\n\n",
    "type ScanProcessingOutcome = {\n  accepted: boolean;\n  title: string;\n  message: string;\n  tone: 'success' | 'warning' | 'error';\n};\n\n",
    label='tipo de orden de identificación',
)

replace(
    r"const initialInstruction = \(.*?\n\};\n\nexport default function AppV4\(\) \{",
    "const initialInstruction = (mode: OperationMode) => mode === 'delivery'\n"
    "  ? 'Paso 1: identifica al técnico. Paso 2: escanea o busca una o varias herramientas.'\n"
    "  : 'Paso 1: identifica al técnico. Paso 2: escanea únicamente las herramientas que devuelve físicamente.';\n\n"
    "export default function AppV4() {",
    label='instrucción inicial',
)

replace(
    r"  const savingRef = useRef\(false\);",
    "  const savingRef = useRef(false);\n"
    "  const technicianRef = useRef<Technician | null>(null);\n"
    "  const toolsRef = useRef<Tool[]>([]);",
    label='referencias de escaneo',
)

replace(
    r"  const \[identificationMode, setIdentificationMode\] = useState<IdentificationMode>\('technician'\);\n",
    "",
    label='estado de orden alternativo',
)

replace(
    r"  const clearDraft = \(\n    nextMode: OperationMode,\n    nextIdentificationMode: IdentificationMode,\n  \) => \{",
    "  const clearDraft = (nextMode: OperationMode) => {",
    label='firma clearDraft',
)

replace(
    r"    setIdentificationMode\(nextIdentificationMode\);\n",
    "",
    label='reset de orden alternativo',
)

replace(
    r"    setTechnician\(null\);\n    setTools\(\[\]\);",
    "    technicianRef.current = null;\n"
    "    toolsRef.current = [];\n"
    "    setTechnician(null);\n"
    "    setTools([]);",
    label='reset de referencias',
)

replace(
    r"    setScannerMessage\(initialInstruction\(nextMode, nextIdentificationMode\)\);",
    "    setScannerMessage(initialInstruction(nextMode));",
    label='mensaje inicial',
)

replace(
    r"    clearDraft\(nextMode, 'technician'\);",
    "    clearDraft(nextMode);",
    label='resetWorkflow',
)

replace(
    r"  const changeMode = \(nextMode: OperationMode\) => \{.*?\n  \};\n\n  const changeIdentificationMode = \(nextMode: IdentificationMode\) => \{.*?\n  \};",
    "  const changeMode = (nextMode: OperationMode) => {\n"
    "    if (savingRef.current) return;\n"
    "    clearDraft(nextMode);\n"
    "  };",
    label='cambio de modo único',
)

replace(
    r"  const selectTechnician = \(technicianId: string\) => \{.*?\n  \};\n\n  const addToolToOperation",
    "  const selectTechnician = (technicianId: string) => {\n"
    "    if (savingRef.current) return false;\n"
    "    const foundTechnician = sessionData.technicians.find((item) => item.id === technicianId);\n"
    "    if (!foundTechnician || !foundTechnician.active) {\n"
    "      setScannerMessage('El técnico no existe o está marcado como inactivo.');\n"
    "      return false;\n"
    "    }\n\n"
    "    const currentTechnician = technicianRef.current;\n"
    "    const currentTools = toolsRef.current;\n"
    "    if (currentTechnician && currentTechnician.id !== foundTechnician.id && currentTools.length > 0) {\n"
    "      setScannerMessage('Quita primero las herramientas seleccionadas antes de cambiar de técnico.');\n"
    "      return false;\n"
    "    }\n\n"
    "    if (currentTools.some((tool) => tool.holderTechnicianId && tool.holderTechnicianId !== foundTechnician.id)) {\n"
    "      setScannerMessage('Las herramientas seleccionadas pertenecen a otro técnico.');\n"
    "      navigator.vibrate?.([120, 60, 120]);\n"
    "      return false;\n"
    "    }\n\n"
    "    technicianRef.current = foundTechnician;\n"
    "    setTechnician(foundTechnician);\n"
    "    setSelectorOpen(false);\n"
    "    setToolSelectorOpen(false);\n\n"
    "    if (mode === 'return') {\n"
    "      const pendingCount = sessionData.tools.filter(\n"
    "        (tool) => tool.status === 'loaned' && tool.holderTechnicianId === foundTechnician.id,\n"
    "      ).length;\n"
    "      setScannerMessage(\n"
    "        pendingCount > 0\n"
    "          ? `${foundTechnician.name} identificado. Tiene ${pendingCount} herramienta${pendingCount === 1 ? '' : 's'} pendiente${pendingCount === 1 ? '' : 's'}. Escanea solo las que entrega.`\n"
    "          : `${foundTechnician.name} no tiene herramientas pendientes de devolución.`,\n"
    "      );\n"
    "    } else if (currentTools.length > 0) {\n"
    "      setScannerMessage(`${foundTechnician.name} identificado. Ya puedes revisar la operación.`);\n"
    "    } else {\n"
    "      setScannerMessage(`${foundTechnician.name} identificado. Mantén la cámara abierta y escanea las herramientas.`);\n"
    "    }\n\n"
    "    navigator.vibrate?.([60, 35, 80]);\n"
    "    return true;\n"
    "  };\n\n"
    "  const addToolToOperation",
    label='selección de técnico',
)

replace(
    r"  const addToolToOperation = \(foundTool: Tool\) => \{.*?\n  \};\n\n  const selectToolManually",
    "  const addToolToOperation = (foundTool: Tool) => {\n"
    "    if (savingRef.current) return false;\n"
    "    const activeTechnician = technicianRef.current;\n"
    "    const currentTools = toolsRef.current;\n\n"
    "    if (!activeTechnician) {\n"
    "      setScannerMessage('Identifica primero al técnico antes de añadir herramientas.');\n"
    "      navigator.vibrate?.([120, 60, 120]);\n"
    "      return false;\n"
    "    }\n\n"
    "    if (mode === 'delivery') {\n"
    "      const deliveryAlert = getDeliveryAlert(foundTool, activeTechnician.id);\n"
    "      if (deliveryAlert) {\n"
    "        setScanAlert({ tool: foundTool, title: deliveryAlert.title, detail: deliveryAlert.detail });\n"
    "        setScannerMessage(`${deliveryAlert.title}: ${deliveryAlert.detail}`);\n"
    "        setFeedback({ title: deliveryAlert.title, detail: deliveryAlert.detail, tone: 'error' });\n"
    "        navigator.vibrate?.([180, 70, 180, 70, 220]);\n"
    "        return false;\n"
    "      }\n"
    "    }\n\n"
    "    const requiredStatus: ToolStatus = mode === 'delivery' ? 'available' : 'loaned';\n"
    "    if (foundTool.status !== requiredStatus) {\n"
    "      setScannerMessage(\n"
    "        `${foundTool.name} está ${toolStatusLabel[foundTool.status].toLowerCase()} y no puede usarse en esta operación.`,\n"
    "      );\n"
    "      navigator.vibrate?.([120, 60, 120]);\n"
    "      return false;\n"
    "    }\n\n"
    "    if (mode === 'return' && foundTool.holderTechnicianId !== activeTechnician.id) {\n"
    "      const holder = sessionData.technicians.find((item) => item.id === foundTool.holderTechnicianId);\n"
    "      setScannerMessage(\n"
    "        `${foundTool.name} está prestada a ${holder?.name ?? 'otro técnico'} y no puede incluirse en esta devolución.`,\n"
    "      );\n"
    "      navigator.vibrate?.([120, 60, 120]);\n"
    "      return false;\n"
    "    }\n\n"
    "    if (currentTools.some((tool) => tool.id === foundTool.id)) {\n"
    "      setScannerMessage(`${foundTool.name} ya estaba añadida a esta operación.`);\n"
    "      return false;\n"
    "    }\n\n"
    "    const nextTools = [...currentTools, foundTool];\n"
    "    toolsRef.current = nextTools;\n"
    "    setTools(nextTools);\n"
    "    setAccessoryChecks((current) => buildAccessoryChecks(sessionData, nextTools, current));\n"
    "    if (mode === 'return') {\n"
    "      setReturnConditions((current) => ({\n"
    "        ...current,\n"
    "        [foundTool.id]: current[foundTool.id] ?? condition,\n"
    "      }));\n"
    "    }\n\n"
    "    setScannerMessage(\n"
    "      `${foundTool.name} añadida. Llevas ${nextTools.length} herramienta${nextTools.length === 1 ? '' : 's'}.`,\n"
    "    );\n"
    "    navigator.vibrate?.([60, 35, 80]);\n"
    "    return true;\n"
    "  };\n\n"
    "  const selectToolManually",
    label='alta de herramienta',
)

replace(
    r"  const handleScan = async \(\) => \{.*?\n  \};\n\n  const handleNfcScan",
    "  const processScannedValue = (rawValue: string): ScanProcessingOutcome => {\n"
    "    const payload = parseIsivoltQr(rawValue);\n"
    "    const activeTechnician = technicianRef.current;\n\n"
    "    if (!activeTechnician) {\n"
    "      if (payload.type !== 'technician') {\n"
    "        const message = 'Primero debes identificar la tarjeta o el QR del técnico.';\n"
    "        setScannerMessage(message);\n"
    "        return { accepted: false, title: 'Falta el técnico', message, tone: 'error' };\n"
    "      }\n\n"
    "      const foundTechnician = findTechnician(sessionData, payload.code);\n"
    "      const accepted = processTechnician(foundTechnician);\n"
    "      const message = accepted && foundTechnician\n"
    "        ? `${foundTechnician.name} identificado. Escanea ahora las herramientas sin cerrar la cámara.`\n"
    "        : 'La tarjeta o el código no pertenecen a ningún técnico activo.';\n"
    "      return {\n"
    "        accepted,\n"
    "        title: accepted && foundTechnician ? `Técnico: ${foundTechnician.name}` : 'Técnico no reconocido',\n"
    "        message,\n"
    "        tone: accepted ? 'success' : 'error',\n"
    "      };\n"
    "    }\n\n"
    "    if (payload.type === 'technician') {\n"
    "      const foundTechnician = findTechnician(sessionData, payload.code);\n"
    "      const sameTechnician = foundTechnician?.id === activeTechnician.id;\n"
    "      const message = sameTechnician\n"
    "        ? `${activeTechnician.name} ya está identificado. Escanea una herramienta.`\n"
    "        : 'Ya hay un técnico activo. Cierra la cámara y elimina las herramientas antes de cambiarlo.';\n"
    "      setScannerMessage(message);\n"
    "      return {\n"
    "        accepted: false,\n"
    "        title: `Técnico: ${activeTechnician.name}`,\n"
    "        message,\n"
    "        tone: sameTechnician ? 'warning' : 'error',\n"
    "      };\n"
    "    }\n\n"
    "    if (payload.type === 'unknown') {\n"
    "      const message = 'El código leído no está vinculado a ninguna herramienta.';\n"
    "      setScannerMessage(message);\n"
    "      return { accepted: false, title: `Técnico: ${activeTechnician.name}`, message, tone: 'error' };\n"
    "    }\n\n"
    "    const foundTool = findTool(sessionData, payload.code, payload.raw);\n"
    "    if (!foundTool) {\n"
    "      const message = `No existe ninguna herramienta registrada con el código ${payload.code}.`;\n"
    "      setScannerMessage(message);\n"
    "      return { accepted: false, title: `Técnico: ${activeTechnician.name}`, message, tone: 'error' };\n"
    "    }\n\n"
    "    const accepted = addToolToOperation(foundTool);\n"
    "    const count = toolsRef.current.length;\n"
    "    const message = accepted\n"
    "      ? `${foundTool.name} añadida. ${count} herramienta${count === 1 ? '' : 's'} preparada${count === 1 ? '' : 's'}.`\n"
    "      : `${foundTool.name} no se ha añadido. Revisa el aviso mostrado.`;\n"
    "    return {\n"
    "      accepted,\n"
    "      title: `Técnico: ${activeTechnician.name} · ${count} herramienta${count === 1 ? '' : 's'}`,\n"
    "      message,\n"
    "      tone: accepted ? 'success' : 'error',\n"
    "    };\n"
    "  };\n\n"
    "  const handleScan = async () => {\n"
    "    if (scanning || nfcScanning || savingRef.current) return;\n"
    "    setScanning(true);\n"
    "    setScannerMessage(\n"
    "      technicianRef.current\n"
    "        ? 'Abriendo cámara continua para herramientas…'\n"
    "        : 'Abriendo cámara para identificar primero al técnico…',\n"
    "    );\n\n"
    "    const result = await scanQrCode({\n"
    "      autoStart: true,\n"
    "      continuous: true,\n"
    "      duplicateCooldownMs: 1_600,\n"
    "      title: technicianRef.current\n"
    "        ? `Técnico: ${technicianRef.current.name}`\n"
    "        : 'Identifica primero al técnico',\n"
    "      instruction: 'Una sola sesión: identifica al técnico y continúa escaneando herramientas. Cierra la cámara cuando termines.',\n"
    "      manualLabel: technicianRef.current ? 'Añadir herramienta manualmente' : 'Elegir técnico manualmente',\n"
    "      onDetected: async (value) => {\n"
    "        const outcome = processScannedValue(value);\n"
    "        return {\n"
    "          action: 'continue',\n"
    "          title: technicianRef.current\n"
    "            ? `Técnico: ${technicianRef.current.name} · ${toolsRef.current.length} herramienta${toolsRef.current.length === 1 ? '' : 's'}`\n"
    "            : outcome.title,\n"
    "          message: outcome.message,\n"
    "          tone: outcome.tone,\n"
    "        };\n"
    "      },\n"
    "    });\n"
    "    setScanning(false);\n\n"
    "    if (result.status === 'manual-requested') {\n"
    "      if (technicianRef.current) {\n"
    "        setToolSelectorOpen(true);\n"
    "        setScannerMessage('Cámara cerrada. Añade una herramienta mediante búsqueda manual.');\n"
    "      } else {\n"
    "        setSelectorOpen(true);\n"
    "        setScannerMessage('Cámara cerrada. Selecciona primero al técnico manualmente.');\n"
    "      }\n"
    "      return;\n"
    "    }\n\n"
    "    if (result.status === 'completed' || result.status === 'cancelled') {\n"
    "      setScannerMessage(\n"
    "        technicianRef.current\n"
    "          ? `${technicianRef.current.name}: ${toolsRef.current.length} herramienta${toolsRef.current.length === 1 ? '' : 's'} preparada${toolsRef.current.length === 1 ? '' : 's'}. Puedes revisar o añadir manualmente.`\n"
    "          : 'Cámara cerrada. Identifica al técnico con cámara o selección manual.',\n"
    "      );\n"
    "      return;\n"
    "    }\n\n"
    "    if (result.status === 'success') {\n"
    "      const outcome = processScannedValue(result.value);\n"
    "      setScannerMessage(outcome.message);\n"
    "      return;\n"
    "    }\n\n"
    "    setScannerMessage(result.message);\n"
    "  };\n\n"
    "  const handleNfcScan",
    label='escaneo continuo',
)

replace(
    r"  const removeTool = \(toolId: string\) => \{\n    if \(savingRef.current\) return;\n    setTools\(\(current\) => current.filter\(\(tool\) => tool.id !== toolId\)\);",
    "  const removeTool = (toolId: string) => {\n"
    "    if (savingRef.current) return;\n"
    "    const nextTools = toolsRef.current.filter((tool) => tool.id !== toolId);\n"
    "    toolsRef.current = nextTools;\n"
    "    setTools(nextTools);",
    label='eliminación sincronizada',
)

replace(
    r"  const expectedLabel = identificationMode === 'technician'.*?\n  const toolProgress = \(.*?\n  \);\n\n  return \(",
    "  const expectedLabel = technician ? 'herramientas' : 'técnico';\n\n"
    "  const technicianProgress = (\n"
    "    <article key=\"technician\" className={technician ? 'completed' : 'current'}>\n"
    "      <span><UserRound size={20} /></span>\n"
    "      <div>\n"
    "        <small>Paso 1</small>\n"
    "        <strong>{technician?.name ?? 'Identificar técnico'}</strong>\n"
    "      </div>\n"
    "      {technician && <Check size={19} />}\n"
    "    </article>\n"
    "  );\n\n"
    "  const toolProgress = (\n"
    "    <article key=\"tools\" className={tools.length > 0 ? 'completed' : technician ? 'current' : ''}>\n"
    "      <span><Wrench size={20} /></span>\n"
    "      <div>\n"
    "        <small>Paso 2</small>\n"
    "        <strong>{tools.length ? `${tools.length} herramienta${tools.length === 1 ? '' : 's'}` : 'Identificar herramientas'}</strong>\n"
    "      </div>\n"
    "      {tools.length > 0 && <Check size={19} />}\n"
    "    </article>\n"
    "  );\n\n"
    "  return (",
    label='progreso técnico primero',
)

replace(
    r"                   <div className=\"native-identification-switch\".*?                   </div>\n\n",
    "",
    label='selector primero herramienta',
)

replace(
    r"                    \{identificationMode === 'technician'\n                      \? <>\{technicianProgress\}\{toolProgress\}</>\n                      : <>\{toolProgress\}\{technicianProgress\}</>\}",
    "                    {technicianProgress}{toolProgress}",
    label='orden visual fijo',
)

replace(
    r"                   <p>Tarjeta, QR, NFC opcional y guardado local trazable\.</p>",
    "                   <p>Primero técnico, después herramientas · cámara continua o selección manual.</p>",
    label='subtítulo del flujo',
)

replace(
    r"                       <strong>\{scanning \? 'Abriendo cámara…' : `Cámara \$\{expectedLabel\}`}\}</strong>",
    "                       <strong>{scanning ? 'Cámara activa…' : technician ? 'Escaneo continuo de herramientas' : 'Escanear técnico y herramientas'}</strong>",
    label='texto de cámara',
)

replace(
    r"                   \{!technician && \(.*?                   \}\)\n\n                   \{\(mode === 'return' \|\| Boolean\(technician\) \|\| identificationMode === 'tool'\) && \(.*?                   \}\)\n\n                   <div className=\"native-scanner-message\">",
    "                   <button\n"
    "                     disabled={saving}\n"
    "                     className=\"native-manual-primary\"\n"
    "                     type=\"button\"\n"
    "                     onClick={() => technician ? setToolSelectorOpen(true) : setSelectorOpen(true)}\n"
    "                   >\n"
    "                     <ListFilter size={20} />\n"
    "                     <span>\n"
    "                       <strong>{technician ? 'Añadir herramienta manualmente' : 'Elegir técnico manualmente'}</strong>\n"
    "                       <small>{technician ? 'Nombre, código, categoría, ubicación o marca' : 'Nombre, código, tarjeta o especialidad'}</small>\n"
    "                     </span>\n"
    "                   </button>\n\n"
    "                   <div className=\"native-scanner-message\">",
    label='alternativa manual única',
)

if 'identificationMode' in text or 'setIdentificationMode' in text:
    raise RuntimeError('Quedan referencias al orden alternativo de identificación')

PATH.write_text(text, encoding='utf-8')
print('RC33 aplicado correctamente en src/AppV4.tsx')
