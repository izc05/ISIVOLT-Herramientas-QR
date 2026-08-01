export type ToolStatus = 'available' | 'loaned' | 'review' | 'retired';

export type Tool = {
  id: string;
  code: string;
  name: string;
  category: string;
  location: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
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
  schemaVersion: 2;
  tools: Tool[];
  technicians: Technician[];
  movements: Movement[];
  batches: BatchTransaction[];
};

export type ViewId = 'dashboard' | 'tools' | 'technicians' | 'movements';
