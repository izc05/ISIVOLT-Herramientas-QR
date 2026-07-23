# Punto de entrega físico con mini PC

## Objetivo

Impedir que un préstamo o una devolución se confirme desde cualquier lugar solo por disponer de usuario y contraseña.

La aplicación puede consultarse fuera del almacén, pero la acción final **Prestar/Devolver** puede exigir una prueba de presencia emitida por el punto físico autorizado.

## Por qué la Wi‑Fi no basta por sí sola

Conectarse a una red cercana es una señal útil, pero un navegador no permite leer el SSID de forma fiable. Además, una contraseña puede compartirse, un teléfono puede permanecer conectado desde una zona próxima y una red puede ampliarse accidentalmente.

La Wi‑Fi del mini PC se usa como perímetro local, pero la autorización se basa en un segundo factor físico y temporal.

## Diseño recomendado

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
8. El pase se consume para una única confirmación preparada.

Formato:

```text
ISIVOLT:STATION:<payload-base64url>.<firma-base64url>
```

La firma se calcula sobre el segmento exacto `<payload-base64url>` usando ECDSA P‑256 y SHA‑256.

## Nivel reforzado

Para impedir también una fotografía compartida durante los pocos segundos de vigencia, el servicio del mini PC debe registrar cada nonce y permitir su consumo una sola vez.

Opciones:

- **Aprobación del puesto fijo:** el técnico prepara la operación y el mini PC muestra una solicitud que debe aprobarse.
- **Canje central:** una Edge Function valida firma, estación, nonce y operación, y marca el nonce como consumido antes de ejecutar la RPC PostgreSQL.
- **Servidor local como autoridad:** el mini PC sirve la aplicación y la API operacional mediante HTTPS dentro de la red local.

El nivel recomendado para el piloto es QR rotatorio más aprobación opcional. Para producción multiusuario, añadir canje único en servidor.

## Alternativas

### Tablet o terminal fijo

Es la solución más simple y fuerte: todas las operaciones se terminan en un dispositivo anclado al almacén, usando lector QR USB o cámara. Los móviles quedan para consulta e identificación.

### NFC fijo

Puede usarse como apoyo, pero un contenido NDEF estático puede copiarse. Debe combinarse con un reto cambiante o validación del servidor.

### Bluetooth de proximidad

Aporta proximidad, pero Web Bluetooth no está disponible de forma uniforme y requiere permisos frecuentes. No se recomienda como única prueba.

### Geolocalización

No ofrece precisión suficiente dentro de edificios y puede falsearse. Solo sirve como dato de auditoría auxiliar.

### Confirmación por responsable de almacén

Es el control humano más claro. La operación queda pendiente hasta que el responsable confirma en el mini PC. Es adecuado cuando siempre hay personal en el punto de entrega.

## Configuración del frontend

```env
VITE_ISIVOLT_STATION_MODE=signed-qr
VITE_ISIVOLT_STATION_ID=ALMACEN-PRINCIPAL
VITE_ISIVOLT_STATION_PUBLIC_KEY_JWK={"kty":"EC","crv":"P-256","x":"...","y":"..."}
VITE_ISIVOLT_STATION_CLOCK_SKEW_SECONDS=10
VITE_ISIVOLT_STATION_MAX_TOKEN_SECONDS=90
```

Si el modo `signed-qr` está solicitado pero falta la clave o el identificador, la aplicación bloquea la confirmación y muestra el error de configuración. No degrada silenciosamente a modo desprotegido.

## Estado RC38

- Modal de herramienta centrado en escritorio.
- Verificación ECDSA P‑256 en navegador.
- Caducidad, punto y duración máxima comprobados.
- Introducción manual no admitida.
- Barrera previa a la confirmación final.
- Pase consumido una sola vez en la interfaz.
- Servicio generador del mini PC y canje único en servidor pendientes del bloque de infraestructura.
