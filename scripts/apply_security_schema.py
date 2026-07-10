#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
schema_path = root / 'src/data/sqlite/schema.ts'
content = schema_path.read_text(encoding='utf-8')

migration = """  {
    version: 3,
    name: 'local_security_and_audit',
    statements: `
ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0);
ALTER TABLE users ADD COLUMN locked_until TEXT;
ALTER TABLE users ADD COLUMN last_login_at TEXT;

CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, active);
CREATE INDEX IF NOT EXISTS idx_users_technician ON users(technician_id);
CREATE INDEX IF NOT EXISTS idx_audit_operator_time ON audit_log(operator_name, occurred_at DESC);
`,
  },
"""

if "name: 'local_security_and_audit'" not in content:
    marker = '];\n'
    position = content.rfind(marker)
    if position < 0:
        raise RuntimeError('No se ha encontrado el final de DATABASE_MIGRATIONS')
    content = content[:position] + migration + content[position:]
    schema_path.write_text(content, encoding='utf-8')

schema_test = root / 'src/data/sqlite/schema.test.ts'
test_content = schema_test.read_text(encoding='utf-8')
test_content = test_content.replace(
    "expect(DATABASE_MIGRATIONS.map((migration) => migration.version)).toEqual([1, 2]);",
    "expect(DATABASE_MIGRATIONS.map((migration) => migration.version)).toEqual([1, 2, 3]);",
)
if "local_security_and_audit" not in test_content:
    anchor = "    expect(DATABASE_MIGRATIONS[1].name).toBe('asset_management_and_maintenance');"
    test_content = test_content.replace(
        anchor,
        anchor + "\n    expect(DATABASE_MIGRATIONS[2].name).toBe('local_security_and_audit');",
        1,
    )
schema_test.write_text(test_content, encoding='utf-8')

print('Migración SQLite de seguridad aplicada.')
