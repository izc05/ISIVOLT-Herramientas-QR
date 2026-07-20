import {
  AlertTriangle,
  ArrowLeft,
  Check,
  LoaderCircle,
  RotateCcw,
  UserRound,
  Wrench,
} from 'lucide-react';
import type {
  OperationMode,
  ReturnCondition,
  Technician,
  Tool,
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

type Props = {
  mode: OperationMode;
  operationId: string;
  technician: Technician | null;
  tools: Tool[];
  returnConditions: Record<string, ReturnCondition>;
  notes: string;
  saving: boolean;
  onConditionChange: (toolId: string, condition: ReturnCondition) => void;
  onNotesChange: (notes: string) => void;
  onBack: () => void;
  onConfirm: () => void;
};

export default function OperationReviewPanel({
  mode,
  operationId,
  technician,
  tools,
  returnConditions,
  notes,
  saving,
  onConditionChange,
  onNotesChange,
  onBack,
  onConfirm,
}: Props) {
  const incidentCount = mode === 'return'
    ? tools.filter((tool) => (returnConditions[tool.id] ?? 'ok') !== 'ok').length
    : 0;
  const requiresNotes = incidentCount > 0;
  const canConfirm = tools.length > 0
    && (mode === 'return' || Boolean(technician))
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

      <div className="operation-review-tools">
        {tools.map((tool) => {
          const condition = returnConditions[tool.id] ?? 'ok';
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
            </article>
          );
        })}
      </div>

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
