# ISIVOLT Station Service

Servicio local para convertir un mini PC Ubuntu en punto físico de préstamo y devolución.

## Funciones

- Genera una clave privada ECDSA P-256 la primera vez.
- Conserva la clave privada únicamente en el mini PC con permisos restrictivos.
- Publica la clave pública JWK que se configura en el frontend.
- Muestra un QR a pantalla completa que cambia periódicamente.
- Firma cada token con SHA-256.
- Comprueba estación, caducidad y duración máxima.
- Canjea cada nonce una sola vez, ligado a un `operationId`.
- Registra aceptaciones, repeticiones y usos por otra operación en un archivo JSONL.
- Puede funcionar por HTTP para mostrar el QR local o por HTTPS para el canje reforzado desde GitHub Pages.

## Requisitos

- Ubuntu o distribución Linux equivalente.
- Node.js 22 o posterior.
- Pantalla conectada al mini PC para mostrar el QR.
- Reloj del sistema sincronizado.

## Prueba manual

```bash
cd station-service
npm install
cp .env.example .env
set -a
. ./.env
set +a
npm start
```

Abre en la pantalla del mini PC:

```text
http://localhost:8787/
```

La primera ejecución crea:

```text
data/keys/station-private.pem
data/keys/station-public.jwk.json
data/redemptions.jsonl
```

No copies `station-private.pem` fuera del equipo ni lo añadas a Git.

## Configurar la aplicación web

Copia el contenido de `station-public.jwk.json` en una sola línea:

```env
VITE_ISIVOLT_STATION_MODE=signed-qr
VITE_ISIVOLT_STATION_ID=ALMACEN-PRINCIPAL
VITE_ISIVOLT_STATION_PUBLIC_KEY_JWK={"kty":"EC","crv":"P-256","x":"...","y":"...","key_ops":["verify"],"ext":true}
```

Con esta configuración la firma y caducidad se validan en el móvil aunque el mini PC no sea accesible mediante API.

## Canje único reforzado

Para impedir que una fotografía reciente del QR se use en dos operaciones, configura una URL HTTPS accesible desde los móviles:

```env
VITE_ISIVOLT_STATION_REDEEM_URL=https://almacen-pts.example.local:8787/api/redeem
```

Y en el mini PC:

```env
STATION_ALLOWED_ORIGINS=https://izc05.github.io
STATION_TLS_CERT=/ruta/certificado.pem
STATION_TLS_KEY=/ruta/clave.pem
```

El certificado debe ser reconocido por los teléfonos. Una web servida por HTTPS no debe llamar a una dirección HTTP de la red local. Para el piloto hay tres opciones:

1. Usar un nombre interno con certificado reconocido por los dispositivos.
2. Servir la aplicación y `/api/redeem` desde el mismo origen HTTPS del mini PC.
3. Mantener temporalmente solo la comprobación criptográfica offline y activar el canje cuando exista HTTPS.

## Red local del almacén

La red Wi‑Fi limita la proximidad, pero no sustituye la firma ni el canje. El diseño recomendado es:

- punto de acceso o red exclusiva del almacén;
- mini PC conectado por cable cuando sea posible;
- pantalla fija con el QR rotatorio;
- contraseña Wi‑Fi separada de las credenciales de la aplicación;
- firewall permitiendo únicamente el puerto del servicio desde la red de almacén;
- acceso administrativo al mini PC mediante una red de gestión distinta.

No es necesario que los usuarios conozcan la contraseña del mini PC.

## Endpoints

- `GET /` — pantalla completa del punto.
- `GET /health` — estado básico.
- `GET /public-key.json` — clave pública.
- `GET /api/token` — token firmado actual.
- `GET /qr.svg` — QR actual.
- `POST /api/redeem` — consumo único del nonce.

Ejemplo de canje:

```json
{
  "token": "ISIVOLT:STATION:...",
  "operationId": "op-..."
}
```

## Auditoría

Cada línea de `redemptions.jsonl` es un objeto independiente. Se registran:

- fecha;
- estación;
- nonce;
- operación;
- IP del dispositivo;
- agente de usuario;
- resultado: `accepted`, `already-redeemed`, `nonce-reused`, `expired`, etc.

El archivo no contiene la clave privada ni el PIN local de ningún usuario.

## systemd

La unidad de ejemplo presupone:

```text
/opt/isivolt/station-service
/etc/isivolt-station.env
/var/lib/isivolt-station
```

Ajusta en `/etc/isivolt-station.env`:

```env
STATION_ID=ALMACEN-PRINCIPAL
STATION_HOST=0.0.0.0
STATION_PORT=8787
STATION_KEY_DIRECTORY=/var/lib/isivolt-station/keys
STATION_AUDIT_PATH=/var/lib/isivolt-station/redemptions.jsonl
STATION_ALLOWED_ORIGINS=https://izc05.github.io
```

Después:

```bash
sudo cp isivolt-station.service.example /etc/systemd/system/isivolt-station.service
sudo systemctl daemon-reload
sudo systemctl enable --now isivolt-station
sudo systemctl status isivolt-station
```

## Pruebas

```bash
npm test
```

Las pruebas generan claves temporales, verifican firma/manipulación/caducidad y arrancan un servidor en un puerto aleatorio para comprobar QR, CORS, canje único y auditoría.
