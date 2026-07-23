#!/usr/bin/env python3
"""Valida todas las migraciones SQL embebidas en schema.ts usando sqlite3 real."""

from __future__ import annotations

import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "src/data/sqlite/schema.ts").read_text(encoding="utf-8")


def extract_template(name: str) -> str:
    pattern = rf"export const {re.escape(name)} = `(?P<body>.*?)`;"
    match = re.search(pattern, SOURCE, re.DOTALL)
    if not match:
        raise RuntimeError(f"No se ha encontrado la plantilla {name}")
    return match.group("body")


triggers = extract_template("MOVEMENT_IMMUTABILITY_TRIGGERS")
migrations = [
    (int(match.group("version")), match.group("name"), match.group("body"))
    for match in re.finditer(
        r"version:\s*(?P<version>\d+),\s*name:\s*'(?P<name>[^']+)',\s*statements:\s*`(?P<body>.*?)`,\s*}",
        SOURCE,
        re.DOTALL,
    )
]
if not migrations:
    raise RuntimeError("No se han encontrado migraciones SQLite")

connection = sqlite3.connect(":memory:")
connection.execute("PRAGMA foreign_keys = ON")

for version, name, statements in sorted(migrations):
    sql = statements.replace("${MOVEMENT_IMMUTABILITY_TRIGGERS}", triggers)
    connection.executescript(sql)
    connection.execute(
        "INSERT OR REPLACE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        (version, name, "2026-07-10T12:00:00.000Z"),
    )
    connection.execute(f"PRAGMA user_version = {version}")

now = "2026-07-10T12:00:00.000Z"
connection.execute(
    "INSERT INTO categories VALUES (?, ?, 1, ?, ?)",
    ("cat-test", "Medición", now, now),
)
connection.execute(
    "INSERT INTO locations VALUES (?, ?, 1, ?, ?)",
    ("loc-test", "Almacén", now, now),
)
connection.execute(
    """INSERT INTO technicians
       (id, code, name, specialty, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)""",
    ("tech-1", "TEC-001", "Técnico", "Electricidad", now, now),
)
connection.execute(
    """INSERT INTO tools
       (id, code, qr_code, name, category_id, location_id, status,
        holder_technician_id, loaned_at, active, created_at, updated_at,
        service_status, purchase_cost, max_loan_days)
       VALUES (?, ?, ?, ?, ?, ?, 'available', NULL, NULL, 1, ?, ?, 'none', 250.50, 7)""",
    (
        "tool-1",
        "HER-001",
        "ISIVOLT:TOOL:HER-001",
        "Multímetro",
        "cat-test",
        "loc-test",
        now,
        now,
    ),
)
connection.execute(
    """INSERT INTO accessories
       (id, tool_id, name, required, active, created_at, updated_at, condition)
       VALUES (?, ?, ?, 1, 1, ?, ?, 'ok')""",
    ("acc-1", "tool-1", "Maletín", now, now),
)
connection.execute(
    """INSERT INTO maintenance_records
       (id, tool_id, type, status, title, description, operator_name,
        opened_at, created_at, updated_at)
       VALUES (?, ?, 'inspection', 'open', ?, ?, 'Sistema', ?, ?, ?)""",
    ("maint-1", "tool-1", "Revisión anual", "Comprobar aislamiento", now, now, now),
)
connection.execute(
    """INSERT INTO movements
       (id, operation_id, sequence_number, type, tool_id, operator_name, previous_status,
        next_status, occurred_at, sync_status, created_at)
       VALUES (?, ?, 1, 'adjustment', ?, 'Sistema', 'available', 'available', ?, 'local', ?)""",
    ("mov-1", "op-test-1", "tool-1", now, now),
)


def expect_integrity_error(sql: str, params: tuple[object, ...]) -> None:
    try:
        connection.execute(sql, params)
    except sqlite3.DatabaseError:
        return
    raise AssertionError(f"SQLite aceptó una operación que debía rechazar: {sql}")


expect_integrity_error(
    """INSERT INTO tools
       (id, code, qr_code, name, category_id, location_id, status,
        holder_technician_id, loaned_at, active, created_at, updated_at)
       VALUES (?, 'HER-001', ?, ?, ?, ?, 'available', NULL, NULL, 1, ?, ?)""",
    (
        "tool-duplicate",
        "ISIVOLT:TOOL:HER-999",
        "Duplicada",
        "cat-test",
        "loc-test",
        now,
        now,
    ),
)
expect_integrity_error(
    """INSERT INTO tools
       (id, code, qr_code, name, category_id, location_id, status,
        holder_technician_id, loaned_at, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'loaned', NULL, NULL, 1, ?, ?)""",
    (
        "tool-invalid",
        "HER-002",
        "ISIVOLT:TOOL:HER-002",
        "Préstamo inválido",
        "cat-test",
        "loc-test",
        now,
        now,
    ),
)
expect_integrity_error(
    "UPDATE tools SET service_status = 'desconocido' WHERE id = 'tool-1'",
    (),
)
expect_integrity_error(
    "INSERT INTO accessories (id, tool_id, name, required, active, created_at, updated_at, condition) VALUES ('acc-2', 'tool-1', 'Maletín', 1, 1, ?, ?, 'ok')",
    (now, now),
)
expect_integrity_error(
    "UPDATE movements SET notes = 'alterado' WHERE id = 'mov-1'",
    (),
)
expect_integrity_error(
    "DELETE FROM movements WHERE id = 'mov-1'",
    (),
)

version = connection.execute("PRAGMA user_version").fetchone()[0]
assert version == max(item[0] for item in migrations), "La versión SQLite no coincide con la última migración"
assert connection.execute("SELECT COUNT(*) FROM accessories").fetchone()[0] == 1
assert connection.execute("SELECT COUNT(*) FROM maintenance_records").fetchone()[0] == 1
assert connection.execute("SELECT operation_id FROM movements WHERE id = 'mov-1'").fetchone()[0] == "op-test-1"

print(
    f"Esquema SQLite v{version} validado: migraciones, gestión, mantenimiento, "
    "operationId, UNIQUE, CHECK y trazabilidad inmutable."
)
