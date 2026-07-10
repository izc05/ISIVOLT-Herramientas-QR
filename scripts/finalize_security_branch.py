#!/usr/bin/env python3
"""Finaliza de forma idempotente la rama 0.9 tras los parches automáticos."""

from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

subprocess.run(['python3', 'scripts/apply_security_integration.py'], cwd=ROOT, check=True)
subprocess.run(['python3', 'scripts/apply_rectification_integration.py'], cwd=ROOT, check=True)


def patch_file(path: str, replacements: list[tuple[str, str]]) -> None:
    file = ROOT / path
    content = file.read_text(encoding='utf-8')
    for old, new in replacements:
        if new in content:
            continue
        if old not in content:
            raise RuntimeError(f'No se ha encontrado el bloque esperado en {path}: {old[:80]}')
        content = content.replace(old, new, 1)
    file.write_text(content, encoding='utf-8')


patch_file('package.json', [('"version": "0.8.0"', '"version": "0.9.0"')])
patch_file('src/config/app.ts', [
    ("export const APP_VERSION = '0.8.0';", "export const APP_VERSION = '0.9.0';"),
    ('export const DATABASE_SCHEMA_VERSION = 2 as const;', 'export const DATABASE_SCHEMA_VERSION = 3 as const;'),
])

reports = ROOT / 'src/services/reports.ts'
content = reports.read_text(encoding='utf-8')
excel_old = """  return filename;
};

export const createBackupEnvelope"""
excel_new = """  const user = getCurrentSecurityUser();
  await appendAuditEntry({
    eventType: 'data.exported',
    entityType: 'excel',
    entityId: filename,
    operatorUserId: user?.id,
    operatorName: user?.name,
    detail: 'Informe operativo exportado.',
  });
  return filename;
};

export const createBackupEnvelope"""
if excel_new not in content:
    if excel_old not in content:
        raise RuntimeError('No se ha encontrado el final de exportOperationalExcel')
    content = content.replace(excel_old, excel_new, 1)

backup_old = """  return filename;
};

const isValidAppData"""
backup_new = """  const user = getCurrentSecurityUser();
  await appendAuditEntry({
    eventType: 'data.exported',
    entityType: 'backup',
    entityId: filename,
    operatorUserId: user?.id,
    operatorName: user?.name,
    detail: 'Copia de seguridad exportada.',
  });
  return filename;
};

const isValidAppData"""
if backup_new not in content:
    if backup_old not in content:
        raise RuntimeError('No se ha encontrado el final de exportBackup')
    content = content.replace(backup_old, backup_new, 1)

restore_old = """  saveAppData(backup.data, { replaceNative: true });
  return backup;
};"""
restore_new = """  saveAppData(backup.data, { replaceNative: true });
  const user = getCurrentSecurityUser();
  void appendAuditEntry({
    eventType: 'data.restored',
    entityType: 'backup',
    operatorUserId: user?.id,
    operatorName: user?.name,
    detail: `Copia restaurada: ${backup.createdAt}.`,
  });
  return backup;
};"""
if restore_new not in content:
    if restore_old not in content:
        raise RuntimeError('No se ha encontrado restoreBackup')
    content = content.replace(restore_old, restore_new, 1)

reports.write_text(content, encoding='utf-8')

print('Rama de seguridad 0.9 finalizada e integrada.')
