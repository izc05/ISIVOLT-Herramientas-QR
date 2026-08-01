# Punto de entrega físico con mini PC

## Objetivo

Impedir que un préstamo o una devolución se confirme desde cualquier lugar solo por disponer de usuario y contraseña.

La aplicación puede consultarse fuera del almacén, pero la acción final **Prestar/Devolver** puede exigir una prueba de presencia emitida por el punto físico autorizado.

## Por qué la Wi‑Fi no basta por sí sola

Conectarse a una red cercana es una señal útil, pero un navegador no permite leer el SSID de forma fiable. Además, una contraseña puede compartirse, un teléfono puede permanecer conectado desde una zona próxima y una red puede ampliarse accidentalmente.

La Wi‑Fi del mini PC se usa como perímetro local, pero la autorización se basa en un segundo factor físico y temporal.

## Diseño implementado

1. El mini PC crea o utiliza una red Wi‑Fi exclusiva del almacén.
2. Una pantalla conectada al mini PC muestra un QR que cambia cada 30–45 segundos.
3. El QR contiene:
   - versión del protocolo;
   - identificador del punto;
   - nonce aleatorio;
   - fecha de emisión;
   - fecha de caducidad.
4. El mini PC firma el contenido con una clave privada ECDSA P‑256 que nunca sale del equipo.
5. La aplicación contiene únicamente la clave pública.
6. Antes de confirmar una operación, el técnico escanea el QR.
7. La aplicación comprueba firma, punto autorizado, caducidad y duración máxima.
8. El pase queda ligado al `operationId` preparado.
9. `saveAppData` consume la prueba y la adjunta al movimiento; saltarse el botón no evita la validación central.
10. En modo reforzado, el mini PC canjea el nonce una sola vez y rechaza su reutilización.

Formato:

```text
ISIVOLT:STATION:<payload-base64url>.<firma-base64url>
```

La firma se calcula sobre el segmento exacto `<payload-base64url>` usando ECDSA P‑256 y SHA‑256.

## Dos niveles de protección

### Firma local sin conexión

La aplicación verifica criptográficamente el QR en el propio móvil. Permite trabajar aunque el mini PC no exponga una API HTTPS accesible.

Protege frente a:

- QR inventados;
- contenido manipulado;
- códigos de otro almacén;
- códigos caducados;
- duración excesiva;
- introducción manual.

Una fotografía reciente podría compartirse durante sus pocos segundos de vigencia, por lo que este nivel es adecuado para piloto controlado, pero no representa la protección máxima.

### Canje único reforzado

Cuando se configura `VITE_ISIVOLT_STATION_REDEEM_URL`, después de verificar la firma el móvil consulta al mini PC. El servidor:

- comprueba nuevamente firma, estación y caducidad;
- relaciona el nonce con un `operationId`;
- acepta el primer canje;
- rechaza un segundo intento para la misma operación;
- rechaza que otra operación use ese nonce;
- registra IP, agente de usuario, hora y resultado en auditoría JSONL.

La URL debe usar HTTPS. Una aplicación cargada desde GitHub Pages no puede llamar de forma segura a una dirección HTTP de la red local debido al bloqueo de contenido mixto del navegador.

## Evidencia registrada

Cada movimiento físico puede conservar:

- `stationId`;
- `stationNonce`;
- `stationVerifiedAt`.

La evidencia se guarda en la copia local, cola offline y base central. PostgreSQL mantiene una tabla `station_redemptions` y evita que el mismo nonce quede asociado a otra operación.

La migración central conserva la evidencia y bloquea reutilizaciones, pero la comprobación criptográfica completa sigue realizándose en el móvil y en el servicio del mini PC. Para que PostgreSQL sea por sí solo la autoridad criptográfica será necesario interponer una Edge Function o API firmada antes de la RPC.

## Servicio del mini PC

El módulo está en:

```text
station-service/
```

Incluye:

- generación y persistencia de claves P‑256;
- pantalla completa con QR rotatorio;
- `GET /health`;
- `GET /public-key.json`;
- `GET /api/token`;
- `GET /qr.svg`;
- `POST /api/redeem`;
- CORS limitado a orígenes autorizados;
- soporte HTTP para la pantalla local y HTTPS para el canje web;
- auditoría JSONL;
- unidad systemd endurecida;
- pruebas de servidor en puerto aleatorio.

La guía completa de instalación está en `station-service/README.md`.

## Configuración del frontend

Modo firmado local:

```env
VITE_ISIVOLT_STATION_MODE=signed-qr
VITE_ISIVOLT_STATION_ID=ALMACEN-PRINCIPAL
VITE_ISIVOLT_STATION_PUBLIC_KEY_JWK={"kty":"EC","crv":"P-256","x":"...","y":"..."}
VITE_ISIVOLT_STATION_CLOCK_SKEW_SECONDS=10
VITE_ISIVOLT_STATION_MAX_TOKEN_SECONDS=90
```

Modo reforzado:

```env
VITE_ISIVOLT_STATION_REDEEM_URL=https://almacen-pts.example.local:8787/api/redeem
```

Si el modo `signed-qr` está solicitado pero falta la clave, el identificador o la URL reforzada no es segura, la aplicación bloquea la confirmación. No degrada silenciosamente a modo desprotegido.

## Alternativas y refuerzos

### Aprobación por responsable

La operación puede quedar pendiente hasta que el responsable confirme en la pantalla del mini PC. Es el control humano más claro cuando siempre hay personal en el almacén.

### Terminal fijo

Todas las operaciones se terminan en un dispositivo anclado al almacén con lector QR USB o cámara. Los móviles quedan para consulta e identificación. Es la solución más simple y fuerte si no se necesita retirar material sin responsable presente.

### NFC fijo

Un contenido NDEF estático puede copiarse. Solo debe utilizarse combinado con un reto cambiante o validación del servidor.

### Bluetooth de proximidad

Aporta proximidad, pero Web Bluetooth no está disponible de forma uniforme y requiere permisos frecuentes. No se recomienda como única prueba.

### Geolocalización

No ofrece precisión suficiente dentro de edificios y puede falsearse. Solo sirve como dato de auditoría auxiliar.

## Estado RC39

Completado:

- modal de herramienta centrado en escritorio;
- verificación ECDSA P‑256 en navegador;
- caducidad, punto y duración máxima;
- barrera previa a la confirmación y refuerzo en almacenamiento;
- prueba presencial adjunta al movimiento;
- servicio generador del mini PC;
- QR rotatorio a pantalla completa;
- canje único del nonce;
- auditoría local;
- migración para evidencia central;
- suite independiente del mini PC validada.

Pendiente:

- instalar el servicio en el mini PC real;
- definir el punto de acceso o red del almacén;
- disponer de HTTPS reconocido por los móviles para el canje reforzado;
- validar cámara y QR físicamente en Android Chrome;
- ejecutar las migraciones RC37–RC39 en una rama Supabase QA aislada;
- probar dos técnicos y dos dispositivos concurrentes;
- decidir si se añade aprobación humana desde el puesto fijo.
