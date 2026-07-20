# Manual de uso — ISIVOLT Herramientas QR

## 1. Primer inicio

### RC24 de pruebas

1. Instala **ISIVOLT RC24 Pruebas** sin desinstalar RC23.
2. Comprueba que aparecen dos aplicaciones distintas en el teléfono.
3. Abre únicamente RC24 para realizar el piloto.
4. Crea el administrador local.
5. Introduce un PIN de 4 a 8 cifras y confírmalo.
6. Utiliza técnicos y herramientas de prueba hasta completar el checklist físico.

RC24 paralela utiliza un identificador Android y una base de datos distintos. Desinstalar RC24 no elimina los datos de RC23.

### Aplicación definitiva

Cuando RC24 haya superado el piloto, las actualizaciones de la aplicación definitiva deberán instalarse sobre la versión anterior, sin desinstalarla y después de generar una copia comprobada.

## 2. Roles

### Administrador

Puede gestionar usuarios, herramientas, técnicos, mantenimiento, informes, restauraciones, auditoría, diagnóstico y rectificaciones.

### Responsable de almacén

Puede registrar entradas y salidas, gestionar herramientas y mantenimiento, y exportar informes. No puede administrar usuarios ni restaurar copias.

### Técnico

Dispone de acceso de consulta y no puede modificar ni registrar movimientos.

## 3. Entregar herramientas

1. Pulsa el botón central **Escanear** u **Operación QR**.
2. Selecciona **Préstamo**.
3. Elige el orden más cómodo:
   - **Primero técnico**: identifica al responsable y después las herramientas.
   - **Primero herramienta**: selecciona una o varias herramientas y después identifica al responsable.
4. Identifica mediante:
   - Tarjeta o etiqueta NFC.
   - Código QR.
   - Búsqueda manual.
5. Añade todas las herramientas que formen parte de la entrega.
6. Pulsa **Revisar préstamo**.
7. Comprueba el técnico, los códigos y el número total de herramientas.
8. Añade observaciones cuando sea necesario.
9. Pulsa **Prestar**.
10. Espera hasta que desaparezca el estado **Guardando…** y se muestre la confirmación.

Una herramienta no podrá entregarse cuando:

- Ya esté prestada.
- Esté averiada o en revisión.
- Se encuentre en reparación, calibración o fuera de servicio.
- Esté reservada para otro técnico.
- Esté dada de baja.
- El técnico esté inactivo.

En el modo **Primero herramienta**, una reserva puede seleccionarse antes de conocer al técnico. La app comprobará obligatoriamente el responsable antes de guardar.

## 4. Devolver herramientas

1. Pulsa **Escanear** u **Operación QR**.
2. Selecciona **Devolución**.
3. Elige el orden:
   - **Primero técnico**: identifica al técnico y la aplicación cargará sus herramientas pendientes.
   - **Primero herramienta**: identifica una herramienta concreta y la aplicación localizará al técnico que la tiene asignada.
4. Añade o retira las herramientas necesarias.
5. Pulsa **Revisar devolución**.
6. Indica el estado individual de cada herramienta:
   - **Correcta**: vuelve a estar disponible.
   - **Revisión**: queda bloqueada pendiente de comprobación.
   - **Averiada**: queda bloqueada y genera un movimiento de incidencia.
7. Si alguna herramienta queda en revisión o averiada, escribe una observación obligatoria.
8. Comprueba el resumen del lote.
9. Pulsa **Devolver**.
10. Espera la confirmación de guardado.

Una devolución no puede mezclar herramientas que estén asignadas a técnicos diferentes. Las herramientas con incidencia quedarán bloqueadas hasta que se resuelva su estado o expediente de mantenimiento.

## 5. Identificación manual, QR y NFC

Los tres métodos utilizan exactamente las mismas reglas de validación.

### QR

- Puede identificar técnicos y herramientas.
- Los códigos que no pertenezcan a ISIVOLT se rechazan.
- La cámara sigue disponible como método principal cuando el dispositivo lo permita.

### NFC

- Acerca la tarjeta del técnico o la etiqueta de la herramienta a la parte trasera del teléfono.
- Si un mismo UID aparece vinculado simultáneamente a un técnico y una herramienta, la operación se bloquea hasta corregirlo.
- Si el móvil no dispone de NFC, QR y búsqueda manual continúan funcionando.

### Búsqueda manual

- Técnicos: nombre, código, oficio o especialidad.
- Herramientas: nombre, código, categoría, ubicación, marca, modelo, número de serie o NFC.

## 6. Protección contra errores y duplicados

- Una herramienta no puede aparecer dos veces en el mismo lote.
- La doble pulsación del botón de confirmación no crea dos operaciones.
- Cada lote recibe un `operationId` único.
- El `operationId` queda guardado en SQLite y permite reconocer una operación ya registrada incluso después de cerrar y abrir la aplicación.
- Durante **Guardando…** se bloquean QR, NFC, selectores, condiciones, observaciones y cierre.
- Si se intenta cerrar una operación preparada, la app solicita confirmación.
- Si SQLite no termina antes de cerrar la aplicación, RC24 conserva el estado local pendiente y trata de reconstruir la base de datos al abrir.

## 7. Fotografías

Desde Inventario o la ficha del artículo:

- Pulsa la imagen.
- Elige cámara o galería.
- La fotografía queda guardada en el dispositivo.
- Comprueba la imagen después de actualizar la aplicación.

Las fotografías antiguas en Base64 todavía deben comprobarse especialmente al restaurar copias o actualizar desde versiones anteriores.

## 8. Centro de gestión

El botón **Gestión** permite:

- Crear y editar herramientas.
- Crear y editar técnicos.
- Configurar marca, modelo, serie y ubicación.
- Registrar compra, coste y proveedor.
- Definir plazo máximo de préstamo.
- Reservar una herramienta para un técnico.
- Programar revisión o calibración.
- Añadir accesorios.
- Abrir expedientes de mantenimiento.
- Importar inventario desde Excel.

## 9. Mantenimiento

El tablero de mantenimiento permite:

- Buscar expedientes.
- Crear incidencias, inspecciones, reparaciones y calibraciones.
- Asignar responsable.
- Añadir fecha límite, coste y repuestos.
- Registrar resolución.
- Cerrar o cancelar la actuación.

Una actuación abierta puede bloquear automáticamente la herramienta.

## 10. Alertas

La aplicación avisa de:

- Préstamos fuera de plazo.
- Revisiones y calibraciones próximas o vencidas.
- Herramientas averiadas o bloqueadas.
- Actuaciones vencidas.
- Accesorios ausentes o dañados.
- Herramientas sin fotografía.
- QR incorrectos.

## 11. Informes y copias

### Excel operativo

Incluye movimientos, préstamos, inventario, técnicos e incidencias.

### Excel de gestión

Incluye datos económicos, accesorios, mantenimiento y alertas.

### Copia JSON

Contiene el estado restaurable documentado de la aplicación. Debe crearse:

- Antes de actualizar.
- Antes de restaurar datos.
- Después de una carga inicial importante.
- Con la periodicidad establecida por el responsable.

Antes de considerar una copia como válida, comprueba que puede compartirse, volver a seleccionarse y restaurarse sobre datos de prueba.

## 12. Restauración

La restauración es una acción de Administrador.

1. Conserva primero una copia del estado actual.
2. Selecciona el archivo JSON correcto.
3. Revisa fecha y versión.
4. Confirma la restauración.
5. Comprueba los contadores y el diagnóstico SQLite.
6. Verifica usuarios, herramientas, técnicos, movimientos, accesorios, mantenimiento y fotografías disponibles.

## 13. Rectificaciones

Los movimientos no se editan ni se eliminan.

Para corregir un error:

1. Abre Rectificaciones.
2. Busca el movimiento original.
3. Selecciona el estado correcto.
4. Indica el técnico cuando el resultado sea Prestada.
5. Describe el motivo.
6. Registra la rectificación.

La aplicación conservará el movimiento original y añadirá un ajuste nuevo enlazado.

## 14. Diagnóstico

Pulsa el indicador de versión para consultar:

- Esquema SQLite. RC24 debe mostrar la versión 4.
- Número de herramientas.
- Número de técnicos.
- Número de movimientos.
- Accesorios.
- Expedientes de mantenimiento.
- Errores locales recientes.

## 15. Puesta en servicio RC24

Durante el piloto deben comprobarse al menos estos casos:

1. Préstamo empezando por técnico.
2. Préstamo empezando por herramienta.
3. Devolución completa de un técnico.
4. Devolución de una sola herramienta.
5. Devolución múltiple con estados diferentes.
6. Reserva para el técnico correcto y para uno incorrecto.
7. Doble pulsación rápida en confirmar.
8. Cierre inmediato después de guardar y recuperación al abrir.
9. QR, NFC y búsqueda manual.
10. Botón Atrás, teclado, scroll y safe areas.
11. Excel, copia y restauración con datos de prueba.

Registra cualquier fallo antes de utilizar RC24 con el inventario real.

## 16. Recomendaciones

- No desinstales RC23 durante el piloto de RC24.
- No uses todavía datos reales en RC24 paralela.
- Crea una copia antes de cada actualización de la aplicación definitiva.
- No compartas el PIN.
- Mantén al menos un administrador activo.
- No uses una APK release firmada con una clave diferente a la versión anterior.
- Revisa periódicamente alertas, auditoría y copias.
