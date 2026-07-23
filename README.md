# ISIVOLT Herramientas QR

Aplicación web para el control de préstamos, devoluciones, técnicos, inventario, mantenimiento y trazabilidad de herramientas. La configuración Android se conserva, pero el desarrollo principal es actualmente **web-first** mediante GitHub Pages.

## Candidata actual

- Aplicación: `1.0.0-rc.30`.
- Modo principal: web RC30.
- Rama de publicación: `agent/rc31-web-preview`.
- PR web: #44.
- Dirección: `https://izc05.github.io/ISIVOLT-Herramientas-QR/`.
- Base consolidada RC30: `agent/rc24-storage-safety`, PR #42.

## Funciones web actuales

- Inventario y fichas de herramientas.
- Técnicos y tarjetas corporativas asociadas.
- Préstamo y devolución mediante QR, código de barras o búsqueda manual.
- Escaneo desde cámara web con preferencia por la cámara trasera.
- Recorrido **Primero técnico** o **Primero herramienta**.
- Revisión final del lote antes de guardar.
- Condición individual por herramienta en devoluciones múltiples.
- OT, ubicación de trabajo y fecha prevista de devolución.
- Checklist de accesorios por herramienta.
- Observación obligatoria para revisión, avería o accesorio con incidencia.
- `operationId` persistido para impedir duplicados.
- Historial avanzado, alertas y auditoría CSV.
- Copias JSON y exportaciones compatibles con navegador.

## Cámara web

El visor web:

- Se activa únicamente por acción expresa del usuario.
- Explica el uso de la cámara antes de solicitar permiso.
- Procesa la imagen dentro del dispositivo, sin grabar ni subir vídeo.
- Usa `BarcodeDetector` cuando está disponible.
- Utiliza ZXing como alternativa para QR y códigos lineales.
- Detiene el stream al detectar, cancelar, cerrar o abandonar la página.
- Mantiene siempre la selección manual como respaldo.

Formatos prioritarios: QR, CODE 39, CODE 93, CODE 128, Codabar, EAN, ITF, UPC, Data Matrix, PDF417 y Aztec.

## Persistencia web actual

Hasta incorporar el servidor central, la información se guarda en `localStorage`.

- Cada navegador mantiene una copia independiente.
- Todavía no existe sincronización entre técnicos o dispositivos.
- Borrar los datos del navegador puede eliminar la copia local.
- Durante el piloto deben generarse copias JSON periódicas.

## Desarrollo

```bash
npm install
npm test
npm run build
```

## GitHub Pages

El workflow `.github/workflows/deploy-pages.yml` valida y publica automáticamente cada actualización de `agent/rc31-web-preview`.

La validación incluye:

- Pruebas de dominio y regresión.
- Pruebas del lector web.
- TypeScript y Vite.
- Generación y publicación de `dist`.

## Android en pausa

Se conservan SQLite nativo, NFC, ML Kit, impresión Android, configuración Capacitor y workflows históricos. No forman parte del flujo principal durante la fase web multiusuario.

## Documentación

- `docs/WEB_MODE.md`: funcionamiento y publicación web.
- `docs/USER_MANUAL.md`: manual de uso.
- `docs/RC29_PARITY.md`: matriz de recuperación respecto a RC29.
- `docs/RECOVERY.md`: persistencia y recuperación.
- `docs/ROADMAP.md`: planificación restante.

## Próximos bloques

1. Validación física del escáner web en Android Chrome.
2. Limpieza de workflows heredados.
3. Base de datos central y cola de sincronización.
4. Autenticación y permisos por técnico.
5. Panel central de coordinación.
