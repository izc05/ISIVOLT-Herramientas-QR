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
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MovementType = 'loan' | 'return' | 'tool_created' | 'technician_created' | 'nfc_linked';

export type Movement = {
  id: string;
  type: MovementType;
  occurredAt: string;
  toolId?: string;
  technicianId?: string;
  detail: string;
};

export type AppData = {
  schemaVersion: 2;
  tools: Tool[];
  technicians: Technician[];
  movements: Movement[];
};

export type ViewId = 'dashboard' | 'tools' | 'technicians' | 'movements';
