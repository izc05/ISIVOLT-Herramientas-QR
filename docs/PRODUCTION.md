# Preparación de producción — ISIVOLT Herramientas QR

## Estado de la versión

La candidata actual se identifica como `1.0.0-rc.24` y utiliza SQLite normalizado versión 5.

No se marcará como `1.0.0` estable hasta completar:

1. Firma release con una clave privada custodiada fuera del repositorio.
2. Instalación y actualización sobre un móvil real conservando datos.
3. Piloto controlado con un subconjunto del inventario.
4. Verificación física de cámara, QR, código de barras, fotografía, sonido, vibración, Excel, CSV y restauración.
5. Comparación pantalla por pantalla con la APK RC29 instalada.
6. Revisión de incidencias del piloto.

## Artefactos de compilación

### APK paralela de pruebas

- Nombre visible: `ISIVOLT RC24 Pruebas`.
- Identificador Android separado de la aplicación instalada.
- Base de datos privada e independiente de RC29.
- Uso: pruebas físicas sin sobrescribir la aplicación actual.
- Firma: clave de depuración de Android.
- Distribución: artefacto de GitHub Actions.

### APK debug principal

- Uso: pruebas internas del identificador de producción.
- Puede intentar actualizar una instalación con el mismo identificador.
- No debe instalarse sobre RC29 hasta confirmar firma, compatibilidad y copia restaurable.

### APK release firmada

- Uso: distribución interna directa.
- Firma: clave privada de ISIVOLT.
- Debe conservar la misma clave durante toda la vida de la aplicación para permitir actualizaciones.

### AAB release firmado

- Uso: publicación en Google Play o distribución administrada compatible.
- Firma: la misma configuración release definida para la aplicación.

## Actualización y conservación de datos

Antes de actualizar la aplicación real:

1. Crear una copia JSON desde RC29.
2. Verificar que el archivo puede compartirse o guardarse.
3. Conservar RC29 instalada durante el piloto paralelo.
4. Instalar `ISIVOLT RC24 Pruebas` como segunda aplicación.
5. Realizar las pruebas con datos de demostración.
6. No desinstalar RC29 hasta disponer de una migración o restauración comprobada.
7. Cuando se autorice la actualización real, instalar sobre la anterior sin desinstalar.
8. Abrir la aplicación y desbloquearla.
9. Comprobar el diagnóstico SQLite.
10. Revisar herramientas, técnicos, tarjetas, movimientos, accesorios y mantenimiento.
11. Realizar un préstamo y una devolución de prueba.

Desinstalar una aplicación elimina su almacenamiento privado del dispositivo. Solo debe hacerse después de confirmar que existe una copia restaurable.

## Checklist físico RC24

### Separación respecto a RC29

- RC29 y RC24 Pruebas aparecen como aplicaciones distintas.
- Abrir o borrar datos en RC24 no modifica RC29.
- El nombre y el icono permiten distinguir ambas aplicaciones.

### Tarjeta corporativa

- Abrir Herramientas > Tarjetas.
- Asociar el código de barras de una tarjeta a un técnico de prueba.
- Confirmar que el lector devuelve el valor esperado.
- Realizar un préstamo identificando al técnico mediante la tarjeta.
- Cerrar y abrir la aplicación.
- Confirmar que la tarjeta continúa asociada.
- Exportar una copia JSON.
- Eliminar la asociación, restaurar la copia y comprobar que vuelve a aparecer.
- Intentar asignar el mismo código a otro técnico y verificar el bloqueo.

### Operaciones

- Préstamo empezando por técnico.
- Préstamo empezando por herramienta.
- Devolución cargando todas las herramientas del técnico.
- Devolución de una herramienta concreta.
- Devolución múltiple con estados diferentes.
- Incidencia con observación obligatoria.
- Herramienta reservada para el técnico correcto y para uno incorrecto.
- Herramienta en reparación o fuera de servicio.
- Doble pulsación rápida en Confirmar.
- Cerrar la aplicación justo después de confirmar y verificar recuperación.

### Interfaz recuperada

- Inventario en dos columnas sin cortes ni solapamientos.
- Técnicos en dos columnas y colores por especialidad.
- Cortinas de filtros de Inventario y Técnicos.
- Historial con fecha y hora completas.
- Filtros Hoy, Ayer, 7 días, 30 días, mes y rango.
- Salidas verdes, entradas rojas, incidencias ámbar y ajustes violetas.
- Descarga CSV y apertura en Excel.
- Saludo configurable y cambio de Buenos días/tardes/noches.
- Radar del logo fluido.
- Menú administrativo único sin botones flotantes superpuestos.
- Navegación inferior separada de los gestos o botones Android.

### Botón Atrás

- Desde una ventana abierta: cierra la ventana.
- Desde Inventario, Técnicos o Historial: vuelve a Inicio.
- Desde Inicio: muestra aviso de segunda pulsación.
- Segunda pulsación: sale de la aplicación.

### Multimedia e informes

- Cámara abre y escanea QR y códigos lineales.
- Fotografía desde cámara.
- Fotografía desde galería.
- Impresión QR individual.
- Impresión QR por grupo.
- Excel operativo.
- Excel de gestión.
- Copia y restauración JSON.

## Criterios de aceptación de producción

- La cámara abre y escanea QR y CODE 39 reales.
- La entrada manual funciona como respaldo.
- Los movimientos muestran el operador autenticado.
- Los movimientos originales no se pueden editar ni borrar.
- Las rectificaciones crean un registro nuevo enlazado.
- SQLite muestra esquema v5 y conserva los datos tras reiniciar.
- Los códigos de barras de técnicos se incluyen en copia y restauración.
- La actualización conserva usuarios, inventario, fotos, movimientos y mantenimiento.
- Excel, CSV y copia JSON se generan y comparten.
- La restauración recupera todos los apartados.
- El bloqueo por PIN y por inactividad funciona.
- Los roles impiden acciones no autorizadas.
- No aparecen errores críticos en el diagnóstico.
- Ninguna función útil de RC29 desaparece sin una decisión expresa.

## Custodia de la firma

Se recomienda mantener al menos dos copias cifradas de la clave release:

- Una copia corporativa controlada.
- Una copia de contingencia almacenada fuera del equipo de desarrollo.

Debe documentarse quién puede acceder a la clave y cómo se recuperaría ante pérdida del equipo.
