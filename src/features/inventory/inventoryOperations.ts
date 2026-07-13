import type { AppData, Movement, Tool, ToolStatus } from '../../domain/types';

export type InventoryPreset = 'all' | 'available' | 'loaned' | 'attention';

export const buildToolCategories = (tools: Tool[]) => [
  'Todas',
  ...Array.from(new Set(tools.map((tool) => tool.category.trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'es')),
];

export const matchesInventoryPreset = (tool: Tool, preset: InventoryPreset) => {
  if (preset === 'all') return true;
  if (preset === 'attention') {
    return tool.status === 'review'
      || tool.status === 'damaged'
      || ['repair', 'waiting_parts', 'calibration', 'out_of_service', 'lost'].includes(tool.serviceStatus ?? 'none');
  }
  return tool.status === preset;
};

export const filterInventoryTools = (
  tools: Tool[],
  query: string,
  category: string,
  preset: InventoryPreset,
) => {
  const needle = query.trim().toLocaleLowerCase('es-ES');
  return tools.filter((tool) => {
    const matchesText = !needle || [
      tool.name,
      tool.code,
      tool.category,
      tool.location,
      tool.brand ?? '',
      tool.model ?? '',
      tool.serialNumber ?? '',
    ].some((value) => value.toLocaleLowerCase('es-ES').includes(needle));
    const matchesCategory = category === 'Todas' || tool.category === category;
    return matchesText && matchesCategory && matchesInventoryPreset(tool, preset);
  });
};

export const latestMovementByType = (movements: Movement[], toolId: string, types: Movement['type'][]) =>
  movements
    .filter((movement) => movement.toolId === toolId && types.includes(movement.type))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];

export const buildToolMovementTimes = (data: AppData, toolId: string) => ({
  checkout: latestMovementByType(data.movements, toolId, ['delivery']),
  checkin: latestMovementByType(data.movements, toolId, ['return', 'incident']),
});

export type ToolScanAlert = {
  blocked: boolean;
  title: string;
  detail: string;
  status: ToolStatus;
};

const serviceLabels = {
  none: '',
  reserved: 'reservada',
  repair: 'en reparación',
  waiting_parts: 'pendiente de repuesto',
  calibration: 'en calibración',
  out_of_service: 'fuera de servicio',
  lost: 'marcada como extraviada',
} as const;

export const getDeliveryAlert = (tool: Tool, technicianId?: string): ToolScanAlert | null => {
  if (tool.status === 'damaged') {
    return { blocked: true, title: 'Herramienta averiada', detail: tool.notes || 'La entrega está bloqueada hasta resolver la incidencia.', status: tool.status };
  }
  if (tool.status === 'review') {
    return { blocked: true, title: 'Herramienta pendiente de revisión', detail: tool.notes || 'Debe revisarse antes de volver a entregarla.', status: tool.status };
  }
  if (tool.status === 'retired') {
    return { blocked: true, title: 'Herramienta dada de baja', detail: 'No puede utilizarse en una nueva entrega.', status: tool.status };
  }
  if (tool.status === 'loaned') {
    return { blocked: true, title: 'Herramienta ya prestada', detail: 'Debe registrarse la devolución antes de una nueva salida.', status: tool.status };
  }

  const serviceStatus = tool.serviceStatus ?? 'none';
  if (['repair', 'waiting_parts', 'calibration', 'out_of_service', 'lost'].includes(serviceStatus)) {
    return {
      blocked: true,
      title: 'Herramienta bloqueada por mantenimiento',
      detail: `${tool.name} está ${serviceLabels[serviceStatus]}.`,
      status: tool.status,
    };
  }

  if (serviceStatus === 'reserved' && tool.reservedTechnicianId && tool.reservedTechnicianId !== technicianId) {
    return {
      blocked: true,
      title: 'Herramienta reservada',
      detail: 'Está reservada para otro técnico y no puede entregarse en esta operación.',
      status: tool.status,
    };
  }

  return null;
};

export const formatOperationDateTime = (iso?: string) => {
  if (!iso) return 'Sin registrar';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
};
