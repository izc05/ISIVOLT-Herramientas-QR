#!/usr/bin/env python3
"""Valida el SQL embebido en schema.ts usando sqlite3 real."""

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
migration_match = re.search(
    r"name:\s*'normalized_inventory_core',\s*statements:\s*`(?P<body>.*?)`,\s*}\s*,?\s*]",
    SOURCE,
    re.DOTALL,
)
if not migration_match:
    raise RuntimeError("No se ha encontrado la migración normalized_inventory_core")

schema = migration_match.group("body").replace(
    "${MOVEMENT_IMMUTABILITY_TRIGGERS}", triggers
)

connection = sqlite3.connect(":memory:")
connection.execute("PRAGMA foreign_keys = ON")
connection.executescript(schema)

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
        holder_technician_id, loaned_at, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'available', NULL, NULL, 1, ?, ?)""",
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
    """INSERT INTO movements
       (id, sequence_number, type, tool_id, operator_name, previous_status,
        next_status, occurred_at, sync_status, created_at)
       VALUES (?, 1, 'adjustment', ?, 'Sistema', 'available', 'available', ?, 'local', ?)""",
    ("mov-1", "tool-1", now, now),
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
    "UPDATE movements SET notes = 'alterado' WHERE id = 'mov-1'",
    (),
)
expect_integrity_error(
    "DELETE FROM movements WHERE id = 'mov-1'",
    (),
)

print("Esquema SQLite validado: tablas, relaciones, UNIQUE, CHECK y trazabilidad inmutable.")
