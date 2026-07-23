export type WebBarcodeScanResult =
  | { status: 'success'; value: string; format?: string }
  | { status: 'completed' }
  | { status: 'manual-requested' }
  | { status: 'cancelled' }
  | { status: 'permission-denied'; message: string }
  | { status: 'unsupported'; message: string }
  | { status: 'error'; message: string };

export type WebBarcodeDetectionDecision = {
  action?: 'continue' | 'finish';
  title?: string;
  message?: string;
  tone?: 'success' | 'warning' | 'error';
};

export type WebBarcodeScannerOptions = {
  title?: string;
  instruction?: string;
  manualLabel?: string;
  autoStart?: boolean;
  continuous?: boolean;
  duplicateCooldownMs?: number;
  onDetected?: (
    value: string,
    format?: string,
  ) => WebBarcodeDetectionDecision | Promise<WebBarcodeDetectionDecision>;
};

type BrowserBarcode = {
  rawValue?: string;
  format?: string;
};

type BrowserBarcodeDetector = {
  detect(source: HTMLVideoElement): Promise<BrowserBarcode[]>;
};

type BrowserBarcodeDetectorConstructor = {
  new(options?: { formats?: string[] }): BrowserBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

type ScannerControls = {
  stop: () => void;
};

type ScannerUi = {
  backdrop: HTMLDivElement;
  heading: HTMLHeadingElement;
  description: HTMLParagraphElement;
  video: HTMLVideoElement;
  status: HTMLParagraphElement;
  startButton: HTMLButtonElement;
  manualButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
};

export const WEB_BARCODE_FORMATS = [
  'qr_code',
  'code_39',
  'code_93',
  'code_128',
  'codabar',
  'ean_8',
  'ean_13',
  'itf',
  'upc_a',
  'upc_e',
  'data_matrix',
  'pdf417',
  'aztec',
] as const;

const getBarcodeDetector = (): BrowserBarcodeDetectorConstructor | undefined => {
  const scope = globalThis as typeof globalThis & {
    BarcodeDetector?: BrowserBarcodeDetectorConstructor;
  };
  return scope.BarcodeDetector;
};

export const isWebBarcodeScannerSupported = (): boolean =>
  typeof window !== 'undefined'
  && window.isSecureContext
  && typeof navigator !== 'undefined'
  && Boolean(navigator.mediaDevices?.getUserMedia);

export const classifyWebCameraError = (error: unknown): WebBarcodeScanResult => {
  const candidate = error as { name?: string; message?: string } | null;
  const name = candidate?.name ?? '';

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return {
      status: 'permission-denied',
      message: 'El navegador no tiene permiso para usar la cámara. Autorízala desde el candado de la barra de direcciones.',
    };
  }

  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return {
      status: 'unsupported',
      message: 'No se ha encontrado una cámara compatible. Utiliza la búsqueda manual o conecta una webcam.',
    };
  }

  if (name === 'AbortError') return { status: 'cancelled' };

  if (name === 'NotReadableError') {
    return {
      status: 'error',
      message: 'La cámara está siendo utilizada por otra aplicación o no puede iniciarse en este momento.',
    };
  }

  return {
    status: 'error',
    message: candidate?.message
      ? `No se ha podido iniciar el lector: ${candidate.message}`
      : 'No se ha podido iniciar el lector web.',
  };
};

export const isRepeatedWebDetection = (
  value: string,
  previousValue: string,
  previousAt: number,
  now: number,
  cooldownMs = 1_600,
): boolean => value === previousValue && now - previousAt < cooldownMs;

const createScannerUi = (options: WebBarcodeScannerOptions): ScannerUi => {
  const backdrop = document.createElement('div');
  backdrop.className = 'web-barcode-backdrop';
  backdrop.innerHTML = `
    <section class="web-barcode-panel" role="dialog" aria-modal="true" aria-label="Escáner web de códigos">
      <header>
        <span class="web-barcode-kicker">Escaneo rápido · cámara local</span>
        <h2></h2>
        <p></p>
      </header>
      <div class="web-barcode-preview">
        <video playsinline muted aria-label="Vista previa de la cámara"></video>
        <span class="web-barcode-frame" aria-hidden="true"></span>
        <span class="web-barcode-sweep" aria-hidden="true"></span>
      </div>
      <p class="web-barcode-status" role="status">Abriendo cámara trasera…</p>
      <footer>
        <button class="web-barcode-manual" type="button"></button>
        <button class="web-barcode-cancel" type="button">Cerrar cámara</button>
        <button class="web-barcode-start" type="button">Abrir cámara</button>
      </footer>
    </section>
  `;

  const heading = backdrop.querySelector('h2');
  const description = backdrop.querySelector('header p');
  const video = backdrop.querySelector('video');
  const status = backdrop.querySelector('.web-barcode-status');
  const startButton = backdrop.querySelector('.web-barcode-start');
  const manualButton = backdrop.querySelector('.web-barcode-manual');
  const cancelButton = backdrop.querySelector('.web-barcode-cancel');

  if (!(heading instanceof HTMLHeadingElement)
    || !(description instanceof HTMLParagraphElement)
    || !(video instanceof HTMLVideoElement)
    || !(status instanceof HTMLParagraphElement)
    || !(startButton instanceof HTMLButtonElement)
    || !(manualButton instanceof HTMLButtonElement)
    || !(cancelButton instanceof HTMLButtonElement)) {
    throw new Error('No se ha podido construir el visor de cámara.');
  }

  heading.textContent = options.title ?? 'Primero técnico, después herramientas';
  description.textContent = options.instruction
    ?? 'La cámara permanece abierta para añadir varias herramientas. La imagen se procesa únicamente en este dispositivo.';
  manualButton.textContent = options.manualLabel ?? 'Selección manual';

  document.body.appendChild(backdrop);
  return {
    backdrop,
    heading,
    description,
    video,
    status,
    startButton,
    manualButton,
    cancelButton,
  };
};

const getCameraConstraints = (): MediaStreamConstraints => ({
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 60 },
  },
});

const selectSupportedFormats = async (
  Detector: BrowserBarcodeDetectorConstructor,
): Promise<string[]> => {
  if (!Detector.getSupportedFormats) return [...WEB_BARCODE_FORMATS];
  const supported = await Detector.getSupportedFormats();
  return WEB_BARCODE_FORMATS.filter((format) => supported.includes(format));
};

const pulseDetection = (
  ui: ScannerUi,
  tone: WebBarcodeDetectionDecision['tone'] = 'success',
) => {
  ui.backdrop.classList.remove('scan-success', 'scan-warning', 'scan-error');
  ui.backdrop.classList.add(`scan-${tone}`);
  window.setTimeout(() => {
    ui.backdrop.classList.remove('scan-success', 'scan-warning', 'scan-error');
  }, 520);

  if (tone === 'success') navigator.vibrate?.([45, 20, 70]);
  else if (tone === 'warning') navigator.vibrate?.([90, 35, 90]);
  else navigator.vibrate?.([150, 55, 150]);
};

export const scanBarcodeWithWebCamera = async (
  options: WebBarcodeScannerOptions = {},
): Promise<WebBarcodeScanResult> => {
  if (!isWebBarcodeScannerSupported()) {
    return {
      status: 'unsupported',
      message: 'Este navegador no permite abrir la cámara de forma segura. Utiliza la selección manual.',
    };
  }

  let ui: ScannerUi;
  try {
    ui = createScannerUi(options);
  } catch (error) {
    return classifyWebCameraError(error);
  }

  return new Promise<WebBarcodeScanResult>((resolve) => {
    let settled = false;
    let starting = false;
    let stream: MediaStream | null = null;
    let controls: ScannerControls | null = null;
    let animationFrame: number | null = null;
    let detectorBusy = false;
    let processingDetection = false;
    let lastValue = '';
    let lastDetectedAt = 0;

    const stopResources = () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
      try {
        controls?.stop();
      } catch {
        // El stream se detiene igualmente en el bloque siguiente.
      }
      controls = null;
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      ui.video.pause();
      ui.video.srcObject = null;
    };

    const cleanup = () => {
      stopResources();
      window.removeEventListener('pagehide', cancelScan);
      window.removeEventListener('keydown', handleKeyDown);
      ui.backdrop.remove();
    };

    const finish = (result: WebBarcodeScanResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const cancelScan = () => finish(options.continuous ? { status: 'completed' } : { status: 'cancelled' });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelScan();
    };

    const deliverDetection = async (value: string, format?: string) => {
      const normalized = value.trim();
      if (!normalized || settled || processingDetection) return;

      const now = Date.now();
      if (isRepeatedWebDetection(
        normalized,
        lastValue,
        lastDetectedAt,
        now,
        options.duplicateCooldownMs,
      )) return;

      lastValue = normalized;
      lastDetectedAt = now;
      processingDetection = true;

      try {
        if (!options.onDetected) {
          finish({ status: 'success', value: normalized, format });
          return;
        }

        const decision = await options.onDetected(normalized, format);
        if (decision.title) ui.heading.textContent = decision.title;
        if (decision.message) ui.status.textContent = decision.message;
        pulseDetection(ui, decision.tone);

        if (decision.action === 'finish' || options.continuous === false) {
          finish({ status: 'success', value: normalized, format });
          return;
        }

        window.setTimeout(() => {
          processingDetection = false;
        }, 420);
      } catch (error) {
        ui.status.textContent = error instanceof Error
          ? error.message
          : 'No se ha podido procesar el código leído.';
        pulseDetection(ui, 'error');
        window.setTimeout(() => {
          processingDetection = false;
        }, 620);
      }
    };

    const startNativeDetection = async (): Promise<boolean> => {
      const Detector = getBarcodeDetector();
      if (!Detector) return false;

      try {
        const formats = await selectSupportedFormats(Detector);
        if (formats.length === 0) return false;
        const detector = new Detector({ formats });

        const detectFrame = async () => {
          if (settled) return;
          animationFrame = window.requestAnimationFrame(() => { void detectFrame(); });
          if (detectorBusy || processingDetection || ui.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

          detectorBusy = true;
          try {
            const barcodes = await detector.detect(ui.video);
            const detected = barcodes.find((barcode) => barcode.rawValue?.trim());
            if (detected?.rawValue) {
              await deliverDetection(detected.rawValue, detected.format);
            }
          } catch {
            // Los fallos de una imagen concreta se ignoran y se continúa leyendo.
          } finally {
            detectorBusy = false;
          }
        };

        ui.status.textContent = 'Cámara activa. Identifica al técnico y continúa con las herramientas.';
        animationFrame = window.requestAnimationFrame(() => { void detectFrame(); });
        return true;
      } catch {
        return false;
      }
    };

    const startZxingDetection = async () => {
      ui.status.textContent = 'Preparando lector compatible para QR y códigos lineales…';
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      controls = await reader.decodeFromStream(stream as MediaStream, ui.video, (result, error, scanControls) => {
        if (scanControls) controls = scanControls;
        if (!result || processingDetection) {
          void error;
          return;
        }
        void deliverDetection(result.getText(), String(result.getBarcodeFormat()));
      });
      ui.status.textContent = 'Cámara activa. Acerca el código al marco sin mantenerlo fijo después de leerlo.';
    };

    const startCamera = async () => {
      if (starting || settled) return;
      starting = true;
      ui.startButton.disabled = true;
      ui.startButton.textContent = 'Abriendo…';
      ui.status.textContent = 'Solicitando permiso y preparando la cámara trasera…';

      try {
        stream = await navigator.mediaDevices.getUserMedia(getCameraConstraints());
        ui.video.srcObject = stream;
        await ui.video.play();
        ui.backdrop.classList.add('camera-active');
        ui.startButton.hidden = true;
        ui.backdrop.classList.add('auto-started');

        const nativeStarted = await startNativeDetection();
        if (!nativeStarted) await startZxingDetection();
      } catch (error) {
        finish(classifyWebCameraError(error));
      }
    };

    ui.startButton.addEventListener('click', () => { void startCamera(); });
    ui.manualButton.addEventListener('click', () => finish({ status: 'manual-requested' }));
    ui.cancelButton.addEventListener('click', cancelScan);
    ui.backdrop.addEventListener('click', (event) => {
      if (event.target === ui.backdrop) cancelScan();
    });
    window.addEventListener('pagehide', cancelScan);
    window.addEventListener('keydown', handleKeyDown);

    if (options.autoStart !== false) {
      window.setTimeout(() => { void startCamera(); }, 0);
    } else {
      window.setTimeout(() => ui.startButton.focus(), 0);
    }
  });
};
