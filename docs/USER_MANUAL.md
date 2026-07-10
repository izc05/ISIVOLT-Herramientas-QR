# Manual de uso — ISIVOLT Herramientas QR

## 1. Primer inicio

1. Instala la APK sin desinstalar una versión anterior.
2. Abre la aplicación.
3. En el primer inicio, crea el administrador local.
4. Introduce un PIN de 4 a 8 cifras y confírmalo.
5. Conserva el PIN en un procedimiento corporativo seguro.
6. Desde Usuarios, crea las cuentas de Almacén y Técnico necesarias.

## 2. Roles

### Administrador

Puede gestionar usuarios, herramientas, técnicos, mantenimiento, informes, restauraciones, auditoría, diagnóstico y rectificaciones.

### Responsable de almacén

Puede registrar entradas y salidas, gestionar herramientas y mantenimiento, y exportar informes. No puede administrar usuarios ni restaurar copias.

### Técnico

Dispone de acceso de consulta y no puede modificar ni registrar movimientos.

## 3. Entregar herramientas

1. Pulsa el botón central **Escanear**.
2. Selecciona **Entrega**.
3. Escanea el QR del técnico.
4. Escanea una o varias herramientas.
5. Revisa fotografías, códigos y accesorios.
6. Añade observaciones cuando sea necesario.
7. Confirma la operación.
8. Comprueba el sonido, la vibración y la animación de salida.

Una herramienta no podrá entregarse cuando:

- Ya esté prestada.
- Esté averiada o en revisión.
- Se encuentre en reparación, calibración o fuera de servicio.
- Esté reservada para otro técnico.
- El técnico esté inactivo.

## 4. Devolver herramientas

1. Pulsa **Escanear**.
2. Selecciona **Devolución**.
3. Escanea las herramientas que regresan.
4. Indica el estado:
   - Correcta.
   - Pendiente de revisión.
   - Averiada.
5. Añade una observación obligatoria para revisión o avería.
6. Comprueba los accesorios.
7. Confirma la entrada.

Las herramientas con incidencia quedarán bloqueadas hasta su revisión.

## 5. Entrada manual

Cuando la cámara no pueda utilizarse:

1. Abre el flujo QR.
2. Pulsa **Introducir código manualmente**.
3. Escribe o pega el contenido completo del QR.
4. También se aceptan códigos internos de técnico o herramienta.

## 6. Fotografías

Desde Inventario o la ficha del artículo:

- Pulsa la imagen.
- Elige cámara o galería.
- La fotografía queda guardada en el dispositivo.
- Comprueba la imagen después de actualizar la aplicación.

## 7. Centro de gestión

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

## 8. Mantenimiento

El tablero de mantenimiento permite:

- Buscar expedientes.
- Crear incidencias, inspecciones, reparaciones y calibraciones.
- Asignar responsable.
- Añadir fecha límite, coste y repuestos.
- Registrar resolución.
- Cerrar o cancelar la actuación.

Una actuación abierta puede bloquear automáticamente la herramienta.

## 9. Alertas

La aplicación avisa de:

- Préstamos fuera de plazo.
- Revisiones y calibraciones próximas o vencidas.
- Herramientas averiadas o bloqueadas.
- Actuaciones vencidas.
- Accesorios ausentes o dañados.
- Herramientas sin fotografía.
- QR incorrectos.

## 10. Informes y copias

### Excel operativo

Incluye movimientos, préstamos, inventario, técnicos e incidencias.

### Excel de gestión

Incluye datos económicos, accesorios, mantenimiento y alertas.

### Copia JSON

Contiene el estado restaurable de la aplicación. Debe crearse:

- Antes de actualizar.
- Antes de restaurar datos.
- Después de una carga inicial importante.
- Con la periodicidad establecida por el responsable.

## 11. Restauración

La restauración es una acción de Administrador.

1. Conserva primero una copia del estado actual.
2. Selecciona el archivo JSON correcto.
3. Revisa fecha y versión.
4. Confirma la restauración.
5. Comprueba los contadores y el diagnóstico SQLite.

## 12. Rectificaciones

Los movimientos no se editan ni se eliminan.

Para corregir un error:

1. Abre Rectificaciones.
2. Busca el movimiento original.
3. Selecciona el estado correcto.
4. Indica el técnico cuando el resultado sea Prestada.
5. Describe el motivo.
6. Registra la rectificación.

La aplicación conservará el movimiento original y añadirá un ajuste nuevo enlazado.

## 13. Diagnóstico

Pulsa el indicador de versión para consultar:

- Esquema SQLite.
- Número de herramientas.
- Número de técnicos.
- Número de movimientos.
- Accesorios.
- Expedientes de mantenimiento.
- Errores locales recientes.

## 14. Puesta en servicio

El icono de prueba abre el checklist integrado:

- Ejecuta las comprobaciones automáticas.
- Completa cada prueba manual.
- Marca Correcta, Fallida o Pendiente.
- Descarga el informe final.

## 15. Recomendaciones

- No desinstales la aplicación para actualizarla.
- Crea una copia antes de cada actualización.
- No compartas el PIN.
- Mantén al menos un administrador activo.
- No uses una APK release firmada con una clave diferente a la versión anterior.
- Revisa periódicamente alertas, auditoría y copias.