import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Barcode,
  Camera,
  Check,
  Keyboard,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import type { AppData, Technician } from '../../domain/types';
import { assertPermission } from '../../security/permissions';
import {
  assignTechnicianBarcode,
  barcodeForTechnician,
  loadTechnicianBarcodeRegistry,
  removeTechnicianBarcode,
  type TechnicianBarcodeRegistry,
} from '../../services/barcodeRegistry';
import {
  requestManualRawBarcodeValue,
  scanRawBarcode,
} from '../../services/barcodeScanner';
import { loadAppData } from '../../services/storage';

type Feedback = {
  tone: 'success' | 'warning' | 'error';
  title: string;
  detail: string;
} | null;

const matchesTechnician = (technician: Technician, query: string) => {
  const needle = query.trim().toLocaleLowerCase('es-ES');
  if (!needle) return true;
  return [
    technician.name,
    technician.code,
    technician.specialty,
    technician.role ?? '',
  ].some((value) => value.toLocaleLowerCase('es-ES').includes(needle));
};

export default function TechnicianBarcodeCenter() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [registry, setRegistry] = useState<TechnicianBarcodeRegistry>({});
  const [query, setQuery] = useState('');
  const [busyTechnicianId, setBusyTechnicianId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const filteredTechnicians = useMemo(
    () => data.technicians
      .filter((technician) => matchesTechnician(technician, query))
      .sort((a, b) => {
        const activeDifference = Number(b.active) - Number(a.active);
        if (activeDifference !== 0) return activeDifference;
        return a.name.localeCompare(b.name, 'es');
      }),
    [data.technicians, query],
  );

  const assignedCount = useMemo(
    () => data.technicians.filter((technician) => barcodeForTechnician(registry, technician.id)).length,
    [data.technicians, registry],
  );

  const loadRegistry = async () => {
    setData(loadAppData());
    setRegistry(await loadTechnicianBarcodeRegistry());
  };

  const openCenter = async () => {
    try {
      assertPermission('technicians.manage');
      setFeedback(null);
      await loadRegistry();
      setOpen(true);
    } catch (cause) {
      setFeedback({
        tone: 'error',
        title: 'Acceso no permitido',
        detail: cause instanceof Error ? cause.message : 'No tienes permiso para asociar tarjetas.',
      });
    }
  };

  useEffect(() => {
    if (!feedback || open) return undefined;
    const timeout = window.setTimeout(() => setFeedback(null), 4_000);
    return () => window.clearTimeout(timeout);
  }, [feedback, open]);

  const saveBarcode = async (technician: Technician, rawValue: string) => {
    setBusyTechnicianId(technician.id);
    setFeedback(null);
    try {
      const next = await assignTechnicianBarcode(data, technician.id, rawValue);
      const code = barcodeForTechnician(next, technician.id) ?? rawValue;
      setRegistry(next);
      setFeedback({
        tone: 'success',
        title: 'Tarjeta vinculada',
        detail: `${technician.name} podrá identificarse con el código ${code}.`,
      });
      navigator.vibrate?.([60, 35, 90]);
    } catch (cause) {
      setFeedback({
        tone: 'error',
        title: 'No se ha podido vincular',
        detail: cause instanceof Error ? cause.message : 'Revisa la tarjeta y vuelve a intentarlo.',
      });
      navigator.vibrate?.([140, 60, 140]);
    } finally {
      setBusyTechnicianId(null);
    }
  };

  const scanCard = async (technician: Technician) => {
    if (busyTechnicianId) return;
    setBusyTechnicianId(technician.id);
    setFeedback({
      tone: 'warning',
      title: 'Leyendo tarjeta',
      detail: 'Centra el código de barras horizontal dentro de la cámara.',
    });

    const result = await scanRawBarcode();
    setBusyTechnicianId(null);
    if (result.status === 'cancelled') {
      setFeedback({ tone: 'warning', title: 'Lectura cancelada', detail: 'No se ha modificado ninguna asociación.' });
      return;
    }
    if (result.status !== 'success') {
      setFeedback({ tone: 'error', title: 'No se ha leído la tarjeta', detail: result.message });
      return;
    }

    await saveBarcode(technician, result.value);
  };

  const enterCardManually = async (technician: Technician) => {
    const result = requestManualRawBarcodeValue(
      `Introduce el número impreso bajo el código de barras de ${technician.name}.`,
    );
    if (result.status !== 'success') return;
    await saveBarcode(technician, result.value);
  };

  const removeCard = async (technician: Technician) => {
    if (busyTechnicianId) return;
    setBusyTechnicianId(technician.id);
    try {
      const next = await removeTechnicianBarcode(technician.id);
      setRegistry(next);
      setFeedback({
        tone: 'success',
        title: 'Tarjeta desvinculada',
        detail: `${technician.name} deja de identificarse mediante código de barras.`,
      });
    } catch (cause) {
      setFeedback({
        tone: 'error',
        title: 'No se ha podido desvincular',
        detail: cause instanceof Error ? cause.message : 'Vuelve a intentarlo.',
      });
    } finally {
      setBusyTechnicianId(null);
    }
  };

  return (
    <>
      <button
        className="technician-barcode-launcher"
        type="button"
        onClick={() => { void openCenter(); }}
        aria-label="Gestionar tarjetas de técnicos"
      >
        <Barcode size={20} />
        <span>Tarjetas</span>
        {assignedCount > 0 && <b>{assignedCount}</b>}
      </button>

      {open && (
        <div className="technician-barcode-backdrop" onClick={() => setOpen(false)}>
          <section
            className="technician-barcode-center"
            role="dialog"
            aria-modal="true"
            aria-label="Tarjetas de técnicos"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span><Barcode size={25} /></span>
                <div>
                  <small>Identificación alternativa al NFC</small>
                  <h2>Tarjetas del hospital</h2>
                  <p>Compatible con CODE 39, CODE 128, EAN y QR.</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={21} /></button>
            </header>

            <label className="technician-barcode-search">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar técnico, código o especialidad…"
              />
            </label>

            <div className="technician-barcode-summary">
              <span><strong>{assignedCount}</strong> tarjetas vinculadas</span>
              <span><strong>{data.technicians.length}</strong> técnicos registrados</span>
            </div>

            {feedback && (
              <div className={`technician-barcode-feedback feedback-${feedback.tone}`}>
                {feedback.tone === 'success' ? <Check size={19} /> : <AlertTriangle size={19} />}
                <span><strong>{feedback.title}</strong><small>{feedback.detail}</small></span>
              </div>
            )}

            <div className="technician-barcode-list">
              {filteredTechnicians.map((technician) => {
                const barcode = barcodeForTechnician(registry, technician.id);
                const busy = busyTechnicianId === technician.id;
                return (
                  <article key={technician.id} className={!technician.active ? 'inactive' : ''}>
                    <span className="technician-barcode-avatar"><UserRound size={20} /></span>
                    <div className="technician-barcode-copy">
                      <strong>{technician.name}</strong>
                      <small>{technician.code} · {technician.specialty}</small>
                      <em>{barcode ? `Tarjeta: ${barcode}` : 'Sin tarjeta vinculada'}</em>
                    </div>
                    <div className="technician-barcode-actions">
                      <button type="button" disabled={Boolean(busyTechnicianId)} onClick={() => { void scanCard(technician); }}>
                        <Camera size={16} /> {busy ? 'Leyendo…' : barcode ? 'Cambiar' : 'Escanear'}
                      </button>
                      <button type="button" disabled={Boolean(busyTechnicianId)} onClick={() => { void enterCardManually(technician); }}>
                        <Keyboard size={16} /> Manual
                      </button>
                      {barcode && (
                        <button className="danger" type="button" disabled={Boolean(busyTechnicianId)} onClick={() => { void removeCard(technician); }} aria-label={`Desvincular tarjeta de ${technician.name}`}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}

              {filteredTechnicians.length === 0 && (
                <div className="technician-barcode-empty">
                  <UserRound size={30} />
                  <strong>No hay técnicos con ese filtro</strong>
                </div>
              )}
            </div>

            <footer>
              <p>La tarjeta mostrada en la foto se lee como <strong>CODE 39 · 52502</strong>.</p>
              <button type="button" onClick={() => setOpen(false)}>Terminar</button>
            </footer>
          </section>
        </div>
      )}

      {!open && feedback && (
        <aside className={`technician-barcode-toast feedback-${feedback.tone}`}>
          {feedback.tone === 'success' ? <Check size={19} /> : <AlertTriangle size={19} />}
          <span><strong>{feedback.title}</strong><small>{feedback.detail}</small></span>
        </aside>
      )}
    </>
  );
}
