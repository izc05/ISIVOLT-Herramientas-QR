# RC33 · flujo rápido de escaneo

## Recorrido único

Todas las operaciones siguen el mismo orden:

1. Elegir **Préstamo** o **Devolución**.
2. Identificar primero al técnico mediante cámara, NFC o selección manual.
3. Escanear una o varias herramientas sin cerrar la cámara.
4. Cerrar la cámara cuando se haya terminado.
5. Revisar y confirmar la operación.

La interfaz ya no propone comenzar por una herramienta.

## Cámara continua

- Se abre inmediatamente después de pulsar el botón de cámara.
- No necesita un segundo botón de activación.
- Después de leer al técnico, permanece abierta para las herramientas.
- El visor muestra el técnico activo y el número de herramientas añadidas.
- Una lectura repetida del mismo código queda bloqueada durante 1,6 segundos.
- El vídeo se procesa localmente y se detiene al cerrar el visor.

## Selección manual

Antes de identificar al técnico aparece **Elegir técnico manualmente**.

Después de identificarlo aparece **Añadir herramienta manualmente**.

El mismo acceso manual está disponible dentro del visor de cámara. Al pulsarlo, se cierra correctamente el stream antes de abrir el buscador.

## Devolución

Al identificar al técnico se informa del número de herramientas pendientes, pero no se seleccionan automáticamente. Deben escanearse o elegirse únicamente las unidades que se entregan físicamente.

## Prueba móvil

1. Abrir GitHub Pages con Chrome Android.
2. Pulsar el botón central de escaneo.
3. Escanear la tarjeta de un técnico.
4. Sin cerrar el visor, escanear dos herramientas distintas.
5. Mantener el último QR delante de la cámara y comprobar que no se duplica.
6. Pulsar **Cerrar cámara**.
7. Comprobar técnico y herramientas seleccionadas.
8. Abrir la opción manual y añadir otra herramienta.
9. Revisar y confirmar.
10. Repetir en modo devolución y verificar que no se cargan automáticamente todas las pendientes.

## Sincronización

RC33 no conecta ningún servicio remoto. Supabase se considera descartado y la migración a Firebase Firestore se realizará en un bloque independiente.
