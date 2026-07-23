export type WebBarcodeScanResult =
  | { status: 'success'; value: string; format?: string }
  | { status: 'cancelled' }
  | { status: 'permission-denied'; message: string }
  | { status: 'unsupported'; message: string }
  | { status: 'error'; message: string };

type BrowserBarcode = { rawValue?: string; format?: string };
type BrowserBarcodeDetector = { detect(source: HTMLVideoElement): Promise<BrowserBarcode[]> };
type BrowserBarcodeDetectorConstructor = {
  new(options?: { formats?: string[] }): BrowserBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};
type ScannerControls = { stop: () => void };
type ScannerUi = {
  backdrop: HTMLDivElement;
  video: HTMLVideoElement;
  status: HTMLParagraphElement;
  cancelButton: HTMLButtonElement;
  manualButton: HTMLButtonElement;
};

export const WEB_BARCODE_FORMATS = [
  'qr_code', 'code_39', 'code_93', 'code_128', 'codabar', 'ean_8', 'ean_13',
  'itf', 'upc_a', 'upc_e', 'data_matrix', 'pdf417', 'aztec',
] as const;

const getBarcodeDetector = (): BrowserBarcodeDetectorConstructor | undefined => {
  const scope = globalThis as typeof globalThis & { BarcodeDetector?: BrowserBarcodeDetectorConstructor };
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
    return { status: 'permission-denied', message: 'La cámara está bloqueada. Autorízala desde el candado del navegador o utiliza la búsqueda manual.' };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return { status: 'unsupported', message: 'No se ha encontrado una cámara compatible. Utiliza la búsqueda manual.' };
  }
  if (name === 'AbortError') return { status: 'cancelled' };
  if (name === 'NotReadableError') {
    return { status: 'error', message: 'La cámara está ocupada por otra aplicación. Ciérrala o utiliza la búsqueda manual.' };
  }
  return {
    status: 'error',
    message: candidate?.message
      ? `No se ha podido iniciar el lector: ${candidate.message}`
      : 'No se ha podido iniciar el lector web.',
  };
};

const createScannerUi = (): ScannerUi => {
  const backdrop = document.createElement('div');
  backdrop.className = 'web-barcode-backdrop';
  backdrop.innerHTML = `
    <section class="web-barcode-panel" role="dialog" aria-modal="true" aria-label="Escáner web de códigos">
      <header>
        <span class="web-barcode-kicker">Lectura rápida</span>
        <h2>Apunta al código</h2>
        <p>La cámara se abre directamente y la imagen se procesa solo en este dispositivo.</p>
      </header>
      <div class="web-barcode-preview">
        <video playsinline muted aria-label="Vista previa de la cámara"></video>
        <span class="web-barcode-frame" aria-hidden="true"></span>
        <span class="web-barcode-sweep" aria-hidden="true"></span>
      </div>
      <p class="web-barcode-status" role="status">Abriendo cámara trasera y preparando enfoque…</p>
      <footer>
        <button class="web-barcode-cancel" type="button">Cancelar</button>
        <button class="web-barcode-manual" type="button">Buscar manualmente</button>
      </footer>
    </section>`;

  const video = backdrop.querySelector('video');
  const status = backdrop.querySelector('.web-barcode-status');
  const cancelButton = backdrop.querySelector('.web-barcode-cancel');
  const manualButton = backdrop.querySelector('.web-barcode-manual');
  if (!(video instanceof HTMLVideoElement)
    || !(status instanceof HTMLParagraphElement)
    || !(cancelButton instanceof HTMLButtonElement)
    || !(manualButton instanceof HTMLButtonElement)) {
    throw new Error('No se ha podido construir el visor de cámara.');
  }
  document.body.appendChild(backdrop);
  return { backdrop, video, status, cancelButton, manualButton };
};

const getCameraConstraints = (): MediaStreamConstraints => ({
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
});

const selectSupportedFormats = async (Detector: BrowserBarcodeDetectorConstructor): Promise<string[]> => {
  if (!Detector.getSupportedFormats) return [...WEB_BARCODE_FORMATS];
  const supported = await Detector.getSupportedFormats();
  return WEB_BARCODE_FORMATS.filter((format) => supported.includes(format));
};

export const scanBarcodeWithWebCamera = async (): Promise<WebBarcodeScanResult> => {
  if (!isWebBarcodeScannerSupported()) {
    return { status: 'unsupported', message: 'Este navegador no permite abrir la cámara. Utiliza la selección manual.' };
  }

  let ui: ScannerUi;
  try {
    ui = createScannerUi();
  } catch (error) {
    return classifyWebCameraError(error);
  }

  return new Promise<WebBarcodeScanResult>((resolve) => {
    let settled = false;
    let stream: MediaStream | null = null;
    let controls: ScannerControls | null = null;
    let animationFrame: number | null = null;
    let detectorBusy = false;

    const stopResources = () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
      try { controls?.stop(); } catch { /* El stream se detiene igualmente. */ }
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
      if (result.status === 'success') navigator.vibrate?.([45, 20, 70]);
      resolve(result);
    };

    const cancelScan = () => finish({ status: 'cancelled' });
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') cancelScan(); };

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
          if (detectorBusy || ui.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
          detectorBusy = true;
          try {
            const barcodes = await detector.detect(ui.video);
            const detected = barcodes.find((barcode) => barcode.rawValue?.trim());
            if (detected?.rawValue) {
              finish({ status: 'success', value: detected.rawValue.trim(), format: detected.format });
            }
          } catch { /* Ignora fotogramas sin lectura. */ }
          finally { detectorBusy = false; }
        };
        ui.status.textContent = 'Cámara lista. Acerca el código al marco; no hace falta pulsar nada más.';
        animationFrame = window.requestAnimationFrame(() => { void detectFrame(); });
        return true;
      } catch {
        return false;
      }
    };

    const startZxingDetection = async () => {
      ui.status.textContent = 'Preparando lector compatible…';
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      controls = await reader.decodeFromStream(stream as MediaStream, ui.video, (result, error, scanControls) => {
        if (scanControls) controls = scanControls;
        if (!result) { void error; return; }
        finish({ status: 'success', value: result.getText().trim(), format: String(result.getBarcodeFormat()) });
      });
      ui.status.textContent = 'Cámara lista. Acerca el código al marco.';
    };

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia(getCameraConstraints());
        ui.video.srcObject = stream;
        await ui.video.play();
        ui.backdrop.classList.add('camera-active');
        const nativeStarted = await startNativeDetection();
        if (!nativeStarted) await startZxingDetection();
      } catch (error) {
        finish(classifyWebCameraError(error));
      }
    };

    ui.cancelButton.addEventListener('click', cancelScan);
    ui.manualButton.addEventListener('click', cancelScan);
    ui.backdrop.addEventListener('click', (event) => { if (event.target === ui.backdrop) cancelScan(); });
    window.addEventListener('pagehide', cancelScan);
    window.addEventListener('keydown', handleKeyDown);

    // handleScan nace de una pulsación del usuario, por lo que abrimos la cámara sin un segundo toque.
    void startCamera();
  });
};
