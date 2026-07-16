export type ToolStatus = 'available' | 'loaned' | 'review' | 'damaged' | 'retired';

export type ToolServiceStatus =
  | 'none'
  | 'reserved'
  | 'repair'
  | 'waiting_parts'
  | 'calibration'
  | 'out_of_service'
  | 'lost';

export type MovementType = 'delivery' | 'return' | 'incident' | 'adjustment';

export type ReturnCondition = 'ok' | 'review' | 'damaged';

export type MovementSyncStatus = 'local' | 'pending' | 'synced' | 'error';

export type MaintenanceType = 'incident' | 'inspection' | 'repair' | 'calibration' | 'status_change';

export type MaintenanceStatus = 'open' | 'in_progress' | 'waiting_parts' | 'completed' | 'cancelled';

export type AccessoryCondition = 'ok' | 'missing' | 'damaged' | 'not_checked';

export type Tool = {
  id: string;
  code: string;
  qrCode: string;
  nfcUid?: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  location: string;
  status: ToolStatus;
  serviceStatus?: ToolServiceStatus;
  reservedTechnicianId?: string;
  holderTechnicianId?: string;
  loanedAt?: string;
  notes?: string;
  imageDataUrl?: string;
  photoUri?: string;
  thumbnailUri?: string;
  imageUpdatedAt?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  supplier?: string;
  nextReviewDate?: string;
  nextCalibrationDate?: string;
  maxLoanDays?: number;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Technician = {
  id: string;
  code: string;
  nfcUid?: string;
  name: string;
  specialty: string;
  role?: string;
  phone?: string;
  extension?: string;
  previousPhone?: string;
  email?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Movement = {
  id: string;
  sequenceNumber?: number;
  type: MovementType;
  toolId: string;
  technicianId?: string;
  operatorName: string;
  deviceId?: string;
  occurredAt: string;
  previousStatus: ToolStatus;
  nextStatus: ToolStatus;
  condition?: ReturnCondition;
  notes?: string;
  reversedMovementId?: string;
  syncStatus?: MovementSyncStatus;
};

export type ToolAccessory = {
  id: string;
  toolId: string;
  name: string;
  required: boolean;
  active: boolean;
  condition?: AccessoryCondition;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type MaintenanceRecord = {
  id: string;
  toolId: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  title: string;
  description: string;
  resolution?: string;
  operatorName: string;
  assignedTo?: string;
  openedAt: string;
  dueAt?: string;
  completedAt?: string;
  cost?: number;
  parts?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type AppData = {
  schemaVersion: 1;
  tools: Tool[];
  technicians: Technician[];
  movements: Movement[];
  accessories?: ToolAccessory[];
  maintenanceRecords?: MaintenanceRecord[];
};

export type OperationMode = 'delivery' | 'return';
