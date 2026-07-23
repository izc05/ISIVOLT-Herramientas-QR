# ISIVOLT Herramientas QR

Aplicación Android y web para el control local de préstamos, devoluciones, técnicos, inventario, mantenimiento y trazabilidad de herramientas.

## Candidata actual

- Aplicación: `1.0.0-rc.30`.
- SQLite normalizado: versión 6.
- Rama de trabajo: `agent/rc24-storage-safety`.
- PR de consolidación: #42, mantenida en borrador hasta completar las pruebas físicas.

El nombre histórico de la rama se conserva para no romper el PR abierto, pero la única candidata que representa actualmente es RC30.

## Operaciones consolidadas

- Préstamo y devolución mediante QR, código de barras, NFC o búsqueda manual.
- Recorrido **Primero técnico** o **Primero herramienta**.
- Revisión final del lote antes de guardar.
- Condición individual por herramienta en devoluciones múltiples.
- OT, ubicación de trabajo y fecha prevista de devolución.
- Checklist de accesorios por herramienta.
- Observación obligatoria para revisión, avería o accesorio con incidencia.
- Bloqueo de doble pulsación y estado visible `Guardando…`.
- `operationId` persistido para impedir duplicados incluso después de reiniciar.
- Cola secuencial de escrituras SQLite.
- Recuperación de escrituras pendientes conservando `deviceId`, `syncStatus` y `operationId` ya confirmados por SQLite.

## Tarjetas corporativas

La aplicación admite códigos lineales, incluido CODE 39, como alternativa cuando el NFC no funciona.

- Asociación desde **Herramientas > Tarjetas**.
- Lectura por cámara o entrada manual.
- Un código solo puede pertenecer a un técnico.
- El valor se guarda en la ficha, SQLite v5 y copia JSON.
- Las tarjetas registradas identifican automáticamente al técnico durante préstamo o devolución.

## Interfaz recuperada frente a RC29

- Inventario y técnicos en dos columnas en móvil.
- Tarjetas compactas.
- Colores estables por especialidad.
- Cortinas plegables de filtros.
- Historial avanzado con fecha y hora completas.
- Filtros Hoy, Ayer, 7 días, 30 días, mes y rango.
- Auditoría CSV compatible con Excel.
- Salida verde, entrada roja, incidencia ámbar y rectificación violeta.
- Saludo configurable.
- Radar luminoso en el logotipo.
- Botón Atrás: cerrar modal, volver a Inicio y doble pulsación para salir.
- Safe areas Android.
- Herramientas administrativas agrupadas en un único menú móvil.

## Desarrollo

```bash
npm install
npm test
python3 scripts/validate_sqlite_schema.py
npm run build
```

## Android

```bash
npm run android:prepare
cd android
./gradlew assembleDebug
```

La automatización de GitHub genera una APK paralela denominada **ISIVOLT RC30 Pruebas**, con application ID distinto, para instalarla junto a la versión existente sin compartir su base de datos.

## Documentación

- `docs/USER_MANUAL.md`: manual de uso.
- `docs/RC29_PARITY.md`: matriz de recuperación respecto a la APK instalada.
- `docs/PRODUCTION.md`: preparación y checklist de producción.
- `docs/RECOVERY.md`: persistencia y recuperación de datos.
- `docs/ROADMAP.md`: planificación restante.

## Estado de validación

La validación automatizada comprueba:

- Pruebas de dominio y regresión de recuperación.
- Migraciones SQLite reales v1-v6.
- Coherencia de producción.
- TypeScript y Vite.
- Configuración de plugins Android.
- Compilación de APK Android principal y RC30 paralela.

La fusión con `main` queda bloqueada hasta completar las pruebas físicas de cámara, tarjeta corporativa, guardado con cierre inmediato, botón Atrás, safe areas, impresión QR, restauración y comparación pantalla por pantalla con RC29.
