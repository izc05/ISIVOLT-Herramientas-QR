import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import type { AppData } from '../domain/types';

const DATABASE_NAME = 'isivolt_herramientas';
const DATABASE_VERSION = 1;

let sqlite: SQLiteConnection | null = null;
let database: SQLiteDBConnection | null = null;
let openingPromise: Promise<SQLiteDBConnection | null> | null = null;

const isNative = () => Capacitor.isNativePlatform();

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
        DATABASE_VERSION,
        false,
      );
    }

    await database.open();
    await database.execute(`
      PRAGMA foreign_keys = ON;
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
      );
    `);

    return database;
  })();

  try {
    return await openingPromise;
  } finally {
    openingPromise = null;
  }
};

const parseSnapshot = (value: unknown): AppData | null => {
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<AppData>;
    if (
      parsed.schemaVersion !== 1 ||
      !Array.isArray(parsed.tools) ||
      !Array.isArray(parsed.technicians) ||
      !Array.isArray(parsed.movements)
    ) {
      return null;
    }
    return parsed as AppData;
  } catch {
    return null;
  }
};

export const readNativeAppData = async (): Promise<AppData | null> => {
  const db = await openDatabase();
  if (!db) return null;

  const result = await db.query('SELECT payload FROM app_state WHERE id = 1;');
  return parseSnapshot(result.values?.[0]?.payload);
};

export const writeNativeAppData = async (data: AppData): Promise<void> => {
  const db = await openDatabase();
  if (!db) return;

  const timestamp = new Date().toISOString();
  await db.run(
    `INSERT INTO app_state (id, schema_version, payload, updated_at)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       schema_version = excluded.schema_version,
       payload = excluded.payload,
       updated_at = excluded.updated_at;`,
    [data.schemaVersion, JSON.stringify(data), timestamp],
  );
};

export const recordNativeStorageEvent = async (
  eventType: string,
  detail?: string,
): Promise<void> => {
  const db = await openDatabase();
  if (!db) return;

  await db.run(
    'INSERT INTO storage_events (event_type, occurred_at, detail) VALUES (?, ?, ?);',
    [eventType, new Date().toISOString(), detail ?? null],
  );
};

export const isNativeDatabaseEnabled = isNative;
