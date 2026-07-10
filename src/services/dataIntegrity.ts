import type {
  AppData,
  MaintenanceRecord,
  Movement,
  Technician,
  Tool,
  ToolAccessory,
} from '../domain/types';

export type IntegrityIssue = {
  code:
    | 'duplicate-tool-id'
    | 'duplicate-tool-code'
    | 'duplicate-tool-qr'
    | 'duplicate-technician-id'
    | 'duplicate-technician-code'
    | 'invalid-holder'
    | 'invalid-reservation'
    | 'invalid-loan-state'
    | 'duplicate-movement-id'
    | 'invalid-movement-tool'
    | 'invalid-movement-technician'
    | 'duplicate-accessory-id'
    | 'invalid-accessory-tool'
    | 'duplicate-maintenance-id'
    | 'invalid-maintenance-tool';
  message: string;
};

const normalized = (value: string) => value.trim().toUpperCase();

const keepLastUnique = <T,>(items: T[], key: (item: T) => string, issue: (item: T) => IntegrityIssue) => {
  const seen = new Set<string>();
  const kept: T[] = [];
  const issues: IntegrityIssue[] = [];

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    const value = key(item);
    if (seen.has(value)) {
      issues.push(issue(item));
      continue;
    }
    seen.add(value);
    kept.push(item);
  }

  return { items: kept.reverse(), issues };
};

const sanitizeTools = (tools: Tool[]) => {
  let result = keepLastUnique(
    tools,
    (tool) => tool.id,
    (tool) => ({ code: 'duplicate-tool-id', message: `Se ha rechazado un activo con ID repetido: ${tool.name}.` }),
  );
  let sanitized = result.items;
  const issues = [...result.issues];

  result = keepLastUnique(
    sanitized,
    (tool) => normalized(tool.code),
    (tool) => ({ code: 'duplicate-tool-code', message: `El código ${tool.code} ya pertenece a otra herramienta.` }),
  );
  sanitized = result.items;
  issues.push(...result.issues);

  result = keepLastUnique(
    sanitized,
    (tool) => normalized(tool.qrCode),
    (tool) => ({ code: 'duplicate-tool-qr', message: `El QR ${tool.qrCode} ya está registrado.` }),
  );
  sanitized = result.items;
  issues.push(...result.issues);

  return { tools: sanitized, issues };
};

const sanitizeTechnicians = (technicians: Technician[]) => {
  let result = keepLastUnique(
    technicians,
    (technician) => technician.id,
    (technician) => ({ code: 'duplicate-technician-id', message: `Se ha rechazado un técnico con ID repetido: ${technician.name}.` }),
  );
  let sanitized = result.items;
  const issues = [...result.issues];

  result = keepLastUnique(
    sanitized,
    (technician) => normalized(technician.code),
    (technician) => ({ code: 'duplicate-technician-code', message: `El código ${technician.code} ya pertenece a otro técnico.` }),
  );
  sanitized = result.items;
  issues.push(...result.issues);

  return { technicians: sanitized, issues };
};

const sanitizeMovements = (
  movements: Movement[],
  toolIds: Set<string>,
  technicianIds: Set<string>,
) => {
  const unique = keepLastUnique(
    movements,
    (movement) => movement.id,
    (movement) => ({ code: 'duplicate-movement-id', message: `Se ha rechazado un movimiento duplicado: ${movement.id}.` }),
  );
  const issues = [...unique.issues];
  const valid: Movement[] = [];

  for (const movement of unique.items) {
    if (!toolIds.has(movement.toolId)) {
      issues.push({
        code: 'invalid-movement-tool',
        message: `El movimiento ${movement.id} apuntaba a una herramienta inexistente y se ha aislado.`,
      });
      continue;
    }

    if (movement.technicianId && !technicianIds.has(movement.technicianId)) {
      issues.push({
        code: 'invalid-movement-technician',
        message: `El movimiento ${movement.id} tenía un técnico inexistente; se conserva como movimiento de almacén.`,
      });
      valid.push({ ...movement, technicianId: undefined, sequenceNumber: undefined });
      continue;
    }

    valid.push({ ...movement, sequenceNumber: undefined });
  }

  return { movements: valid, issues };
};

const sanitizeAccessories = (accessories: ToolAccessory[], toolIds: Set<string>) => {
  const unique = keepLastUnique(
    accessories,
    (accessory) => accessory.id,
    (accessory) => ({ code: 'duplicate-accessory-id', message: `Se ha rechazado un accesorio duplicado: ${accessory.name}.` }),
  );
  const issues = [...unique.issues];
  const valid = unique.items.filter((accessory) => {
    if (toolIds.has(accessory.toolId)) return true;
    issues.push({
      code: 'invalid-accessory-tool',
      message: `El accesorio ${accessory.name} no pertenece a una herramienta existente.`,
    });
    return false;
  });
  return { accessories: valid, issues };
};

const sanitizeMaintenance = (records: MaintenanceRecord[], toolIds: Set<string>) => {
  const unique = keepLastUnique(
    records,
    (record) => record.id,
    (record) => ({ code: 'duplicate-maintenance-id', message: `Se ha rechazado un expediente de mantenimiento duplicado: ${record.title}.` }),
  );
  const issues = [...unique.issues];
  const valid = unique.items.filter((record) => {
    if (toolIds.has(record.toolId)) return true;
    issues.push({
      code: 'invalid-maintenance-tool',
      message: `El expediente ${record.title} no pertenece a una herramienta existente.`,
    });
    return false;
  });
  return { maintenanceRecords: valid, issues };
};

export const enforceAppDataIntegrity = (source: AppData): { data: AppData; issues: IntegrityIssue[] } => {
  const toolResult = sanitizeTools(source.tools);
  const technicianResult = sanitizeTechnicians(source.technicians);
  const technicianIds = new Set(technicianResult.technicians.map((technician) => technician.id));
  const issues = [...toolResult.issues, ...technicianResult.issues];

  const tools = toolResult.tools.map((tool) => {
    let next = { ...tool, active: tool.active ?? tool.status !== 'retired' };

    if (next.status === 'loaned' && (!next.holderTechnicianId || !technicianIds.has(next.holderTechnicianId))) {
      issues.push({
        code: 'invalid-holder',
        message: `${next.name} figuraba prestada sin un técnico válido y se ha devuelto a disponible.`,
      });
      next = {
        ...next,
        status: 'available',
        holderTechnicianId: undefined,
        loanedAt: undefined,
        updatedAt: new Date().toISOString(),
      };
    }

    if (next.status !== 'loaned' && (next.holderTechnicianId || next.loanedAt)) {
      issues.push({
        code: 'invalid-loan-state',
        message: `${next.name} tenía datos de préstamo en un estado incompatible; se han limpiado.`,
      });
      next = { ...next, holderTechnicianId: undefined, loanedAt: undefined };
    }

    if (next.reservedTechnicianId && !technicianIds.has(next.reservedTechnicianId)) {
      issues.push({
        code: 'invalid-reservation',
        message: `${next.name} tenía una reserva asignada a un técnico inexistente; se ha cancelado.`,
      });
      next = { ...next, reservedTechnicianId: undefined, serviceStatus: 'none' };
    }

    if (next.serviceStatus === 'reserved' && !next.reservedTechnicianId) {
      next = { ...next, serviceStatus: 'none' };
    }

    if (next.serviceStatus && ['repair', 'waiting_parts', 'calibration', 'out_of_service'].includes(next.serviceStatus) && next.status === 'available') {
      next = { ...next, status: 'review' };
    }

    if (next.serviceStatus === 'lost') {
      next = { ...next, status: 'retired', active: false };
    }

    return next;
  });

  const toolIds = new Set(tools.map((tool) => tool.id));
  const movementResult = sanitizeMovements(source.movements, toolIds, technicianIds);
  const accessoryResult = sanitizeAccessories(source.accessories ?? [], toolIds);
  const maintenanceResult = sanitizeMaintenance(source.maintenanceRecords ?? [], toolIds);
  issues.push(...movementResult.issues, ...accessoryResult.issues, ...maintenanceResult.issues);

  return {
    data: {
      ...source,
      tools,
      technicians: technicianResult.technicians,
      movements: movementResult.movements,
      accessories: accessoryResult.accessories,
      maintenanceRecords: maintenanceResult.maintenanceRecords,
    },
    issues,
  };
};
