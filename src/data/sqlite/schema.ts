export type DatabaseMigration = {
  version: number;
  name: string;
  statements: string;
};

export const MOVEMENT_IMMUTABILITY_TRIGGERS = `
CREATE TRIGGER IF NOT EXISTS movements_prevent_update
BEFORE UPDATE ON movements
BEGIN
  SELECT RAISE(ABORT, 'Los movimientos son inmutables. Registra una rectificación.');
END;

CREATE TRIGGER IF NOT EXISTS movements_prevent_delete
BEFORE DELETE ON movements
BEGIN
  SELECT RAISE(ABORT, 'Los movimientos no se pueden eliminar.');
END;
`;

export const DROP_MOVEMENT_IMMUTABILITY_TRIGGERS = `
DROP TRIGGER IF EXISTS movements_prevent_update;
DROP TRIGGER IF EXISTS movements_prevent_delete;
`;

export const DATABASE_MIGRATIONS: DatabaseMigration[] = [
  {
    version: 1,
    name: 'normalized_inventory_core',
    statements: `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS technicians (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  extension TEXT,
  previous_phone TEXT,
  email TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  qr_code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  location_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'loaned', 'review', 'damaged', 'retired')),
  holder_technician_id TEXT,
  loaned_at TEXT,
  notes TEXT,
  photo_uri TEXT,
  thumbnail_uri TEXT,
  legacy_image_data_url TEXT,
  image_updated_at TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (holder_technician_id) REFERENCES technicians(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CHECK (
    (status = 'loaned' AND holder_technician_id IS NOT NULL AND loaned_at IS NOT NULL)
    OR
    (status <> 'loaned' AND holder_technician_id IS NULL AND loaned_at IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS movements (
  id TEXT PRIMARY KEY,
  sequence_number INTEGER NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('delivery', 'return', 'incident', 'adjustment')),
  tool_id TEXT NOT NULL,
  technician_id TEXT,
  operator_name TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  next_status TEXT NOT NULL,
  condition TEXT CHECK (condition IS NULL OR condition IN ('ok', 'review', 'damaged')),
  notes TEXT,
  occurred_at TEXT NOT NULL,
  device_id TEXT,
  reversed_movement_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'error')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (tool_id) REFERENCES tools(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (technician_id) REFERENCES technicians(id) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (reversed_movement_id) REFERENCES movements(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS accessories (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  name TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 1 CHECK (required IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tool_id, name COLLATE NOCASE),
  FOREIGN KEY (tool_id) REFERENCES tools(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS movement_accessories (
  movement_id TEXT NOT NULL,
  accessory_id TEXT NOT NULL,
  included INTEGER NOT NULL CHECK (included IN (0, 1)),
  condition TEXT,
  notes TEXT,
  PRIMARY KEY (movement_id, accessory_id),
  FOREIGN KEY (movement_id) REFERENCES movements(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (accessory_id) REFERENCES accessories(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'warehouse', 'technician')),
  technician_id TEXT,
  pin_hash TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (technician_id) REFERENCES technicians(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  operator_name TEXT,
  occurred_at TEXT NOT NULL,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_tools_status ON tools(status);
CREATE INDEX IF NOT EXISTS idx_tools_holder ON tools(holder_technician_id);
CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(category_id);
CREATE INDEX IF NOT EXISTS idx_tools_location ON tools(location_id);
CREATE INDEX IF NOT EXISTS idx_movements_tool_time ON movements(tool_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_technician_time ON movements(technician_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_type_time ON movements(type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(occurred_at DESC);

${MOVEMENT_IMMUTABILITY_TRIGGERS}
`,
  },
  {
    version: 2,
    name: 'asset_management_and_maintenance',
    statements: `
ALTER TABLE tools ADD COLUMN service_status TEXT NOT NULL DEFAULT 'none'
  CHECK (service_status IN ('none', 'reserved', 'repair', 'waiting_parts', 'calibration', 'out_of_service', 'lost'));
ALTER TABLE tools ADD COLUMN reserved_technician_id TEXT REFERENCES technicians(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE tools ADD COLUMN purchase_date TEXT;
ALTER TABLE tools ADD COLUMN purchase_cost REAL CHECK (purchase_cost IS NULL OR purchase_cost >= 0);
ALTER TABLE tools ADD COLUMN supplier TEXT;
ALTER TABLE tools ADD COLUMN next_review_date TEXT;
ALTER TABLE tools ADD COLUMN next_calibration_date TEXT;
ALTER TABLE tools ADD COLUMN max_loan_days INTEGER CHECK (max_loan_days IS NULL OR max_loan_days >= 0);

ALTER TABLE accessories ADD COLUMN condition TEXT NOT NULL DEFAULT 'not_checked'
  CHECK (condition IN ('ok', 'missing', 'damaged', 'not_checked'));
ALTER TABLE accessories ADD COLUMN notes TEXT;

CREATE TABLE IF NOT EXISTS maintenance_records (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('incident', 'inspection', 'repair', 'calibration', 'status_change')),
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'waiting_parts', 'completed', 'cancelled')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  resolution TEXT,
  operator_name TEXT NOT NULL,
  assigned_to TEXT,
  opened_at TEXT NOT NULL,
  due_at TEXT,
  completed_at TEXT,
  cost REAL CHECK (cost IS NULL OR cost >= 0),
  parts TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tool_id) REFERENCES tools(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_tools_service_status ON tools(service_status);
CREATE INDEX IF NOT EXISTS idx_tools_review_date ON tools(next_review_date);
CREATE INDEX IF NOT EXISTS idx_tools_calibration_date ON tools(next_calibration_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_tool_time ON maintenance_records(tool_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_status_due ON maintenance_records(status, due_at);
`,
  },
  {
    version: 3,
    name: 'nfc_identification',
    statements: `
ALTER TABLE technicians ADD COLUMN nfc_uid TEXT;
ALTER TABLE tools ADD COLUMN nfc_uid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_technicians_nfc_uid
  ON technicians(nfc_uid COLLATE NOCASE)
  WHERE nfc_uid IS NOT NULL AND nfc_uid <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_tools_nfc_uid
  ON tools(nfc_uid COLLATE NOCASE)
  WHERE nfc_uid IS NOT NULL AND nfc_uid <> '';
`,
  },
  {
    version: 4,
    name: 'movement_operation_idempotency',
    statements: `
ALTER TABLE movements ADD COLUMN operation_id TEXT;
CREATE INDEX IF NOT EXISTS idx_movements_operation_id
  ON movements(operation_id)
  WHERE operation_id IS NOT NULL AND operation_id <> '';
`,
  },
  {
    version: 5,
    name: 'technician_barcode_identification',
    statements: `
ALTER TABLE technicians ADD COLUMN barcode_value TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_technicians_barcode_value
  ON technicians(barcode_value COLLATE NOCASE)
  WHERE barcode_value IS NOT NULL AND barcode_value <> '';
`,
  },
];
