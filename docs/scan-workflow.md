# Flujo de préstamo y devolución por escaneo

## Objetivo

Registrar una operación completa sin repetir formularios por cada artículo:

1. Elegir préstamo o devolución.
2. Identificar al técnico.
3. Escanear todos los artículos.
4. Revisar y confirmar el lote una sola vez.

Cada artículo genera su movimiento individual y todos quedan vinculados mediante un `batchId` común.

## Modos de trabajo

### Administrador

El administrador escanea primero la credencial del técnico y después cada herramienta o material. Este modo sirve para almacén, recepción o entrega centralizada.

### Autoservicio del técnico

El técnico utiliza su credencial personal y registra directamente los artículos que retira o devuelve. En una fase posterior, un usuario autenticado podrá quedar identificado automáticamente sin volver a escanear su credencial.

## Identificación compatible

### Técnico

- Código manual, por ejemplo `TEC-001`.
- QR personal: `ISIVOLTPRO:TECH:TEC-001`.
- Tarjeta o etiqueta NFC asignada.
- Identidad autenticada en una futura aplicación móvil.

### Herramienta o material

- Código manual.
- QR generado por IsiVoltPro.
- Etiqueta NFC vinculada al artículo.
- Lector QR USB o Bluetooth que escriba el código en el campo activo.

## Reglas de validación

- Un artículo no puede aparecer dos veces en el mismo lote.
- Solo se prestan artículos disponibles.
- Solo se devuelve material que figure prestado al técnico identificado.
- Ningún cambio se guarda hasta pulsar la confirmación final.
- Al finalizar, el lote conserva operación, técnico, artículos, modo, método de identificación y método de escaneo.

## Cámara y NFC web

La cámara QR utiliza `BarcodeDetector` cuando el navegador lo permite. Si no está disponible, se mantiene la entrada manual o mediante lector externo.

Web NFC funciona principalmente en Android con Chrome y requiere HTTPS. La web puede leer una tarjeta o etiqueta NFC, pero un teléfono no puede comportarse de forma universal como una tarjeta NFC desde una PWA. Para usar el propio móvil como credencial NFC sería necesaria una aplicación Android nativa con HCE y no existiría la misma compatibilidad en iPhone.

Por este motivo, la credencial recomendada inicialmente es:

1. QR personal mostrado en la aplicación del técnico.
2. Tarjeta o pegatina NFC física opcional.
3. Identificación automática al iniciar sesión cuando se incorpore autenticación.
