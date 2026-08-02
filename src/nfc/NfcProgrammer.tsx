import { useMemo, useState } from 'react';
import { CheckCircle2, Clipboard, Link2, Nfc, Radio, ShieldAlert, Unlink2 } from 'lucide-react';
import type { AppData } from '../types';

type NdefRecord = { data?: DataView; encoding?: string };
type NdefReadingEvent = { serialNumber?: string; message?: { records?: NdefRecord[] } };
type NdefReaderInstance = {
  scan(): Promise<void>;
  write(message: unknown): Promise<void>;
  onreading: ((event: NdefReadingEvent) => void) | null;
  onreadingerror: (() => void) | null;
};
type NdefReaderConstructor = new () => NdefReaderInstance;

type NfcProgrammerProps = {
  data: AppData;
  entityType: 'tool' | 'technician';
  entityId: string;
  label: string;
  payload: string;
  linkedValue?: string;
  onLinked(value?: string): void;
  onMessage(message: string): void;
};

const decodeRecord = (record?: NdefRecord): string => {
  if (!record?.data) return '';
  const bytes = new Uint8Array(record.data.buffer, record.data.byteOffset, record.data.byteLength);
  return new TextDecoder(record.encoding || 'utf-8').decode(bytes).replace(/^\u0002[a-z]{2}/i, '').trim();
};

export default function NfcProgrammer({
  data,
  entityType,
  entityId,
  label,
  payload,
  linkedValue,
  onLinked,
  onMessage,
}: NfcProgrammerProps) {
  const [reading, setReading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [lastRead, setLastRead] = useState('');
  const [verified, setVerified] = useState(false);

  const compatible = typeof window !== 'undefined'
    && window.isSecureContext
    && Boolean((window as unknown as { NDEFReader?: NdefReaderConstructor }).NDEFReader);

  const detectedOwner = useMemo(() => {
    if (!lastRead) return null;
    const tool = data.tools.find((item) => item.id !== entityId && (item.nfcTag === lastRead || item.qrPayload === lastRead));
    if (tool) return { type: 'Herramienta', label: `${tool.code} · ${tool.name}` };
    const technician = data.technicians.find((item) => item.id !== entityId && (item.nfcTag === lastRead || item.qrPayload === lastRead || `ISIVOLTPRO:TECH:${item.code}` === lastRead));
    if (technician) return { type: 'Técnico', label: `${technician.code} · ${technician.name}` };
    return null;
  }, [data.technicians, data.tools, entityId, lastRead]);

  const readTag = async (verifyExpected = false) => {
    const Reader = (window as unknown as { NDEFReader?: NdefReaderConstructor }).NDEFReader;
    if (!Reader || !window.isSecureContext) {
      onMessage('Web NFC requiere Chrome en Android y una conexión HTTPS.');
      return;
    }
    setReading(true);
    setVerified(false);
    onMessage('Acerca la etiqueta NFC al teléfono para leerla.');
    try {
      const reader = new Reader();
      reader.onreading = (event) => {
        const value = decodeRecord(event.message?.records?.[0]) || event.serialNumber || '';
        setLastRead(value);
        const matches = value === payload;
        setVerified(matches);
        setReading(false);
        onMessage(matches
          ? `Etiqueta NFC verificada para ${label}.`
          : verifyExpected
            ? 'La etiqueta leída no contiene el identificador esperado.'
            : value ? `Etiqueta leída: ${value}` : 'La etiqueta no contiene un identificador reconocible.');
      };
      reader.onreadingerror = () => {
        setReading(false);
        onMessage('No se ha podido leer la etiqueta NFC.');
      };
      await reader.scan();
    } catch {
      setReading(false);
      onMessage('No se pudo iniciar la lectura NFC. Revisa permisos y compatibilidad.');
    }
  };

  const writeTag = async () => {
    const Reader = (window as unknown as { NDEFReader?: NdefReaderConstructor }).NDEFReader;
    if (!Reader || !window.isSecureContext) {
      onMessage('Web NFC requiere Chrome en Android y una conexión HTTPS.');
      return;
    }
    if (detectedOwner) {
      onMessage(`La etiqueta leída ya pertenece a ${detectedOwner.type.toLowerCase()} ${detectedOwner.label}. Lee otra etiqueta antes de sobrescribir.`);
      return;
    }
    setWriting(true);
    setVerified(false);
    onMessage(`Acerca la etiqueta para programarla como ${label}.`);
    try {
      const reader = new Reader();
      await reader.write({ records: [{ recordType: 'text', data: payload, lang: 'es' }] });
      onLinked(payload);
      setLastRead(payload);
      setWriting(false);
      onMessage('NFC escrito correctamente. Pulsa Verificar y vuelve a acercar la etiqueta.');
    } catch {
      setWriting(false);
      onMessage('No se pudo escribir la etiqueta. Comprueba que sea NDEF y no esté bloqueada.');
    }
  };

  const copyPayload = async () => {
    await navigator.clipboard.writeText(payload);
    onMessage('Identificador NFC copiado.');
  };

  return (
    <section className="nfc-programmer">
      <header>
        <span><Nfc size={24} /></span>
        <div><small>IDENTIFICACIÓN NFC</small><strong>Programar etiqueta</strong><p>{compatible ? 'Compatible en este dispositivo.' : 'Necesita Chrome Android y HTTPS.'}</p></div>
        <em className={linkedValue ? 'linked' : ''}>{linkedValue ? 'VINCULADA' : 'PENDIENTE'}</em>
      </header>

      <div className="nfc-payload"><code>{payload}</code><button type="button" onClick={() => void copyPayload()} aria-label="Copiar identificador"><Clipboard size={17} /></button></div>

      {lastRead && <div className={`nfc-read-result${verified ? ' verified' : detectedOwner ? ' conflict' : ''}`}>
        {verified ? <CheckCircle2 size={20} /> : detectedOwner ? <ShieldAlert size={20} /> : <Radio size={20} />}
        <div><small>ÚLTIMA LECTURA</small><strong>{lastRead}</strong>{detectedOwner && <p>Ya asociada a {detectedOwner.type.toLowerCase()} {detectedOwner.label}.</p>}</div>
      </div>}

      <div className="nfc-actions">
        <button type="button" disabled={!compatible || reading || writing} onClick={() => void readTag(false)}><Radio size={18} /> {reading ? 'Acerca la etiqueta…' : 'Leer etiqueta'}</button>
        <button className="primary" type="button" disabled={!compatible || reading || writing || Boolean(detectedOwner)} onClick={() => void writeTag()}><Link2 size={18} /> {writing ? 'Acerca la etiqueta…' : 'Programar NFC'}</button>
        <button type="button" disabled={!compatible || reading || writing} onClick={() => void readTag(true)}><CheckCircle2 size={18} /> Verificar</button>
        {linkedValue && <button className="danger" type="button" onClick={() => { onLinked(undefined); setVerified(false); onMessage('Asociación NFC eliminada de la ficha. La etiqueta física conserva su contenido hasta sobrescribirla.'); }}><Unlink2 size={18} /> Desvincular ficha</button>}
      </div>

      <p className="nfc-note">La web escribe un mensaje NDEF con el identificador estable de IsiVoltPro. No convierte el propio teléfono en una tarjeta NFC.</p>
    </section>
  );
}
