import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import {
  DATABASE_MIGRATIONS,
  DROP_MOVEMENT_IMMUTABILITY_TRIGGERS,
  MOVEMENT_IMMUTABILITY_TRIGGERS,
} from '../data/sqlite/schema';
import {
  movementToSqlValues,
  rowToMovement,
  rowToTechnician,
  rowToTool,
  stableLookupId,
  technicianToSqlValues,
  toolToSqlValues,
} from '../data/sqlite/mappers';
import type { AppData, Movement } from '../domain/types';

const DATABASE_NAME = 'isivolt_herramientas';
const CONNECTION_VERSION = 1;

let sqlite: SQLiteConnection | null = null;
let database: SQLiteDBConnection | null = null;
let openingPromise: Promise<SQLiteDBConnection | null> | null = null;

const isNative = () => Capacitor.isNativePlatform();
const nowIso = () => new Date().toISOString();

const parseSnapshot = (value: unknown): AppData | null => {
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<AppData>;
    if (
      parsed.schemaVersion !== 1
      || !Array.isArray(parsed.tools)
      || !Array.isArray(parsed.technicians)
      || !Array.isArray(parsed.movements)
    ) {
      return null;
    }
    return parsed as AppData;
  } catch {
    return null;
  }
};

const countRows = async (db: SQLiteDBConnection, table: string): Promise<number> => {
  const result = await db.query(`SELECT COUNT(*) AS total FROM ${table};`);
  return Number(result.values?.[0]?.total ?? 0);
};

const withTransaction = async <T>(
  db: SQLiteDBConnection,
  operation: () => Promise<T>,
): Promise<T> => {
  await db.beginTransaction();
  try {
    const result = await operation();
    await db.commitTransaction();
    return result;
  } catch (error) {
    try {
      const active = await db.isTransactionActive();
      if (active.result) await db.rollbackTransaction();
    } catch {
      // Se conserva el error original.
    }
    throw error;
  }
};

const applyMigrations = async (db: SQLiteDBConnection): Promise<void> => {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );`,
    false,
  );

  const appliedResult = await db.query('SELECT version FROM schema_migrations;');
  const applied = new Set((appliedResult.values ?? []).map((row) => Number(row.version)));

  for (const migration of DATABASE_MIGRATIONS) {
    if (applied.has(migration.version)) continue;

    await withTransaction(db, async () => {
      await db.execute(migration.statements, false);
      await db.run(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
        [migration.version, migration.name, nowIso()],
        false,
      );
      await db.execute(`PRAGMA user_version = ${migration.version};`, false);
    });
  }
};

const upsertLookups = async (db: SQLiteDBConnection, data: AppData): Promise<void> => {
  const timestamp = nowIso();
  const categories = new Map<string, string>();
  const locations = new Map<string, string>();

  data.tools.forEach((tool) => {
    categories.set(stableLookupId('cat', tool.category), tool.category.trim() || 'Sin categoría');
    locations.set(stableLookupId('loc', tool.location), tool.location.trim() || 'Sin ubicación');
  });

  for (const [id, name] of categories) {
    await db.run(
      `INSERT INTO categories (id, name, active, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, active = 1, updated_at = excluded.updated_at;`,
      [id, name, timestamp, timestamp],
      false,
    );
  }

  for (const [id, name] of locations) {
    await db.run(
      `INSERT INTO locations (id, name, active, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, active = 1, updated_at = excluded.updated_at;`,
      [id, name, timestamp, timestamp],
      false,
    );
  }
};

const upsertTechnicians = async (db: SQLiteDBConnection, data: AppData): Promise<void> => {
  for (const technician of data.technicians) {
    await db.run(
      `INSERT INTO technicians (
        id, code, name, specialty, role, phone, extension, previous_phone, email,
        active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        code = excluded.code,
        name = excluded.name,
        specialty = excluded.specialty,
        role = excluded.role,
        phone = excluded.phone,
        extension = excluded.extension,
        previous_phone = excluded.previous_phone,
        email = excluded.email,
        active = excluded.active,
        updated_at = excluded.updated_at;`,
      technicianToSqlValues(technician),
      false,
    );
  }
};

const upsertTools = async (db: SQLiteDBConnection, data: AppData): Promise<void> => {
  for (const tool of data.tools) {
    await db.run(
      `INSERT INTO tools (
        id, code, qr_code, name, category_id, brand, model, serial_number, location_id,
        status, holder_technician_id, loaned_at, notes, photo_uri, thumbnail_uri,
        legacy_image_data_url, image_updated_at, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        code = excluded.code,
        qr_code = excluded.qr_code,
        name = excluded.name,
        category_id = excluded.category_id,
        brand = excluded.brand,
        model = excluded.model,
        serial_number = excluded.serial_number,
        location_id = excluded.location_id,
        status = excluded.status,
        holder_technician_id = excluded.holder_technician_id,
        loaned_at = excluded.loaned_at,
        notes = excluded.notes,
        photo_uri = COALESCE(excluded.photo_uri, tools.photo_uri),
        thumbnail_uri = COALESCE(excluded.thumbnail_uri, tools.thumbnail_uri),
        legacy_image_data_url = excluded.legacy_image_data_url,
        image_updated_at = excluded.image_updated_at,
        active = excluded.active,
        updated_at = excluded.updated_at;`,
      toolToSqlValues(tool),
      false,
    );
  }
};

const insertNewMovements = async (db: SQLiteDBConnection, movements: Movement[]): Promise<void> => {
  const existingResult = await db.query('SELECT id FROM movements;');
  const existing = new Set((existingResult.values ?? []).map((row) => String(row.id)));
  const maxResult = await db.query('SELECT COALESCE(MAX(sequence_number), 0) AS maximum FROM movements;');
  let sequence = Number(maxResult.values?.[0]?.maximum ?? 0);

  const chronological = [...movements].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  for (const movement of chronological) {
    if (existing.has(movement.id)) continue;
    sequence += 1;
    await db.run(
      `INSERT INTO movements (
        id, sequence_number, type, tool_id, technician_id, operator_name,
        previous_status, next_status, condition, notes, occurred_at, device_id,
        reversed_movement_id, sync_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      movementToSqlValues(movement, sequence),
      false,
    );
  }
};

const replaceNormalizedData = async (db: SQLiteDBConnection, data: AppData): Promise<void> => {
  await withTransaction(db, async () => {
    await db.execute(DROP_MOVEMENT_IMMUTABILITY_TRIGGERS, false);
    await db.execute(
      `DELETE FROM movement_accessories;
       DELETE FROM accessories;
       DELETE FROM movements;
       DELETE FROM users;
       DELETE FROM tools;
       DELETE FROM technicians;
       DELETE FROM categories;
       DELETE FROM locations;`,
      false,
    );

    await upsertLookups(db, data);
    await upsertTechnicians(db, data);
    await upsertTools(db, data);
    await insertNewMovements(db, data.movements);
    await db.execute(MOVEMENT_IMMUTABILITY_TRIGGERS, false);
    await db.run(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('last_snapshot_at', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
      [nowIso(), nowIso()],
      false,
    );
  });
};

const mergeNormalizedData = async (db: SQLiteDBConnection, data: AppData): Promise<void> => {
  await withTransaction(db, async () => {
    await upsertLookups(db, data);
    await upsertTechnicians(db, data);
    await upsertTools(db, data);
    await insertNewMovements(db, data.movements);
    await db.run(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('last_snapshot_at', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
      [nowIso(), nowIso()],
      false,
    );
  });
};

const importLegacySnapshot = async (db: SQLiteDBConnection): Promise<void> => {
  if (await countRows(db, 'tools') > 0 || await countRows(db, 'technicians') > 0) return;

  const legacyTable = await db.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_state';",
  );
  if (!legacyTable.values?.length) return;

  const result = await db.query('SELECT payload FROM app_state WHERE id = 1;');
  const legacy = parseSnapshot(result.values?.[0]?.payload);
  if (!legacy) return;

  await replaceNormalizedData(db, legacy);
  await db.run(
    `INSERT INTO audit_log (event_type, entity_type, occurred_at, detail)
     VALUES ('migration', 'app_state', ?, ?);`,
    [nowIso(), 'Estado JSON heredado migrado a tablas normalizadas.'],
  );
};

const openDatabase = async (): Promise<SQLiteDBConnection | null> => {
  if (!isNative()) return null;
  if (database) return database;
  if (openingPromise) return openingPromise;

  openingPromise = (async () => {
    sqlite ??= new SQLiteConnection(CapacitorSQLite);

    try {
      database = await sqlite.retrieveConnection(DATABASE_NAME, false);
    } catch {
      database = await sqlite.createConnection(
        DATABASE_NAME,
        false,
        'no-encryption',
        CONNECTION_VERSION,
        false,
      );
    }

    await database.open();
    await database.execute(
      `PRAGMA foreign_keys = ON;
       CREATE TABLE IF NOT EXISTS app_state (
         id INTEGER PRIMARY KEY CHECK (id = 1),
         schema_version INTEGER NOT NULL,
         payload TEXT NOT NULL,
         updated_at TEXT NOT NULL
       );
       CREATE TABLE IF NOT EXISTS storage_events (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         event_type TEXT NOT NULL,
         occurred_at TEXT NOT NULL,
         detail TEXT
       );`,
      false,
    );
    await applyMigrations(database);
    await importLegacySnapshot(database);
    return database;
  })();

  try {
    return await openingPromise;
  } finally {
    openingPromise = null;
  }
};

export type NativeDatabaseHealth = {
  schemaVersion: number;
  tools: number;
  technicians: number;
  movements: number;
  transactionActive: boolean;
};

export const getNativeDatabaseHealth = async (): Promise<NativeDatabaseHealth | null> => {
  const db = await openDatabase();
  if (!db) return null;

  const version = await db.query('PRAGMA user_version;');
  const active = await db.isTransactionActive();
  return {
    schemaVersion: Number(version.values?.[0]?.user_version ?? 0),
    tools: await countRows(db, 'tools'),
    technicians: await countRows(db, 'technicians'),
    movements: await countRows(db, 'movements'),
    transactionActive: active.result,
  };
};

export const readNativeAppData = async (): Promise<AppData | null> => {
  const db = await openDatabase();
  if (!db) return null;

  const [technicianRows, toolRows, movementRows] = await Promise.all([
    db.query('SELECT * FROM technicians ORDER BY name COLLATE NOCASE;'),
    db.query(
      `SELECT tools.*, categories.name AS category_name, locations.name AS location_name
       FROM tools
       JOIN categories ON categories.id = tools.category_id
       JOIN locations ON locations.id = tools.location_id
       ORDER BY tools.code COLLATE NOCASE;`,
    ),
    db.query('SELECT * FROM movements ORDER BY sequence_number DESC;'),
  ]);

  const technicians = (technicianRows.values ?? []).map((row) => rowToTechnician(row));
  const tools = (toolRows.values ?? []).map((row) => rowToTool(row));
  const movements = (movementRows.values ?? []).map((row) => rowToMovement(row));

  if (technicians.length === 0 && tools.length === 0 && movements.length === 0) return null;
  return { schemaVersion: 1, tools, technicians, movements };
};

export const writeNativeAppData = async (
  data: AppData,
  options: { replace?: boolean } = {},
): Promise<void> => {
  const db = await openDatabase();
  if (!db) return;

  if (options.replace) {
    await replaceNormalizedData(db, data);
  } else {
    await mergeNormalizedData(db, data);
  }
};

export const recordNativeStorageEvent = async (
  eventType: string,
  detail?: string,
): Promise<void> => {
  const db = await openDatabase();
  if (!db) return;
  const occurredAt = nowIso();

  await db.run(
    'INSERT INTO storage_events (event_type, occurred_at, detail) VALUES (?, ?, ?);',
    [eventType, occurredAt, detail ?? null],
  );
  await db.run(
    `INSERT INTO audit_log (event_type, entity_type, occurred_at, detail)
     VALUES (?, 'storage', ?, ?);`,
    [eventType, occurredAt, detail ?? null],
  );
};

export const isNativeDatabaseEnabled = isNative;
