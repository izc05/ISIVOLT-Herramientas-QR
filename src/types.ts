export type ToolStatus = 'available' | 'loaned' | 'review' | 'retired';
export type ToolKind = 'returnable-tool' | 'loanable-material' | 'measuring-equipment' | 'kit' | 'ppe' | 'consumable' | 'other';
export type ToolServiceState = 'ready' | 'reserved' | 'review' | 'repair' | 'lost' | 'retired';
export type TechnicianStatus = 'active' | 'inactive' | 'absent' | 'vacation' | 'leave' | 'blocked';

export type PhotoReference = {
  id: string;
  storage: 'indexeddb' | 'pocketbase';
  filename: string;
  mimeType: string;
  primary?: boolean;
  remoteId?: string;
  createdAt: string;
};

export type CatalogEntry = {
  id: string;
  name: string;
  code?: string;
  color?: string;
  icon?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LocationEntry = CatalogEntry & {
  parentId?: string;
  description?: string;
};

export type Tool = {
  id: string;
  code: string;
  name: string;
  category: string;
  categoryId?: string;
  location: string;
  locationId?: string;
  kind?: ToolKind;
  serviceState?: ToolServiceState;
  description?: string;
  notes?: string;
  photos?: PhotoReference[];
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  reviewDueDate?: string;
  calibrationDueDate?: string;
  reviewIntervalDays?: number;
  calibrationIntervalDays?: number;
  quantity?: number;
  minStock?: number;
  unit?: string;
  qrPayload: string;
  nfcTag?: string;
  status: ToolStatus;
  technicianId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Technician = {
  id: string;
  code: string;
  name: string;
  category: string;
  categoryId?: string;
  status?: TechnicianStatus;
  company?: string;
  department?: string;
  notes?: string;
  photos?: PhotoReference[];
  phone?: string;
  email?: string;
  qrPayload?: string;
  nfcTag?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type IdentificationMethod = 'manual' | 'qr' | 'nfc' | 'authenticated';
export type ScanMethod = 'manual' | 'qr' | 'nfc' | 'mixed';
export type OperatorMode = 'administrator' | 'self-service';
export type BatchOperation = 'loan' | 'return';

export type MovementType = 'loan' | 'return' | 'tool_created' | 'technician_created' | 'nfc_linked';

export type Movement = {
  id: string;
  type: MovementType;
  occurredAt: string;
  toolId?: string;
  technicianId?: string;
  batchId?: string;
  identificationMethod?: IdentificationMethod;
  scanMethod?: ScanMethod;
  detail: string;
};

export type BatchTransaction = {
  id: string;
  operation: BatchOperation;
  technicianId: string;
  toolIds: string[];
  operatorMode: OperatorMode;
  identificationMethod: IdentificationMethod;
  scanMethod: ScanMethod;
  startedAt: string;
  completedAt: string;
};

export type AppData = {
  schemaVersion: 2 | 3;
  tools: Tool[];
  technicians: Technician[];
  movements: Movement[];
  batches: BatchTransaction[];
  toolCategories?: CatalogEntry[];
  technicianCategories?: CatalogEntry[];
  locations?: LocationEntry[];
};

export type ViewId = 'dashboard' | 'tools' | 'technicians' | 'movements';
