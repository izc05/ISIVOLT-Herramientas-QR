# Recuperación y protección de datos — ISIVOLT Herramientas QR

## Objetivo

Evitar pérdidas, duplicados o confirmaciones falsas cuando Android pausa o cierra la aplicación durante una operación.

## Capas de persistencia

La candidata RC24 utiliza varias capas coordinadas:

1. Estado local inmediato para mantener la interfaz operativa.
2. Cola secuencial de escrituras para que dos cambios no se pisen.
3. Marcador de escritura pendiente antes de iniciar SQLite.
4. SQLite normalizado como almacenamiento nativo persistente.
5. Copia JSON restaurable creada por el usuario.

## Flujo seguro de guardado

1. Se valida toda la operación en el motor de dominio.
2. Se genera un `operationId` único para el lote.
3. Se bloquean botones, escáner, selectores y cierre.
4. La interfaz muestra `Guardando…`.
5. Se guarda el nuevo estado local.
6. Se encola la escritura SQLite.
7. La aplicación espera `waitForPendingAppDataWrites()`.
8. Solo después muestra la confirmación final.

Si Android interrumpe el proceso, el marcador pendiente permite recuperar el estado en el siguiente arranque.

## Prevención de movimientos duplicados

Todos los movimientos de un mismo lote comparten `operationId`.

- El motor rechaza una operación cuyo identificador ya existe.
- SQLite conserva `operation_id` desde la migración v4.
- La protección continúa funcionando después de cerrar y abrir la aplicación.
- La doble pulsación queda bloqueada también en la interfaz.

## Reconstrucción de SQLite

Durante el arranque se comparan el estado local y SQLite.

Cuando el estado local contiene herramientas, técnicos o movimientos que todavía no aparecen en SQLite, la aplicación vuelve a escribir el estado normalizado. La reconstrucción no elimina el registro local que sirve de recuperación.

## Tarjetas corporativas

Desde SQLite v5, cada técnico puede incluir `barcodeValue`.

La asociación de una tarjeta se protege así:

1. Se normaliza el valor leído, eliminando espacios y usando mayúsculas.
2. Se comprueba que no pertenezca a otro técnico.
3. Se actualiza la ficha del técnico en AppData.
4. Se guarda el estado local.
5. Se espera la escritura SQLite.
6. El valor queda incluido en la copia JSON.
7. Se mantiene una preferencia auxiliar para compatibilidad con asociaciones creadas antes de SQLite v5.

La fuente principal es la ficha del técnico. La preferencia auxiliar solo actúa como respaldo heredado.

## Migraciones SQLite

- v1: inventario normalizado, movimientos, usuarios y auditoría.
- v2: gestión de activos, accesorios y mantenimiento.
- v3: identificación NFC.
- v4: `operationId` para idempotencia.
- v5: código de barras único por técnico.

Las migraciones se ejecutan dentro de transacciones y se validan automáticamente sobre sqlite3 real.

## Movimientos inmutables

SQLite utiliza disparadores que impiden:

- Actualizar un movimiento original.
- Eliminar un movimiento original.

Las correcciones se registran mediante una rectificación nueva enlazada al movimiento anterior.

## Restauración

Una restauración completa debe comprobar:

1. Herramientas y estados.
2. Técnicos activos e inactivos.
3. Códigos de barras de técnicos.
4. Movimientos y `operationId`.
5. Accesorios.
6. Mantenimiento.
7. Fotografías incluidas o referenciadas según el formato de copia.
8. Diagnóstico SQLite v5.

## Prueba de cierre forzado

Para validar la recuperación:

1. Preparar un préstamo de demostración.
2. Confirmar la operación.
3. Cerrar inmediatamente la aplicación desde tareas recientes.
4. Volver a abrir.
5. Comprobar que la herramienta está prestada una sola vez.
6. Revisar el historial y el `operationId`.
7. Repetir el proceso con una devolución.
8. Repetir después de asociar una tarjeta a un técnico.

La rama no debe fusionarse hasta superar esta prueba en un dispositivo Android real.
