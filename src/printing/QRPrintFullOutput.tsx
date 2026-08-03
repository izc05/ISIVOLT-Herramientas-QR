import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getPhotoUrl } from '../photos/photoStore';
import { loadData } from '../storage';
import type { PhotoReference, Technician, Tool } from '../types';

type LabelSize = '20' | '25' | '30' | '40' | 'technician-card';
type PrintMode = 'tools' | 'technicians';
type PrintTemplate = 'a4' | 'thermal';

type PrintPreferences = {
  mode: PrintMode;
  size: LabelSize;
  template: PrintTemplate;
  copies: number;
  showLogo: boolean;
  showName: boolean;
  showCategory: boolean;
  showLocation: boolean;
  showSerial: boolean;
  showPhoto: boolean;
};

type OutputState = {
  preferences: PrintPreferences;
  tools: Tool[];
  technicians: Technician[];
};

const PREFERENCES_KEY = 'isivoltpro:qr-print-preferences:v1';
const DEFAULT_PREFERENCES: PrintPreferences = {
  mode: 'tools',
  size: '30',
  template: 'a4',
  copies: 1,
  showLogo: true,
  showName: true,
  showCategory: false,
  showLocation: false,
  showSerial: false,
  showPhoto: true,
};

function toolPayload(tool: Tool) {
  return tool.qrPayload ?? `ISIVOLTPRO:TOOL:${tool.code}`;
}

function technicianPayload(technician: Technician) {
  return technician.qrPayload ?? `ISIVOLTPRO:TECH:${technician.code}`;
}

function PrimaryPhoto({ photos, enabled }: { photos?: PhotoReference[]; enabled: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const primary = photos?.find((photo) => photo.primary) ?? photos?.[0];

  useEffect(() => {
    let active = true;
    let currentUrl: string | null = null;
    if (!enabled || !primary) {
      setUrl(null);
      return;
    }
    void getPhotoUrl(primary).then((next) => {
      if (!active) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      currentUrl = next;
      setUrl(next);
    });
    return () => {
      active = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [enabled, primary?.id]);

  if (!enabled) return null;
  return url
    ? <img className="qr-print-photo" src={url} alt="" />
    : <span className="qr-print-photo placeholder"><UserRound size={25} /></span>;
}

function parsePreferences(): PrintPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? 'null') as Partial<PrintPreferences> | null;
    return { ...DEFAULT_PREFERENCES, ...(value ?? {}) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export default function QRPrintFullOutput() {
  const [output, setOutput] = useState<OutputState | null>(null);

  useEffect(() => {
    const originalPrint = window.print.bind(window);
    const interceptedPrint = () => {
      if (document.body.dataset.qrPrintDesigner !== 'active') {
        originalPrint();
        return;
      }

      const preferences = parsePreferences();
      const codes = [...document.querySelectorAll('.qr-print-list > button.selected strong')]
        .map((node) => node.textContent?.split(' · ')[0]?.trim())
        .filter((code): code is string => Boolean(code));
      const selectedCodes = new Set(codes);
      const data = loadData();
      const copies = Math.min(10, Math.max(1, preferences.copies || 1));
      const tools = Array.from({ length: copies }, () => data.tools.filter((tool) => selectedCodes.has(tool.code))).flat();
      const technicians = Array.from({ length: copies }, () => data.technicians.filter((technician) => selectedCodes.has(technician.code))).flat();

      setOutput({ preferences, tools, technicians });
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        window.setTimeout(originalPrint, preferences.showPhoto ? 260 : 40);
      }));
      window.setTimeout(() => setOutput(null), 3000);
    };

    window.print = interceptedPrint;
    return () => { window.print = originalPrint; };
  }, []);

  if (!output) return null;
  const { preferences } = output;

  return createPortal(
    <div className={`qr-print-full-output qr-print-sheet mode-${preferences.mode} size-${preferences.size} template-${preferences.template}`}>
      {preferences.mode === 'tools' ? output.tools.map((tool, index) => (
        <article className="qr-print-label tool-label" key={`${tool.id}-${index}`}>
          {preferences.showLogo && <div className="qr-print-brand"><b>ϟ</b><span>IsiVoltPro</span></div>}
          <QRCodeSVG value={toolPayload(tool)} level="H" includeMargin={false} />
          <strong>{tool.code}</strong>
          {preferences.showName && <p>{tool.name}</p>}
          {preferences.showCategory && <small>{tool.category}</small>}
          {preferences.showLocation && <small>{tool.location}</small>}
          {preferences.showSerial && tool.serialNumber && <small>S/N {tool.serialNumber}</small>}
        </article>
      )) : output.technicians.map((technician, index) => (
        <article className="qr-print-label technician-label" key={`${technician.id}-${index}`}>
          {preferences.showLogo && <div className="qr-print-brand"><b>ϟ</b><span>IsiVoltPro</span></div>}
          <PrimaryPhoto photos={technician.photos} enabled={preferences.showPhoto && preferences.size === 'technician-card'} />
          <QRCodeSVG value={technicianPayload(technician)} level="H" includeMargin={false} />
          <div className="qr-print-person"><strong>{technician.name}</strong><p>{technician.code}</p>{preferences.showCategory && <small>{technician.category}</small>}</div>
        </article>
      ))}
    </div>,
    document.body,
  );
}
