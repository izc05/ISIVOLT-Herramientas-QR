import type { AppData, Technician, Tool } from '../domain/types';

export type IntegrityIssue = {
  code:
    | 'duplicate-tool-id'
    | 'duplicate-tool-code'
    | 'duplicate-tool-qr'
    | 'duplicate-technician-id'
    | 'duplicate-technician-code'
    | 'invalid-holder'
    | 'invalid-loan-state'
    | 'duplicate-movement-id';
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

export const enforceAppDataIntegrity = (source: AppData): { data: AppData; issues: IntegrityIssue[] } => {
  const toolResult = sanitizeTools(source.tools);
  const technicianResult = sanitizeTechnicians(source.technicians);
  const technicianIds = new Set(technicianResult.technicians.map((technician) => technician.id));
  const issues = [...toolResult.issues, ...technicianResult.issues];

  const tools = toolResult.tools.map((tool) => {
    if (tool.status === 'loaned' && (!tool.holderTechnicianId || !technicianIds.has(tool.holderTechnicianId))) {
      issues.push({
        code: 'invalid-holder',
        message: `${tool.name} figuraba prestada sin un técnico válido y se ha devuelto a disponible.`,
      });
      return {
        ...tool,
        status: 'available' as const,
        holderTechnicianId: undefined,
        loanedAt: undefined,
        updatedAt: new Date().toISOString(),
      };
    }

    if (tool.status !== 'loaned' && (tool.holderTechnicianId || tool.loanedAt)) {
      issues.push({
        code: 'invalid-loan-state',
        message: `${tool.name} tenía datos de préstamo en un estado incompatible; se han limpiado.`,
      });
      return { ...tool, holderTechnicianId: undefined, loanedAt: undefined };
    }

    return tool;
  });

  const movementResult = keepLastUnique(
    source.movements,
    (movement) => movement.id,
    (movement) => ({ code: 'duplicate-movement-id', message: `Se ha rechazado un movimiento duplicado: ${movement.id}.` }),
  );
  issues.push(...movementResult.issues);

  return {
    data: {
      ...source,
      tools,
      technicians: technicianResult.technicians,
      movements: movementResult.items,
    },
    issues,
  };
};
