import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { ensureStationKeyPair } from './token.mjs';
import { StationRedemptionStore, StationTokenIssuer } from './station.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceRoot = path.resolve(__dirname, '..');

const positiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const splitOrigins = (value = '') => new Set(
  String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

export const loadStationConfig = (environment = process.env) => ({
  stationId: String(environment.STATION_ID ?? 'ALMACEN-PRINCIPAL').trim(),
  host: String(environment.STATION_HOST ?? '0.0.0.0').trim(),
  port: positiveInteger(environment.STATION_PORT, 8787),
  ttlSeconds: positiveInteger(environment.STATION_TOKEN_SECONDS, 45),
  rotationSeconds: positiveInteger(environment.STATION_ROTATION_SECONDS, 30),
  clockSkewSeconds: positiveInteger(environment.STATION_CLOCK_SKEW_SECONDS, 10),
  maxLifetimeSeconds: positiveInteger(environment.STATION_MAX_TOKEN_SECONDS, 90),
  keyDirectory: path.resolve(environment.STATION_KEY_DIRECTORY ?? path.join(serviceRoot, 'data', 'keys')),
  auditPath: path.resolve(environment.STATION_AUDIT_PATH ?? path.join(serviceRoot, 'data', 'redemptions.jsonl')),
  allowedOrigins: splitOrigins(environment.STATION_ALLOWED_ORIGINS),
  tlsCertificate: environment.STATION_TLS_CERT ? path.resolve(environment.STATION_TLS_CERT) : undefined,
  tlsPrivateKey: environment.STATION_TLS_KEY ? path.resolve(environment.STATION_TLS_KEY) : undefined,
});

const json = (response, status, body, headers = {}) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  response.end(JSON.stringify(body));
};

const text = (response, status, body, contentType, headers = {}) => {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    ...headers,
  });
  response.end(body);
};

const readJsonBody = async (request, maximumBytes = 32_768) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) throw new Error('request-too-large');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const dashboard = (stationId) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>ISIVOLT · ${escapeHtml(stationId)}</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #f8fbff; background: #020814; }
    * { box-sizing: border-box; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; background: radial-gradient(circle at 50% 5%, #12375a 0, #061326 38%, #020814 76%); }
    main { width: min(980px, 100%); display: grid; grid-template-columns: minmax(340px, .9fr) minmax(300px, 1.1fr); gap: 32px; align-items: center; }
    .qr { display: grid; place-items: center; padding: 24px; border: 1px solid #2bb9df55; border-radius: 34px; background: #fff; box-shadow: 0 28px 90px #0009, 0 0 60px #20d9ff22; }
    .qr img { width: min(58vh, 100%); aspect-ratio: 1; display: block; }
    .copy { display: grid; gap: 18px; }
    .badge { width: fit-content; padding: 8px 12px; border: 1px solid #46e8ff44; border-radius: 999px; color: #65e9ff; font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(38px, 6vw, 72px); line-height: .98; letter-spacing: -.055em; }
    p { margin: 0; color: #a8b9cf; font-size: clamp(18px, 2.3vw, 24px); line-height: 1.45; }
    .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .fact { padding: 18px; border: 1px solid #8adcf322; border-radius: 18px; background: #08172bcc; }
    .fact small { display: block; margin-bottom: 8px; color: #7890aa; text-transform: uppercase; letter-spacing: .09em; }
    .fact strong { font-size: 24px; }
    .progress { height: 8px; overflow: hidden; border-radius: 999px; background: #17314d; }
    .progress span { display: block; height: 100%; width: 100%; transform-origin: left; background: linear-gradient(90deg, #23d2ff, #7258ff); }
    .status { color: #6ee7a2; font-weight: 800; }
    @media (max-width: 800px) { body { padding: 16px; } main { grid-template-columns: 1fr; } .qr img { width: min(72vw, 520px); } .copy { text-align: center; justify-items: center; } .facts { width: 100%; } }
  </style>
</head>
<body>
  <main>
    <section class="qr"><img id="qr" alt="QR rotatorio del punto de entrega"></section>
    <section class="copy">
      <span class="badge">Punto de entrega protegido</span>
      <h1>${escapeHtml(stationId)}</h1>
      <p>Escanea este código desde la revisión final de la operación. Cambia automáticamente y solo puede canjearse una vez.</p>
      <div class="facts">
        <div class="fact"><small>Caduca en</small><strong id="countdown">—</strong></div>
        <div class="fact"><small>Servicio</small><strong class="status">Activo</strong></div>
      </div>
      <div class="progress"><span id="progress"></span></div>
    </section>
  </main>
  <script>
    let expiresAt = 0;
    let issuedAt = 0;
    let nonce = '';
    async function refreshToken() {
      const response = await fetch('./api/token', { cache: 'no-store' });
      const data = await response.json();
      expiresAt = Date.parse(data.payload.expiresAt);
      issuedAt = Date.parse(data.payload.issuedAt);
      if (data.payload.nonce !== nonce) {
        nonce = data.payload.nonce;
        document.getElementById('qr').src = './qr.svg?nonce=' + encodeURIComponent(nonce);
      }
    }
    function tick() {
      const now = Date.now();
      const remaining = Math.max(0, expiresAt - now);
      const total = Math.max(1, expiresAt - issuedAt);
      document.getElementById('countdown').textContent = Math.ceil(remaining / 1000) + ' s';
      document.getElementById('progress').style.transform = 'scaleX(' + Math.max(0, Math.min(1, remaining / total)) + ')';
      if (remaining < 8000) refreshToken().catch(() => undefined);
    }
    refreshToken().catch(() => undefined);
    setInterval(tick, 250);
    setInterval(() => refreshToken().catch(() => undefined), 5000);
  </script>
</body>
</html>`;

const corsHeaders = (request, allowedOrigins) => {
  const origin = request.headers.origin;
  if (!origin || !allowedOrigins.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
};

export const createStationRequestHandler = ({
  config,
  issuer,
  redemptionStore,
  publicJwk,
}) => async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const cors = corsHeaders(request, config.allowedOrigins);

  try {
    if (request.method === 'OPTIONS') {
      if (request.headers.origin && !config.allowedOrigins.has(request.headers.origin)) {
        return json(response, 403, { error: 'origin-not-allowed' });
      }
      response.writeHead(204, cors);
      return response.end();
    }

    if (request.method === 'GET' && url.pathname === '/') {
      return text(response, 200, dashboard(config.stationId), 'text/html; charset=utf-8');
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json(response, 200, {
        ok: true,
        stationId: config.stationId,
        serverTime: new Date().toISOString(),
        secureTransport: Boolean(config.tlsCertificate && config.tlsPrivateKey),
      }, cors);
    }

    if (request.method === 'GET' && url.pathname === '/public-key.json') {
      return json(response, 200, publicJwk, cors);
    }

    if (request.method === 'GET' && url.pathname === '/api/token') {
      const current = issuer.issue();
      return json(response, 200, {
        stationId: config.stationId,
        token: current.token,
        payload: current.payload,
        rotationSeconds: current.rotationSeconds,
        serverTime: current.serverTime,
      }, cors);
    }

    if (request.method === 'GET' && url.pathname === '/qr.svg') {
      const current = issuer.issue();
      const svg = await QRCode.toString(current.token, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 720,
        color: { dark: '#020814', light: '#ffffff' },
      });
      return text(response, 200, svg, 'image/svg+xml; charset=utf-8', cors);
    }

    if (request.method === 'POST' && url.pathname === '/api/redeem') {
      const origin = request.headers.origin;
      if (origin && !config.allowedOrigins.has(origin)) {
        return json(response, 403, { accepted: false, code: 'origin-not-allowed' });
      }
      const body = await readJsonBody(request);
      const result = await redemptionStore.redeem({
        token: body.token,
        operationId: body.operationId,
        clientIp: request.socket.remoteAddress ?? null,
        userAgent: request.headers['user-agent'] ?? null,
      });
      const status = result.accepted ? 200 : result.code === 'already-redeemed' || result.code === 'nonce-reused' ? 409 : 400;
      return json(response, status, result, cors);
    }

    return json(response, 404, { error: 'not-found' }, cors);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'station-error';
    const status = message === 'request-too-large' ? 413 : message.includes('JSON') ? 400 : 500;
    return json(response, status, { error: message }, cors);
  }
};

export const createConfiguredStationServer = async (environment = process.env) => {
  const config = loadStationConfig(environment);
  const keys = await ensureStationKeyPair(config.keyDirectory);
  const issuer = new StationTokenIssuer({
    stationId: config.stationId,
    privateKey: keys.privateKey,
    ttlSeconds: config.ttlSeconds,
    rotationSeconds: config.rotationSeconds,
  });
  const redemptionStore = new StationRedemptionStore({
    stationId: config.stationId,
    publicKey: keys.publicKey,
    auditPath: config.auditPath,
    clockSkewSeconds: config.clockSkewSeconds,
    maxLifetimeSeconds: config.maxLifetimeSeconds,
  });
  const handler = createStationRequestHandler({
    config,
    issuer,
    redemptionStore,
    publicJwk: keys.publicJwk,
  });

  if (config.tlsCertificate || config.tlsPrivateKey) {
    if (!config.tlsCertificate || !config.tlsPrivateKey) {
      throw new Error('STATION_TLS_CERT y STATION_TLS_KEY deben configurarse juntos.');
    }
    const [cert, key] = await Promise.all([
      readFile(config.tlsCertificate),
      readFile(config.tlsPrivateKey),
    ]);
    return { server: createHttpsServer({ cert, key }, handler), config, keys, protocol: 'https' };
  }

  return { server: createHttpServer(handler), config, keys, protocol: 'http' };
};

export const startStationServer = async (environment = process.env) => {
  const runtime = await createConfiguredStationServer(environment);
  await new Promise((resolve, reject) => {
    runtime.server.once('error', reject);
    runtime.server.listen(runtime.config.port, runtime.config.host, resolve);
  });
  const address = runtime.server.address();
  const port = typeof address === 'object' && address ? address.port : runtime.config.port;
  console.log(`ISIVOLT Station ${runtime.config.stationId} activa en ${runtime.protocol}://${runtime.config.host}:${port}`);
  console.log(`Clave pública: ${runtime.keys.publicJwkPath}`);
  console.log(`Auditoría: ${runtime.config.auditPath}`);
  if (runtime.protocol === 'http') {
    console.warn('Aviso: el canje remoto desde GitHub Pages requiere HTTPS. El QR firmado local sí puede mostrarse por HTTP en el mini PC.');
  }
  return runtime;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startStationServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
