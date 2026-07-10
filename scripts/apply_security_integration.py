#!/usr/bin/env python3
"""Aplica de forma idempotente la integración de seguridad sobre la app existente."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def insert_once(content: str, marker: str, addition: str, description: str) -> str:
    if addition.strip() in content:
        return content
    if marker not in content:
        raise RuntimeError(f"No se ha encontrado el punto de integración: {description}")
    return content.replace(marker, f"{marker}\n{addition}", 1)


def replace_once(content: str, old: str, new: str, description: str) -> str:
    if new in content:
        return content
    if old not in content:
        raise RuntimeError(f"No se ha encontrado el bloque: {description}")
    return content.replace(old, new, 1)


# Bootstrap independiente: cubre también paneles añadidos fuera de AppV2.
index = read("index.html")
security_script = '    <script type="module" src="/src/security/bootstrap.tsx"></script>'
main_script = '    <script type="module" src="/src/main.tsx"></script>'
if security_script not in index:
    if main_script not in index:
        raise RuntimeError("No se ha encontrado el script principal en index.html")
    index = index.replace(main_script, f"{security_script}\n{main_script}", 1)
write("index.html", index)

# Operaciones manuales y altas del núcleo existente.
app_v2 = read("src/AppV2.tsx")
app_v2 = insert_once(
    app_v2,
    "import { loadAppData, resetAppData, saveAppData } from './services/storage';",
    "import { assertPermission } from './security/permissions';\nimport { getCurrentOperatorName } from './security/session';",
    "imports de seguridad de AppV2",
)
app_v2 = replace_once(
    app_v2,
    "const OPERATOR_NAME = 'Isi';",
    "const OPERATOR_NAME = () => getCurrentOperatorName();",
    "operador fijo de AppV2",
)
app_v2 = app_v2.replace("operatorName: OPERATOR_NAME,", "operatorName: OPERATOR_NAME(),")
app_v2 = replace_once(
    app_v2,
    "  const commitOperation = (payload: OperationPayload) => {\n    const occurredAt = new Date().toISOString();",
    "  const commitOperation = (payload: OperationPayload) => {\n    try {\n      assertPermission('operations.execute');\n    } catch (cause) {\n      setToast({ title: 'Acción no autorizada', detail: cause instanceof Error ? cause.message : 'No tienes permiso para registrar movimientos.' });\n      return;\n    }\n    const occurredAt = new Date().toISOString();",
    "permiso de movimientos manuales",
)
app_v2 = replace_once(
    app_v2,
    "  const addTool = (tool: Tool) => {\n    setData((current) => ({ ...current, tools: [tool, ...current.tools] }));",
    "  const addTool = (tool: Tool) => {\n    try {\n      assertPermission('inventory.manage');\n    } catch (cause) {\n      setToast({ title: 'Acción no autorizada', detail: cause instanceof Error ? cause.message : 'No tienes permiso para modificar el inventario.' });\n      return;\n    }\n    setData((current) => ({ ...current, tools: [tool, ...current.tools] }));",
    "permiso de alta de herramientas",
)
app_v2 = replace_once(
    app_v2,
    "  const addTechnician = (technician: Technician) => {\n    setData((current) => ({ ...current, technicians: [technician, ...current.technicians] }));",
    "  const addTechnician = (technician: Technician) => {\n    try {\n      assertPermission('technicians.manage');\n    } catch (cause) {\n      setToast({ title: 'Acción no autorizada', detail: cause instanceof Error ? cause.message : 'No tienes permiso para gestionar técnicos.' });\n      return;\n    }\n    setData((current) => ({ ...current, technicians: [technician, ...current.technicians] }));",
    "permiso de alta de técnicos",
)
write("src/AppV2.tsx", app_v2)

# Flujo QR nativo.
app_v4 = read("src/AppV4.tsx")
app_v4 = insert_once(
    app_v4,
    "import { loadAppData, saveAppData } from './services/storage';",
    "import { assertPermission } from './security/permissions';\nimport { getCurrentOperatorName } from './security/session';",
    "imports de seguridad de AppV4",
)
app_v4 = replace_once(
    app_v4,
    "const OPERATOR_NAME = 'Isi';",
    "const OPERATOR_NAME = () => getCurrentOperatorName();",
    "operador fijo de AppV4",
)
app_v4 = app_v4.replace("operatorName: OPERATOR_NAME,", "operatorName: OPERATOR_NAME(),")
app_v4 = replace_once(
    app_v4,
    "  const confirmOperation = () => {\n    const current = loadAppData();",
    "  const confirmOperation = () => {\n    try {\n      assertPermission('operations.execute');\n    } catch (cause) {\n      setScannerMessage(cause instanceof Error ? cause.message : 'No tienes permiso para registrar movimientos.');\n      return;\n    }\n    const current = loadAppData();",
    "permiso de operación QR",
)
write("src/AppV4.tsx", app_v4)

# Gestión administrativa.
management = read("src/features/management/managementService.ts")
management = insert_once(
    management,
    "import { canUseTechnicianCode, canUseToolCode } from '../../services/movementService';",
    "import { assertPermission } from '../../security/permissions';",
    "permisos de gestión",
)
for signature, permission in [
    ("export const saveManagedTool = (tool: Tool): AppData => {", "inventory.manage"),
    ("export const saveManagedTechnician = (technician: Technician): AppData => {", "technicians.manage"),
    ("export const saveAccessory = (accessory: ToolAccessory): AppData => {", "maintenance.manage"),
    ("export const archiveAccessory = (accessoryId: string): AppData => {", "maintenance.manage"),
    ("export const saveMaintenanceRecord = (record: MaintenanceRecord): AppData => {", "maintenance.manage"),
]:
    guarded = f"{signature}\n  assertPermission('{permission}');"
    management = replace_once(management, signature, guarded, f"permiso {permission}")
write("src/features/management/managementService.ts", management)

# Informes y copias.
reports = read("src/services/reports.ts")
reports = insert_once(
    reports,
    "import { saveAppData } from './storage';",
    "import { assertPermission } from '../security/permissions';\nimport { appendAuditEntry } from '../security/store';\nimport { getCurrentSecurityUser } from '../security/session';",
    "permisos de informes",
)
reports = replace_once(
    reports,
    "export const exportOperationalExcel = async (data: AppData): Promise<string> => {\n  const filename",
    "export const exportOperationalExcel = async (data: AppData): Promise<string> => {\n  assertPermission('reports.export');\n  const filename",
    "permiso Excel operativo",
)
reports = replace_once(
    reports,
    "export const exportBackup = async (data: AppData): Promise<string> => {\n  const filename",
    "export const exportBackup = async (data: AppData): Promise<string> => {\n  assertPermission('reports.export');\n  const filename",
    "permiso de copia",
)
reports = replace_once(
    reports,
    "export const restoreBackup = (text: string): BackupEnvelope => {\n  const backup",
    "export const restoreBackup = (text: string): BackupEnvelope => {\n  assertPermission('backup.restore');\n  const backup",
    "permiso de restauración",
)
write("src/services/reports.ts", reports)

management_export = read("src/features/management/managementExport.ts")
management_export = insert_once(
    management_export,
    "import { APP_VERSION } from '../../config/app';",
    "import { assertPermission } from '../../security/permissions';",
    "permisos del Excel de gestión",
)
management_export = replace_once(
    management_export,
    "export const exportManagementWorkbook = async (data: AppData) => {\n  const workbook",
    "export const exportManagementWorkbook = async (data: AppData) => {\n  assertPermission('reports.export');\n  const workbook",
    "permiso del informe de gestión",
)
management_export = replace_once(
    management_export,
    "export const exportImportTemplate = async () => {\n  const workbook",
    "export const exportImportTemplate = async () => {\n  assertPermission('reports.export');\n  const workbook",
    "permiso de plantilla",
)
write("src/features/management/managementExport.ts", management_export)

print("Integración de seguridad aplicada correctamente.")
