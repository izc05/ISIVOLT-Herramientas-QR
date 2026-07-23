# ISIVOLT Herramientas QR

Aplicación web y Android para el control de préstamos, devoluciones, técnicos, inventario, mantenimiento y trazabilidad de herramientas.

## Candidata actual

- Aplicación: `1.0.0-rc.30`.
- SQLite normalizado Android: versión 6.
- Rama consolidada: `agent/rc24-storage-safety`.
- Rama de publicación web: `agent/rc31-web-preview`.
- PR de consolidación: #42.

El nombre histórico de la rama RC24 se conserva para no romper el PR abierto, pero la candidata funcional actual es RC30.

## Prioridad actual: modo web

Durante esta fase se pausa la generación habitual de APK y se valida la aplicación mediante GitHub Pages.

Dirección prevista:

`https://izc05.github.io/ISIVOLT-Herramientas-QR/`

En navegador se mantienen inventario, técnicos, préstamos, devoluciones, incidencias, OT, ubicación, vencimientos, accesorios, historial, alertas y exportaciones compatibles con web.

Hasta activar la sincronización central, cada navegador guarda una copia independiente en `localStorage`. La interfaz muestra el distintivo **Modo web RC30** para evitar confundir esta persistencia con una base compartida.

## Operaciones consolidadas

- Préstamo y devolución mediante QR, código de barras, NFC o búsqueda manual según la plataforma.
- Recorrido **Primero técnico** o **Primero herramienta**.
- Revisión final del lote antes de guardar.
- Condición individual por herramienta en devoluciones múltiples.
- OT, ubicación de trabajo y fecha prevista de devolución.
- Checklist de accesorios por herramienta.
- Observación obligatoria para revisión, avería o accesorio con incidencia.
- Bloqueo de doble pulsación y estado visible `Guardando…`.
- `operationId` persistido para impedir duplicados.
- Cola secuencial de escrituras SQLite en Android.
- Recuperación de escrituras pendientes conservando `deviceId`, `syncStatus` y `operationId`.

## Tarjetas corporativas

La aplicación admite códigos lineales, incluido CODE 39, como alternativa cuando el NFC no funciona.

- Asociación desde **Herramientas > Tarjetas**.
- Lectura por cámara nativa o entrada manual.
- Un código solo puede pertenecer a un técnico.
- El valor se guarda en la ficha, SQLite y copia JSON.
- Las tarjetas registradas identifican automáticamente al técnico durante préstamo o devolución.

El lector mediante cámara del navegador se incorporará como bloque web independiente. Mientras tanto, permanece disponible la entrada manual.

## Desarrollo

```bash
npm install
npm test
python3 scripts/validate_sqlite_schema.py
npm run build
```

## Publicación web

El workflow `.github/workflows/deploy-pages.yml` valida la aplicación, genera `dist` y lo publica mediante GitHub Pages desde `agent/rc31-web-preview`.

## Android en pausa

La configuración Android, SQLite nativo, NFC, impresión nativa y los workflows históricos de APK se conservan en el repositorio, pero no forman parte del flujo principal de la rama web. Podrán ejecutarse manualmente cuando vuelva a ser necesario validar una instalación Android.

## Documentación

- `docs/WEB_MODE.md`: publicación web, persistencia y limitaciones actuales.
- `docs/USER_MANUAL.md`: manual de uso.
- `docs/RC29_PARITY.md`: matriz de recuperación respecto a la APK instalada.
- `docs/PRODUCTION.md`: preparación y checklist de producción.
- `docs/RECOVERY.md`: persistencia y recuperación de datos.
- `docs/ROADMAP.md`: planificación restante.

## Ruta de producto

1. Publicar y validar RC30 en GitHub Pages.
2. Adaptar el escáner a la cámara del navegador.
3. Incorporar servidor y sincronización central.
4. Añadir autenticación y permisos por técnico.
5. Crear panel central de coordinación e inventario.
6. Recuperar la APK cuando la versión web multiusuario sea estable.
