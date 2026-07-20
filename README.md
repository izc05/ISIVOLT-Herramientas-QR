# ISIVOLT Herramientas QR

Aplicación Android y web para el control local de préstamos, devoluciones, técnicos, inventario, mantenimiento y trazabilidad de herramientas.

## Candidata actual

- Aplicación: `1.0.0-rc.24`.
- SQLite normalizado: versión 5.
- Rama de trabajo: `agent/rc24-storage-safety`.
- PR de recuperación: #42, mantenida en borrador hasta completar las pruebas físicas.

## Operaciones recuperadas

- Préstamo y devolución mediante QR, código de barras, NFC o búsqueda manual.
- Recorrido **Primero técnico** o **Primero herramienta**.
- Revisión final del lote antes de guardar.
- Condición individual por herramienta en devoluciones múltiples.
- Observación obligatoria para revisión o avería.
- Bloqueo de doble pulsación y estado visible `Guardando…`.
- `operationId` persistido para impedir duplicados incluso después de reiniciar.
- Recuperación de escrituras pendientes y reconstrucción de SQLite desde el estado local.

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

La automatización de GitHub genera una APK paralela denominada **ISIVOLT RC24 Pruebas**, con application ID distinto, para instalarla junto a la versión existente sin compartir su base de datos.

## Documentación

- `docs/USER_MANUAL.md`: manual de uso.
- `docs/RC29_PARITY.md`: matriz de recuperación respecto a la APK instalada.
- `docs/PRODUCTION.md`: preparación y checklist de producción.
- `docs/RECOVERY.md`: persistencia y recuperación de datos.
- `docs/ROADMAP.md`: planificación restante.

## Estado de validación

La última tanda funcional ha superado:

- Pruebas de dominio.
- Migraciones SQLite reales v1-v5.
- TypeScript y Vite.
- Compilación de APK Android paralela.

La fusión con `main` queda bloqueada hasta completar las pruebas físicas de cámara, tarjeta corporativa, Atrás, safe areas, impresión QR, restauración y comparación pantalla por pantalla con RC29.
