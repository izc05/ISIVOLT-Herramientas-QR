# Manual de uso — ISIVOLT Herramientas QR RC24

## 1. Primer inicio

1. Instala la APK de pruebas **sin desinstalar RC29**.
2. La candidata paralela aparece como **ISIVOLT RC24 Pruebas** y utiliza almacenamiento independiente.
3. Abre la aplicación y crea el administrador local.
4. Introduce un PIN de 4 a 8 cifras y confírmalo.
5. Conserva el PIN en un procedimiento corporativo seguro.
6. Desde Usuarios, crea las cuentas de Almacén y Técnico necesarias.

## 2. Roles

### Administrador

Puede gestionar usuarios, herramientas, técnicos, tarjetas, mantenimiento, informes, restauraciones, auditoría, diagnóstico y rectificaciones.

### Responsable de almacén

Puede registrar entradas y salidas, gestionar herramientas y mantenimiento, y exportar informes. No puede administrar usuarios ni restaurar copias.

### Técnico

Dispone de acceso de consulta y no puede modificar ni registrar movimientos.

## 3. Identificar técnicos mediante tarjeta corporativa

La aplicación admite la tarjeta del hospital como alternativa al NFC. El ejemplo analizado utiliza **CODE 39**.

1. Abre el menú flotante **Herramientas**.
2. Pulsa **Tarjetas**.
3. Busca el técnico por nombre, código o especialidad.
4. Pulsa **Escanear** y centra el código de barras horizontal.
5. También puedes introducir manualmente el número impreso debajo del código.
6. Confirma que aparece el mensaje **Tarjeta vinculada y protegida**.

El código queda guardado en:

- La ficha del técnico.
- SQLite local.
- Las copias JSON restaurables.
- Un registro auxiliar de compatibilidad para instalaciones anteriores.

Un mismo código no puede asignarse a dos técnicos.

## 4. Prestar herramientas

1. Pulsa el botón central **Escanear**.
2. Selecciona **Préstamo**.
3. Elige el recorrido:
   - **Primero técnico**: escanea tarjeta, QR, NFC o busca manualmente al técnico.
   - **Primero herramienta**: identifica la herramienta y después el responsable.
4. Escanea o selecciona una o varias herramientas.
5. Revisa fotografías, códigos, reservas y bloqueos.
6. Pulsa **Revisar préstamo**.
7. Comprueba el lote final.
8. Pulsa **Prestar herramientas** una sola vez.
9. Espera a que desaparezca **Guardando…**.
10. Comprueba la confirmación visual verde.

Una herramienta no podrá prestarse cuando:

- Ya esté prestada.
- Esté averiada o en revisión.
- Se encuentre en reparación, calibración o fuera de servicio.
- Esté reservada para otro técnico.
- El técnico esté inactivo.

## 5. Devolver herramientas

1. Pulsa **Escanear**.
2. Selecciona **Devolución**.
3. Identifica primero al técnico para cargar todo lo pendiente o escanea una herramienta concreta.
4. Revisa el responsable real de cada herramienta.
5. En la comprobación final, marca individualmente:
   - **Correcta**.
   - **Revisión**.
   - **Averiada**.
6. Añade observaciones obligatorias si alguna herramienta no vuelve correcta.
7. Confirma la devolución.
8. Espera a que termine **Guardando…**.
9. Comprueba:
   - Confirmación roja para una devolución normal.
   - Confirmación ámbar para una entrada con incidencia.

Las herramientas con incidencia quedarán bloqueadas hasta su revisión.

## 6. Entrada manual

Cuando la cámara no pueda utilizarse:

1. Abre el flujo de escaneo.
2. Pulsa la búsqueda manual de técnico o herramienta.
3. Busca por nombre, código, categoría, especialidad, ubicación, marca o NFC.
4. Para tarjetas también puede introducirse directamente el número del código de barras.

## 7. Inventario

El inventario móvil muestra tarjetas compactas en dos columnas en teléfonos con anchura suficiente.

- Pulsa **Filtrar herramientas** para abrir o cerrar la cortina.
- Filtra por Todas, Disponibles, Prestadas o Atención.
- Selecciona una categoría concreta.
- Pulsa **Mostrar todo** para limpiar los filtros.
- Cada tarjeta muestra última salida y última entrada.
- Pulsa la imagen para hacer una fotografía o elegirla de la galería.

## 8. Técnicos

La vista de técnicos utiliza tarjetas compactas en dos columnas y un color estable por especialidad.

- Pulsa **Filtrar por especialidad** para desplegar la cortina.
- Busca por nombre, código o especialidad.
- El color de una especialidad se conserva después de reiniciar.
- Pulsa una tarjeta para revisar las herramientas asignadas.

## 9. Historial y auditoría

Pulsa **Historial** para abrir el centro avanzado.

Filtros disponibles:

- Todo.
- Hoy.
- Ayer.
- Últimos 7 días.
- Últimos 30 días.
- Este mes.
- Rango personalizado.

Cada movimiento muestra fecha y hora completa, herramienta, técnico, operador y observaciones.

Colores:

- Verde: salida o préstamo.
- Rojo: entrada o devolución.
- Ámbar: incidencia.
- Violeta: rectificación.

Pulsa **Descargar auditoría** para generar un CSV UTF-8 compatible con Excel.

## 10. Fotografías

Desde Inventario o la ficha del artículo:

- Pulsa la imagen.
- Elige cámara o galería.
- La fotografía queda guardada en el dispositivo.
- Comprueba la imagen después de actualizar la aplicación.

## 11. Herramientas administrativas

En móvil, los accesos flotantes quedan agrupados en un único menú para no tapar contenido:

- Gestión.
- Tarjetas.
- NFC.
- Informes.
- Etiquetas QR.
- Archivos.
- Mantenimiento.
- Rectificaciones.
- Sonido y vibración.
- Diagnóstico.
- Pruebas.

## 12. Saludo de inicio

Pulsa el icono de perfil situado en la cabecera.

1. Escribe el nombre que deseas mostrar.
2. Pulsa **Guardar saludo**.
3. La aplicación utilizará automáticamente Buenos días, Buenas tardes o Buenas noches.
4. El nombre solo se guarda en el dispositivo.

## 13. Mantenimiento

El tablero de mantenimiento permite:

- Buscar expedientes.
- Crear incidencias, inspecciones, reparaciones y calibraciones.
- Asignar responsable.
- Añadir fecha límite, coste y repuestos.
- Registrar resolución.
- Cerrar o cancelar la actuación.

Una actuación abierta puede bloquear automáticamente la herramienta.

## 14. Informes y copias

### Excel operativo

Incluye movimientos, préstamos, inventario, técnicos e incidencias.

### Excel de gestión

Incluye datos económicos, accesorios, mantenimiento y alertas.

### Auditoría CSV

Incluye los movimientos visibles después de aplicar búsqueda y filtros temporales.

### Copia JSON

Contiene el estado restaurable de la aplicación, incluidos los códigos de barras asignados a los técnicos. Debe crearse:

- Antes de actualizar.
- Antes de restaurar datos.
- Después de una carga inicial importante.
- Con la periodicidad establecida por el responsable.

## 15. Restauración

La restauración es una acción de Administrador.

1. Conserva primero una copia del estado actual.
2. Selecciona el archivo JSON correcto.
3. Revisa fecha y versión.
4. Confirma la restauración.
5. Comprueba los contadores y el diagnóstico SQLite.
6. Entra en Tarjetas y confirma que las asociaciones se han recuperado.

## 16. Rectificaciones

Los movimientos no se editan ni se eliminan.

Para corregir un error:

1. Abre Rectificaciones.
2. Busca el movimiento original.
3. Selecciona el estado correcto.
4. Indica el técnico cuando el resultado sea Prestada.
5. Describe el motivo.
6. Registra la rectificación.

La aplicación conservará el movimiento original y añadirá un ajuste nuevo enlazado.

## 17. Navegación Android

El botón Atrás sigue este orden:

1. Cierra la ventana o el modal abierto.
2. Si no hay ventana, vuelve a Inicio.
3. Desde Inicio muestra **Pulsa Atrás otra vez para salir**.
4. Una segunda pulsación dentro del intervalo cierra la aplicación.

La barra inferior y el menú de herramientas respetan las zonas seguras de Android.

## 18. Diagnóstico

Pulsa **Herramientas > Diagnóstico** para consultar:

- Esquema SQLite esperado: versión 5.
- Número de herramientas.
- Número de técnicos.
- Número de movimientos.
- Accesorios.
- Expedientes de mantenimiento.
- Errores locales recientes.

## 19. Puesta en servicio

El icono de Pruebas abre el checklist integrado:

- Ejecuta las comprobaciones automáticas.
- Completa cada prueba manual.
- Marca Correcta, Fallida o Pendiente.
- Descarga el informe final.

## 20. Recomendaciones

- No desinstales RC29 durante las pruebas.
- Utiliza la APK paralela para no mezclar bases de datos.
- Crea una copia antes de cada actualización real.
- No compartas el PIN.
- Mantén al menos un administrador activo.
- No uses una APK release firmada con una clave diferente a la versión anterior.
- Revisa periódicamente alertas, auditoría y copias.
