import type { AppData, Movement, Tool } from '../../domain/types';

export type ManagementAlertSeverity = 'critical' | 'warning' | 'info';

export type ManagementAlert = {
  id: string;
  toolId: string;
  severity: ManagementAlertSeverity;
  type: 'overdue' | 'review' | 'calibration' | 'incident' | 'maintenance' | 'accessory' | 'photo' | 'qr';
  title: string;
  detail: string;
  dueAt?: string;
};

const daysBetween = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / 86_400_000);

const validDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const latestDelivery = (data: AppData, toolId: string): Movement | undefined => data.movements
  .filter((movement) => movement.toolId === toolId && movement.type === 'delivery')
  .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];

const appendLoanAlert = (
  alerts: ManagementAlert[],
  data: AppData,
  tool: Tool,
  now: Date,
) => {
  if (tool.status !== 'loaned') return;
  const holder = data.technicians.find((item) => item.id === tool.holderTechnicianId)?.name ?? 'Sin responsable';
  const delivery = latestDelivery(data, tool.id);
  const explicitDue = validDate(delivery?.expectedReturnAt);

  if (explicitDue) {
    const remainingMilliseconds = explicitDue.getTime() - now.getTime();
    const remainingHours = Math.ceil(remainingMilliseconds / 3_600_000);
    if (remainingMilliseconds < 0) {
      const overdueHours = Math.max(1, Math.ceil(Math.abs(remainingMilliseconds) / 3_600_000));
      const detail = overdueHours < 48
        ? `${overdueHours} horas de retraso · responsable: ${holder}`
        : `${Math.ceil(overdueHours / 24)} días de retraso · responsable: ${holder}`;
      alerts.push({
        id: `overdue-${tool.id}`,
        toolId: tool.id,
        severity: 'critical',
        type: 'overdue',
        title: `${tool.name}: devolución vencida`,
        detail,
        dueAt: delivery?.expectedReturnAt,
      });
      return;
    }

    if (remainingHours <= 24) {
      alerts.push({
        id: `overdue-soon-${tool.id}`,
        toolId: tool.id,
        severity: 'warning',
        type: 'overdue',
        title: `${tool.name}: devolución próxima`,
        detail: remainingHours <= 1
          ? `Vence en menos de una hora · responsable: ${holder}`
          : `Vence en ${remainingHours} horas · responsable: ${holder}`,
        dueAt: delivery?.expectedReturnAt,
      });
    }
    return;
  }

  if (!tool.loanedAt || (tool.maxLoanDays ?? 0) <= 0) return;
  const loaned = validDate(tool.loanedAt);
  if (!loaned) return;
  const elapsed = Math.max(0, daysBetween(loaned, now));
  if (elapsed > (tool.maxLoanDays ?? 0)) {
    alerts.push({
      id: `overdue-${tool.id}`,
      toolId: tool.id,
      severity: 'critical',
      type: 'overdue',
      title: `${tool.name} supera el plazo de préstamo`,
      detail: `${elapsed} días fuera · responsable: ${holder} · límite: ${tool.maxLoanDays} días`,
    });
  }
};

const toolAlerts = (data: AppData, tool: Tool, now: Date): ManagementAlert[] => {
  const alerts: ManagementAlert[] = [];

  appendLoanAlert(alerts, data, tool, now);

  const review = validDate(tool.nextReviewDate);
  if (review) {
    const remaining = daysBetween(now, review);
    if (remaining <= 30) {
      alerts.push({
        id: `review-${tool.id}`,
        toolId: tool.id,
        severity: remaining < 0 ? 'critical' : 'warning',
        type: 'review',
        title: remaining < 0 ? `${tool.name}: revisión vencida` : `${tool.name}: revisión próxima`,
        detail: remaining < 0 ? `Venció hace ${Math.abs(remaining)} días` : `Faltan ${remaining} días`,
        dueAt: tool.nextReviewDate,
      });
    }
  }

  const calibration = validDate(tool.nextCalibrationDate);
  if (calibration) {
    const remaining = daysBetween(now, calibration);
    if (remaining <= 45) {
      alerts.push({
        id: `calibration-${tool.id}`,
        toolId: tool.id,
        severity: remaining < 0 ? 'critical' : 'warning',
        type: 'calibration',
        title: remaining < 0 ? `${tool.name}: calibración vencida` : `${tool.name}: calibración próxima`,
        detail: remaining < 0 ? `Venció hace ${Math.abs(remaining)} días` : `Faltan ${remaining} días`,
        dueAt: tool.nextCalibrationDate,
      });
    }
  }

  if (tool.status === 'damaged' || tool.status === 'review') {
    alerts.push({
      id: `incident-${tool.id}`,
      toolId: tool.id,
      severity: tool.status === 'damaged' ? 'critical' : 'warning',
      type: 'incident',
      title: `${tool.name} requiere atención`,
      detail: tool.status === 'damaged' ? 'Figura como averiada y no puede entregarse.' : 'Permanece bloqueada para revisión.',
    });
  }

  if (tool.serviceStatus && tool.serviceStatus !== 'none' && tool.serviceStatus !== 'reserved') {
    const labels = {
      repair: 'en reparación',
      waiting_parts: 'pendiente de repuesto',
      calibration: 'en calibración',
      out_of_service: 'fuera de servicio',
      lost: 'extraviada',
    } as const;
    const label = labels[tool.serviceStatus as keyof typeof labels];
    if (label) {
      alerts.push({
        id: `service-${tool.id}`,
        toolId: tool.id,
        severity: tool.serviceStatus === 'lost' || tool.serviceStatus === 'out_of_service' ? 'critical' : 'warning',
        type: 'maintenance',
        title: `${tool.name} está ${label}`,
        detail: 'Consulta o actualiza su expediente de mantenimiento.',
      });
    }
  }

  const accessories = (data.accessories ?? []).filter((item) => item.toolId === tool.id && item.active);
  const missing = accessories.filter((item) => item.condition === 'missing');
  const damaged = accessories.filter((item) => item.condition === 'damaged');
  if (missing.length > 0) {
    alerts.push({
      id: `accessory-missing-${tool.id}`,
      toolId: tool.id,
      severity: 'critical',
      type: 'accessory',
      title: `${tool.name}: faltan accesorios`,
      detail: missing.map((item) => item.name).join(', '),
    });
  }
  if (damaged.length > 0) {
    alerts.push({
      id: `accessory-damaged-${tool.id}`,
      toolId: tool.id,
      severity: 'warning',
      type: 'accessory',
      title: `${tool.name}: accesorios dañados`,
      detail: damaged.map((item) => item.name).join(', '),
    });
  }

  const image = tool.thumbnailUri || tool.photoUri || tool.imageDataUrl;
  if (!image) {
    alerts.push({
      id: `photo-${tool.id}`,
      toolId: tool.id,
      severity: 'info',
      type: 'photo',
      title: `${tool.name} no tiene fotografía`,
      detail: 'Añade una imagen para mejorar la identificación visual.',
    });
  }

  if (!tool.qrCode || !tool.qrCode.startsWith('ISIVOLT:TOOL:')) {
    alerts.push({
      id: `qr-${tool.id}`,
      toolId: tool.id,
      severity: 'warning',
      type: 'qr',
      title: `${tool.name} tiene un QR inválido`,
      detail: 'Regenera la identificación antes de utilizar el escáner.',
    });
  }

  return alerts;
};

export const buildManagementAlerts = (data: AppData, now = new Date()): ManagementAlert[] => {
  const alerts = data.tools.flatMap((tool) => toolAlerts(data, tool, now));
  const openMaintenance = data.maintenanceRecords ?? [];

  for (const record of openMaintenance) {
    if (record.status === 'completed' || record.status === 'cancelled') continue;
    const due = validDate(record.dueAt);
    if (due && due < now) {
      const tool = data.tools.find((item) => item.id === record.toolId);
      alerts.push({
        id: `maintenance-record-${record.id}`,
        toolId: record.toolId,
        severity: 'critical',
        type: 'maintenance',
        title: `${tool?.name ?? 'Herramienta'}: actuación vencida`,
        detail: record.title,
        dueAt: record.dueAt,
      });
    }
  }

  const priority: Record<ManagementAlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => priority[a.severity] - priority[b.severity] || a.title.localeCompare(b.title, 'es'));
};
