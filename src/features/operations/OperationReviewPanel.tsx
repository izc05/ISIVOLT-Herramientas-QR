import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  ClipboardList,
  LoaderCircle,
  MapPin,
  PackageCheck,
  RotateCcw,
  UserRound,
  Wrench,
} from 'lucide-react';
import type {
  AccessoryCondition,
  OperationMode,
  ReturnCondition,
  Technician,
  Tool,
  ToolAccessory,
} from '../../domain/types';

const conditionOptions: Array<{
  value: ReturnCondition;
  label: string;
  Icon: typeof Check;
}> = [
  { value: 'ok', label: 'Correcta', Icon: Check },
  { value: 'review', label: 'Revisión', Icon: RotateCcw },
  { value: 'damaged', label: 'Averiada', Icon: AlertTriangle },
];

const accessoryConditionOptions: Array<{
  value: AccessoryCondition;
  label: string;
}> = [
  { value: 'ok', label: 'Correcto' },
  { value: 'missing', label: 'Falta' },
  { value: 'damaged', label: 'Dañado' },
  { value: 'not_checked', label: 'Sin revisar' },
];

type AccessoryChecks = Record<string, Record<string, AccessoryCondition>>;

type Props = {
  mode: OperationMode;
  operationId: string;
  technician: Technician | null;
  tools: Tool[];
  accessories: ToolAccessory[];
  returnConditions: Record<string, ReturnCondition>;
  accessoryChecks: AccessoryChecks;
  expectedReturnAt: string;
  workOrder: string;
  workLocation: string;
  notes: string;
  saving: boolean;
  onConditionChange: (toolId: string, condition: ReturnCondition) => void;
  onAccessoryConditionChange: (
    toolId: string,
    accessoryId: string,
    condition: AccessoryCondition,
  ) => void;
  onExpectedReturnAtChange: (value: string) => void;
  onWorkOrderChange: (value: string) => void;
  onWorkLocationChange: (value: string) => void;
  onNotesChange: (notes: string) => void;
  onBack: () => void;
  onConfirm: () => void;
};

export default function OperationReviewPanel({
  mode,
  operationId,
  technician,
  tools,
  accessories,
  returnConditions,
  accessoryChecks,
  expectedReturnAt,
  workOrder,
  workLocation,
  notes,
  saving,
  onConditionChange,
  onAccessoryConditionChange,
  onExpectedReturnAtChange,
  onWorkOrderChange,
  onWorkLocationChange,
  onNotesChange,
  onBack,
  onConfirm,
}: Props) {
  const selectedToolIds = new Set(tools.map((tool) => tool.id));
  const selectedAccessories = accessories.filter(
    (accessory) => accessory.active && selectedToolIds.has(accessory.toolId),
  );
  const requiredUnchecked = selectedAccessories.filter((accessory) => (
    accessory.required
    && (accessoryChecks[accessory.toolId]?.[accessory.id] ?? 'not_checked') === 'not_checked'
  ));
  const deliveryAccessoryProblems = mode === 'delivery'
    ? selectedAccessories.filter((accessory) => (
      accessory.required
      && (accessoryChecks[accessory.toolId]?.[accessory.id] ?? 'not_checked') !== 'ok'
    ))
    : [];
  const accessoryIncidents = selectedAccessories.filter((accessory) => {
    const value = accessoryChecks[accessory.toolId]?.[accessory.id] ?? 'not_checked';
    return value === 'missing' || value === 'damaged';
  });
  const toolIncidentCount = mode === 'return'
    ? tools.filter((tool) => (returnConditions[tool.id] ?? 'ok') !== 'ok').length
    : 0;
  const incidentCount = toolIncidentCount + accessoryIncidents.length;
  const requiresNotes = incidentCount > 0;
  const canConfirm = tools.length > 0
    && (mode === 'return' || Boolean(technician))
    && requiredUnchecked.length === 0
    && deliveryAccessoryProblems.length === 0
    && (!requiresNotes || notes.trim().length > 0)
    && !saving;

  return (
    <section className="operation-review-panel" aria-label="Revisar operación">
      <header className="operation-review-header">
        <button type="button" onClick={onBack} disabled={saving} aria-label="Modificar operación">
          <ArrowLeft size={19} /> Modificar
        </button>
        <div>
          <small>Comprobación final</small>
          <h3>{mode === 'delivery' ? 'Revisar préstamo' : 'Revisar devolución'}</h3>
        </div>
      </header>

      <article className="operation-review-technician">
        <span><UserRound size={21} /></span>
        <div>
          <small>Técnico responsable</small>
          <strong>{technician ? `${technician.name} · ${technician.code}` : 'Se determinará por la herramienta'}</strong>
        </div>
      </article>

      <section className="operation-context-grid" aria-label="Datos del trabajo">
        <label>
          <span><ClipboardList size={16} /> Orden de trabajo</span>
          <input
            value={workOrder}
            disabled={saving}
            onChange={(event) => onWorkOrderChange(event.target.value)}
            placeholder="Ej. OT 104582"
          />
        </label>
        <label>
          <span><MapPin size={16} /> Ubicación del trabajo</span>
          <input
            value={workLocation}
            disabled={saving}
            onChange={(event) => onWorkLocationChange(event.target.value)}
            placeholder="Ej. Quirófano 2 · planta 2"
          />
        </label>
        {mode === 'delivery' && (
          <label className="operation-context-wide">
            <span><CalendarClock size={16} /> Devolución prevista</span>
            <input
              type="datetime-local"
              value={expectedReturnAt}
              disabled={saving}
              onChange={(event) => onExpectedReturnAtChange(event.target.value)}
            />
          </label>
        )}
      </section>

      <div className="operation-review-tools">
        {tools.map((tool) => {
          const condition = returnConditions[tool.id] ?? 'ok';
          const toolAccessories = selectedAccessories.filter((accessory) => accessory.toolId === tool.id);
          return (
            <article key={tool.id} className={`operation-review-tool condition-${condition}`}>
              <div className="operation-review-tool-heading">
                <span><Wrench size={18} /></span>
                <div>
                  <strong>{tool.name}</strong>
                  <small>{tool.code} · {tool.category}</small>
                </div>
              </div>

              {mode === 'return' ? (
                <div className="operation-review-conditions" aria-label={`Estado de ${tool.name}`}>
                  {conditionOptions.map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      disabled={saving}
                      className={condition === value ? 'active' : ''}
                      onClick={() => onConditionChange(tool.id, value)}
                    >
                      <Icon size={16} /> {label}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="operation-review-delivery-status"><Check size={15} /> Preparada para entregar</span>
              )}

              {toolAccessories.length > 0 && (
                <section className="operation-accessory-checklist">
                  <header><PackageCheck size={17} /><strong>Accesorios</strong><small>{toolAccessories.length}</small></header>
                  {toolAccessories.map((accessory) => {
                    const accessoryCondition = accessoryChecks[tool.id]?.[accessory.id] ?? 'not_checked';
                    return (
                      <div key={accessory.id} className={`operation-accessory-row accessory-${accessoryCondition}`}>
                        <span>
                          <strong>{accessory.name}</strong>
                          <small>{accessory.required ? 'Obligatorio' : 'Opcional'}</small>
                        </span>
                        <div>
                          {accessoryConditionOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              disabled={saving}
                              className={accessoryCondition === option.value ? 'active' : ''}
                              onClick={() => onAccessoryConditionChange(tool.id, accessory.id, option.value)}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}
            </article>
          );
        })}
      </div>

      {(requiredUnchecked.length > 0 || deliveryAccessoryProblems.length > 0) && (
        <div className="operation-review-blocker" role="alert">
          <AlertTriangle size={18} />
          <span>
            <strong>Falta completar el checklist</strong>
            <small>
              {mode === 'delivery'
                ? 'Todos los accesorios obligatorios deben figurar como correctos antes de prestar.'
                : 'Comprueba todos los accesorios obligatorios antes de devolver.'}
            </small>
          </span>
        </div>
      )}

      <label className="operation-review-notes">
        <span>{requiresNotes ? 'Observaciones obligatorias' : 'Observaciones opcionales'}</span>
        <textarea
          value={notes}
          disabled={saving}
          onChange={(event) => onNotesChange(event.target.value)}
          rows={3}
          placeholder="Accesorios, estado, ubicación de trabajo o incidencia…"
        />
      </label>

      <article className="operation-review-summary">
        <div>
          <small>Resumen</small>
          <strong>{tools.length} herramienta{tools.length === 1 ? '' : 's'}</strong>
        </div>
        <div>
          <small>Accesorios</small>
          <strong>{selectedAccessories.length}</strong>
        </div>
        {mode === 'return' && (
          <div>
            <small>Incidencias</small>
            <strong>{incidentCount}</strong>
          </div>
        )}
        <span title={operationId}>{operationId}</span>
      </article>

      <footer className="native-scan-footer operation-review-footer">
        <span>{saving ? 'Guardando operación…' : 'Todo listo para guardar'}</span>
        <button type="button" disabled={!canConfirm} onClick={onConfirm}>
          {saving ? <LoaderCircle className="boot-spin" size={19} /> : <Check size={19} />}
          {saving
            ? 'Guardando…'
            : `${mode === 'delivery' ? 'Prestar' : 'Devolver'} ${tools.length} herramienta${tools.length === 1 ? '' : 's'}`}
        </button>
      </footer>
    </section>
  );
}
