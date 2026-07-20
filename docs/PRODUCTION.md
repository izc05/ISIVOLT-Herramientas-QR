# Preparación de producción — ISIVOLT Herramientas QR

## Estado de la versión

RC24 recupera funciones presentes en la APK RC23 y añade protección de persistencia e idempotencia. Continúa siendo una candidata de pruebas y no se marcará como `1.0.0` estable hasta completar:

1. Firma release con una clave privada custodiada fuera del repositorio.
2. Instalación y actualización sobre un móvil real conservando datos.
3. Piloto controlado con un subconjunto del inventario.
4. Verificación física de cámara, QR, NFC, fotografía, sonido, vibración, Excel y restauración.
5. Revisión de incidencias del piloto.

## Artefactos de compilación

### APK RC24 paralela

- Nombre visible: `ISIVOLT RC24 Pruebas`.
- Application ID: `com.isivolt.herramientasqr.rc24`.
- Version name: `1.0.0-rc.24-test`.
- Se instala junto a RC23 sin sustituirla.
- No comparte la base de datos ni las preferencias de RC23.
- Firma: clave de depuración de Android.
- Uso exclusivo: piloto interno de RC24.

### APK debug normal

- Uso: pruebas internas rápidas.
- Firma: clave de depuración de Android.
- Distribución: GitHub Actions.
- Mantiene el identificador normal de la aplicación y no debe instalarse sobre RC23 durante la recuperación.
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

- `versionName`: se obtiene de `package.json` en la compilación normal.
- `versionCode`: se calcula a partir de la versión semántica.
- Fórmula base: `major * 10000 + minor * 100 + patch`.
- Las candidatas release incorporan un incremento adicional basado en la ejecución de GitHub Actions.
- RC24 paralela utiliza `versionCode 24001` y un identificador separado.
- Cada artefacto destinado a distribución debe tener un `versionCode` superior al anterior.

## Checklist físico RC24

1. Instalar RC24 junto a RC23 y comprobar que aparecen como dos aplicaciones distintas.
2. Crear un administrador local en RC24.
3. Importar o crear un conjunto pequeño de técnicos y herramientas de prueba.
4. Registrar un préstamo empezando por el técnico.
5. Registrar otro préstamo empezando por la herramienta.
6. Probar QR, NFC y selección manual.
7. Devolver varias herramientas asignando condiciones diferentes.
8. Verificar que una avería exige observaciones y deja la herramienta bloqueada.
9. Pulsar dos veces rápidamente la confirmación y comprobar que solo existe un lote.
10. Cerrar la aplicación inmediatamente después de guardar y comprobar que el movimiento reaparece al abrir.
11. Probar una herramienta reservada para el técnico correcto y para uno incorrecto.
12. Exportar inventario, movimientos y auditoría disponibles.
13. Crear una copia, borrar los datos de prueba y restaurarla.
14. Comprobar botón Atrás, teclado, scroll y safe areas.

## Actualización y conservación de datos

Antes de cada actualización de la aplicación definitiva:

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
- NFC identifica técnicos y herramientas sin duplicar UIDs.
- La entrada manual funciona como respaldo.
- Los movimientos muestran el operador autenticado.
- Los movimientos originales no se pueden editar ni borrar.
- Las rectificaciones crean un registro nuevo enlazado.
- SQLite muestra el esquema esperado y conserva los datos tras reiniciar.
- `operationId` se conserva después de cerrar y abrir la aplicación.
- La actualización conserva usuarios, inventario, fotos, movimientos y mantenimiento.
- Excel y copia JSON se generan y comparten.
- La restauración recupera todos los apartados documentados.
- El bloqueo por PIN y por inactividad funciona.
- Los roles impiden acciones no autorizadas.
- No aparecen errores críticos en el diagnóstico.

## Custodia de la clave

Se recomienda mantener al menos dos copias cifradas de la clave release:

- Una copia corporativa controlada.
- Una copia de contingencia almacenada fuera del equipo de desarrollo.

Debe documentarse quién puede acceder a la clave y cómo se recuperaría ante pérdida del equipo.
