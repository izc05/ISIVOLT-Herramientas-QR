export type ToolStatus = 'available' | 'loaned' | 'review' | 'damaged' | 'retired';

export type MovementType = 'delivery' | 'return' | 'incident' | 'adjustment';

export type ReturnCondition = 'ok' | 'review' | 'damaged';

export type Tool = {
  id: string;
  code: string;
  qrCode: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  location: string;
  status: ToolStatus;
  holderTechnicianId?: string;
  loanedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type Technician = {
  id: string;
  code: string;
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
  type: MovementType;
  toolId: string;
  technicianId?: string;
  operatorName: string;
  occurredAt: string;
  previousStatus: ToolStatus;
  nextStatus: ToolStatus;
  condition?: ReturnCondition;
  notes?: string;
};

export type AppData = {
  schemaVersion: 1;
  tools: Tool[];
  technicians: Technician[];
  movements: Movement[];
};

export type OperationMode = 'delivery' | 'return';