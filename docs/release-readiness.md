# Preparación de dispositivos IsiVoltPro

## Objetivo

Antes de utilizar un móvil u ordenador en producción, el panel **Sistema** permite revisar las capacidades esenciales sin modificar datos ni solicitar permisos automáticamente.

## Comprobaciones

- contexto HTTPS seguro;
- conexión online u operación offline;
- API de cámara;
- detector QR nativo cuando existe;
- Web NFC opcional;
- Service Worker e instalación PWA;
- escritura en almacenamiento local;
- espacio utilizado, cuota y persistencia cuando el navegador lo informa;
- configuración del servidor PocketBase.

## Pruebas manuales

### Cámara

La prueba solicita permiso únicamente al pulsar **Probar**. Abre un flujo de vídeo con preferencia por la cámara trasera y detiene inmediatamente todas las pistas.

No se almacena ninguna imagen.

### PocketBase

Cuando existe una URL configurada, consulta:

```text
/api/health
```

No inicia sesión y no crea, modifica ni elimina registros.

## Informe

El botón **Copiar informe** genera un JSON con:

- versión de la aplicación;
- fecha de generación;
- navegador y dispositivo;
- estado de cada comprobación;
- resultado de las pruebas manuales.

El informe sirve para soporte y pruebas piloto. Solo se copia cuando el usuario pulsa el botón.

## NFC

Web NFC es una mejora opcional. Un dispositivo sin esa API puede completar todos los flujos mediante:

- QR con cámara;
- lector QR externo;
- código manual;
- tarjeta o etiqueta NFC leída por un dispositivo compatible.

## Iconos

Los PNG de 192 y 512 píxeles se generan antes de cada compilación mediante:

```text
npm run prepare:pwa
```

La compilación produce:

- `icon-192.png`;
- `icon-512.png`;
- `maskable-512.png`;
- `apple-touch-icon.png`.

CI comprueba la firma PNG, dimensiones reales, referencias del manifiesto, metadatos móviles, Service Worker y presencia del diagnóstico.
