# Manual de uso — ISIVOLT Herramientas QR RC30

## 1. Primer inicio

1. Instala la APK de pruebas **sin desinstalar RC29**.
2. La candidata paralela aparece como **ISIVOLT RC30 Pruebas** y utiliza almacenamiento independiente.
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

La tarjeta del hospital puede utilizarse como alternativa al NFC.

1. Abre el menú flotante **Herramientas**.
2. Pulsa **Tarjetas**.
3. Busca el técnico por nombre, código o especialidad.
4. Pulsa **Escanear** y centra uno de los códigos de barras.
5. Guarda exactamente el valor leído por la cámara.
6. Cuando la cámara no lo reconozca, utiliza **Manual** e introduce el número impreso.
7. Confirma el mensaje **Tarjeta vinculada y protegida**.

El código queda guardado en la ficha del técnico, SQLite local y las copias JSON restaurables. Un mismo código no puede asignarse a dos técnicos.

## 4. Prestar herramientas

1. Pulsa el botón central **Escanear**.
2. Selecciona **Préstamo**.
3. Elige el recorrido:
   - **Primero técnico**: escanea tarjeta, QR, NFC o busca manualmente.
   - **Primero herramienta**: identifica una o varias herramientas y después el responsable.
4. Escanea o selecciona las herramientas.
5. Pulsa **Revisar préstamo**.
6. Introduce opcionalmente:
   - Número de OT.
   - Edificio, planta, zona o habitación.
   - Fecha y hora prevista de devolución.
7. Revisa todos los accesorios obligatorios.
8. Pulsa **Prestar** una sola vez.
9. Espera a que desaparezca **Guardando…**.
10. Comprueba la confirmación visual verde.

Una herramienta no podrá prestarse cuando ya esté prestada, averiada, en revisión, bloqueada por mantenimiento, reservada para otro técnico o tenga un accesorio obligatorio ausente o dañado.

## 5. Fecha prevista de devolución

La fecha es opcional. Cuando una herramienta tiene configurado un plazo máximo de préstamo, RC30 propone automáticamente la fecha más próxima del lote.

La fecha queda vinculada al movimiento y almacenada en SQLite. No modifica por sí sola el estado de la herramienta.

## 6. Checklist de accesorios

Cada herramienta puede tener accesorios obligatorios u opcionales, por ejemplo:

- Maletín.
- Batería.
- Cargador.
- Puntas de prueba.
- Empuñadura.

En cada operación se puede marcar:

- **Correcto**.
- **Falta**.
- **Dañado**.
- **Sin revisar**.

Para prestar, todos los accesorios obligatorios deben figurar como correctos. En una devolución, un accesorio obligatorio ausente o dañado convierte la entrada en incidencia, obliga a escribir observaciones y deja la herramienta en revisión.

## 7. Devolver herramientas

1. Pulsa **Escanear**.
2. Selecciona **Devolución**.
3. Identifica primero al técnico para cargar todo lo pendiente o escanea una herramienta concreta.
4. Revisa el responsable real de cada herramienta.
5. Marca individualmente el estado de cada herramienta:
   - **Correcta**.
   - **Revisión**.
   - **Averiada**.
6. Comprueba los accesorios.
7. Añade observaciones cuando exista una incidencia.
8. Confirma la devolución y espera a que termine **Guardando…**.

Una devolución normal muestra confirmación roja. Una entrada con incidencia muestra confirmación ámbar y bloquea la herramienta hasta su revisión.

## 8. Entrada manual

Cuando la cámara no pueda utilizarse:

1. Abre el flujo de escaneo.
2. Pulsa la búsqueda manual de técnico o herramienta.
3. Busca por nombre, código, tarjeta, categoría, especialidad, ubicación, marca o NFC.
4. Para tarjetas también puede introducirse directamente el número del código de barras.

## 9. Inventario

El inventario móvil muestra tarjetas compactas en dos columnas cuando la anchura lo permite.

- Pulsa **Filtrar herramientas** para abrir o cerrar la cortina.
- Filtra por Todas, Disponibles, Prestadas o Atención.
- Selecciona una categoría.
- Pulsa **Mostrar todo** para limpiar filtros.
- Cada tarjeta muestra última salida y última entrada.
- Pulsa la imagen para hacer una fotografía o elegirla de la galería.

## 10. Técnicos

La vista de técnicos utiliza tarjetas compactas y un color estable por especialidad.

- Pulsa **Filtrar por especialidad**.
- Busca por nombre, código, tarjeta o especialidad.
- Pulsa una tarjeta para revisar las herramientas asignadas.

## 11. Historial y auditoría

Filtros disponibles:

- Todo.
- Hoy.
- Ayer.
- Últimos 7 días.
- Últimos 30 días.
- Este mes.
- Rango personalizado.

Cada movimiento muestra fecha y hora, herramienta, técnico, operador y observaciones. Los movimientos conservan además `operationId`, OT, ubicación, fecha prevista y comprobaciones de accesorios.

Colores:

- Verde: salida o préstamo.
- Rojo: entrada o devolución.
- Ámbar: incidencia.
- Violeta: rectificación.

Pulsa **Descargar auditoría** para generar un CSV UTF-8 compatible con Excel.

## 12. Fotografías

Desde Inventario o la ficha del artículo:

- Pulsa la imagen.
- Elige cámara o galería.
- La fotografía queda guardada en el dispositivo.
- Comprueba la imagen después de actualizar la aplicación.

## 13. Herramientas administrativas

En móvil, los accesos quedan agrupados en un único menú:

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

## 14. Saludo de inicio

Pulsa el icono de perfil de la cabecera, escribe el nombre y pulsa **Guardar saludo**. La aplicación utilizará Buenos días, Buenas tardes o Buenas noches según la hora.

## 15. Mantenimiento

El tablero permite crear incidencias, inspecciones, reparaciones y calibraciones, asignar responsable, añadir fechas, costes y repuestos, registrar resolución y cerrar o cancelar la actuación.

Una actuación abierta puede bloquear automáticamente la herramienta.

## 16. Informes y copias

### Excel operativo

Incluye movimientos, préstamos, inventario, técnicos e incidencias.

### Excel de gestión

Incluye datos económicos, accesorios, mantenimiento y alertas.

### Auditoría CSV

Incluye los movimientos visibles después de aplicar búsqueda y filtros temporales.

### Copia JSON

Contiene el estado restaurable de la aplicación, incluidos códigos de barras, OT, ubicación, vencimientos y comprobaciones de accesorios. Debe crearse antes de actualizar o restaurar y después de una carga inicial importante.

## 17. Restauración

1. Conserva una copia del estado actual.
2. Selecciona el archivo JSON correcto.
3. Revisa fecha y versión.
4. Confirma la restauración.
5. Comprueba contadores y diagnóstico SQLite.
6. Verifica tarjetas, accesorios y movimientos recientes.

## 18. Rectificaciones

Los movimientos no se editan ni se eliminan. Para corregir un error, abre Rectificaciones, busca el movimiento original, indica el resultado correcto y describe el motivo. La aplicación añade un ajuste nuevo enlazado y conserva el original.

## 19. Navegación Android

El botón Atrás sigue este orden:

1. Cierra la ventana o modal abierto.
2. Si no hay ventana, vuelve a Inicio.
3. Desde Inicio muestra **Pulsa Atrás otra vez para salir**.
4. Una segunda pulsación cierra la aplicación.

La barra inferior y el menú respetan las zonas seguras de Android.

## 20. Diagnóstico

Pulsa **Herramientas > Diagnóstico** para consultar:

- Esquema SQLite esperado: versión 6.
- Número de herramientas.
- Número de técnicos.
- Número de movimientos.
- Accesorios.
- Expedientes de mantenimiento.
- Errores locales recientes.

## 21. Recomendaciones de prueba

- No desinstales RC29.
- Utiliza inicialmente datos de demostración.
- Prueba tarjeta, QR, selección manual y NFC opcional.
- Realiza un préstamo con OT, ubicación, vencimiento y accesorios.
- Devuelve una herramienta con un accesorio ausente.
- Cierra la aplicación inmediatamente después de guardar y vuelve a abrirla.
- Crea una copia JSON antes de cualquier actualización real.
