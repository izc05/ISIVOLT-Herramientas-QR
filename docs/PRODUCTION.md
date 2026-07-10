# Preparación de producción — ISIVOLT Herramientas QR

## Estado de la versión

La primera candidata de producción se identifica como `1.0.0-rc.1`.

No se marcará como `1.0.0` estable hasta completar:

1. Firma release con una clave privada custodiada fuera del repositorio.
2. Instalación y actualización sobre un móvil real conservando datos.
3. Piloto controlado con un subconjunto del inventario.
4. Verificación física de cámara, QR, fotografía, sonido, vibración, Excel y restauración.
5. Revisión de incidencias del piloto.

## Artefactos de compilación

### APK debug

- Uso: pruebas internas rápidas.
- Firma: clave de depuración de Android.
- Distribución: GitHub Actions.
- No debe utilizarse como versión oficial de producción.

### APK release firmada

- Uso: distribución interna directa.
- Firma: keystore privado de ISIVOLT.
- Debe conservar la misma clave durante toda la vida de la aplicación para permitir actualizaciones.

### AAB release firmado

- Uso: publicación en Google Play o distribución administrada compatible.
- Firma: la misma configuración release definida para la aplicación.

## Secretos requeridos en GitHub

La automatización release espera estos secretos del repositorio:

- `ANDROID_KEYSTORE_BASE64`: keystore codificado en Base64.
- `ANDROID_KEYSTORE_PASSWORD`: contraseña del almacén de claves.
- `ANDROID_KEY_ALIAS`: alias de la clave.
- `ANDROID_KEY_PASSWORD`: contraseña de la clave.

Nunca deben subirse al repositorio:

- El archivo `.jks` o `.keystore`.
- Contraseñas.
- Archivos `key.properties` reales.
- Copias de seguridad de la clave sin cifrar.

## Versionado Android

- `versionName`: se obtiene de `package.json`.
- `versionCode`: se calcula a partir de la versión semántica.
- Fórmula base: `major * 10000 + minor * 100 + patch`.
- Las candidatas release incorporan un incremento adicional basado en la ejecución de GitHub Actions.
- Cada artefacto destinado a distribución debe tener un `versionCode` superior al anterior.

## Actualización y conservación de datos

Antes de cada actualización:

1. Crear una copia JSON desde la aplicación.
2. Verificar que el archivo puede compartirse o guardarse.
3. Instalar la APK nueva sobre la anterior, sin desinstalar.
4. Abrir la aplicación y desbloquearla.
5. Comprobar el diagnóstico SQLite.
6. Revisar herramientas, técnicos, movimientos, accesorios y mantenimiento.
7. Realizar una entrega y una devolución de prueba.

Desinstalar la aplicación elimina el almacenamiento privado del dispositivo. Solo debe hacerse después de confirmar que existe una copia restaurable.

## Criterios de aceptación de producción

- La cámara abre y escanea QR reales.
- La entrada manual funciona como respaldo.
- Los movimientos muestran el operador autenticado.
- Los movimientos originales no se pueden editar ni borrar.
- Las rectificaciones crean un registro nuevo enlazado.
- SQLite muestra el esquema esperado y conserva los datos tras reiniciar.
- La actualización conserva usuarios, inventario, fotos, movimientos y mantenimiento.
- Excel y copia JSON se generan y comparten.
- La restauración recupera todos los apartados.
- El bloqueo por PIN y por inactividad funciona.
- Los roles impiden acciones no autorizadas.
- No aparecen errores críticos en el diagnóstico.

## Custodia de la clave

Se recomienda mantener al menos dos copias cifradas de la clave release:

- Una copia corporativa controlada.
- Una copia de contingencia almacenada fuera del equipo de desarrollo.

Debe documentarse quién puede acceder a la clave y cómo se recuperaría ante pérdida del equipo.