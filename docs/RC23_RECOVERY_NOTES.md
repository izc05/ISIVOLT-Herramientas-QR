# Recuperación funcional de RC23

## Situación de partida

La APK de referencia `1.0.0-rc.23-nfc` contenía mejoras operativas que no estaban presentes en el código fuente de `main`, identificado como RC7. La recuperación se está realizando sobre una rama protegida para no degradar la APK instalada ni sobrescribir `main` antes de validar el resultado.

## Funciones recuperadas en código mantenible

- Motor único de movimientos para QR, NFC y selección manual.
- Identificador `operationId` compartido por todos los movimientos de un mismo lote.
- Prevención de doble confirmación mediante bloqueo síncrono y regla de idempotencia.
- Persistencia de `operationId` en SQLite mediante migración v4.
- Revisión final antes de guardar préstamos y devoluciones.
- Estado individual de cada herramienta devuelta: correcta, revisión o averiada.
- Observaciones obligatorias cuando existe alguna incidencia.
- Confirmación antes de cancelar una operación preparada.
- Elección del orden de identificación: primero técnico o primero herramienta.
- Resolución automática del técnico al comenzar una devolución por herramienta.
- Recuperación de escrituras locales pendientes si SQLite no terminó antes de cerrar la app.
- Cola secuencial de persistencia para evitar escrituras fuera de orden.
- Estado visible `Guardando…` y controles bloqueados durante la transacción.

## Reglas recuperadas y reforzadas

- Una herramienta no puede aparecer dos veces en el mismo lote.
- Una operación con el mismo `operationId` no se registra una segunda vez.
- Una devolución no puede mezclar herramientas pertenecientes a técnicos distintos.
- Una herramienta averiada, en revisión, de baja o bloqueada por mantenimiento no puede prestarse.
- Una reserva puede escanearse antes de conocer al técnico, pero el motor impide guardarla para una persona distinta de la prevista.
- Cada devolución conserva en el historial al técnico que tenía realmente la herramienta.
- Las incidencias dejan la herramienta fuera de servicio y mantienen la trazabilidad original.

## Validación automática

La rama ejecuta en GitHub Actions:

- TypeScript y compilación Vite.
- Pruebas Vitest del motor, inventario y mapeadores.
- Migraciones SQLite reales mediante `sqlite3`.
- Validación de producción.
- Generación de APK Android.

## Pendiente antes de sustituir RC23

- Prueba física del flujo completo en móvil Android.
- Cerrar la aplicación inmediatamente tras una operación y comprobar recuperación.
- Verificar QR, NFC, botón Atrás, teclado, safe areas y actualización conservando datos.
- Confirmar qué módulos visuales de RC23 aún no están representados en el código recuperado.
- Generar una compilación con identificador independiente para instalarla junto a RC23 sin sobrescribirla.

## Siguiente evolución funcional

Cuando esta base esté validada, la siguiente fase incorporará:

- Fecha prevista de devolución.
- OT y ubicación de destino.
- Checklist de accesorios por salida y entrada.
- Transferencia entre técnicos.
- Inventario físico por escaneo.
- Kits de herramientas.
