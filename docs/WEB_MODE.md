# Modo web RC30

## Objetivo

Publicar ISIVOLT Herramientas QR en GitHub Pages para validar la interfaz y las operaciones desde móvil, tablet y ordenador sin generar una APK en cada cambio.

## Dirección

`https://izc05.github.io/ISIVOLT-Herramientas-QR/`

## Activación del repositorio

GitHub Pages está configurado con **GitHub Actions** como origen de publicación y HTTPS obligatorio.

Cada actualización de `agent/rc31-web-preview` valida y publica automáticamente la web RC30.

## Funcionamiento actual

En navegador la aplicación mantiene disponibles:

- Inventario y fichas de herramientas.
- Técnicos y tarjetas asociadas.
- Préstamos, devoluciones e incidencias.
- OT, ubicación y fecha prevista de devolución.
- Comprobación de accesorios.
- Historial, filtros, alertas y auditoría.
- Exportaciones y copias compatibles con las funciones web.
- Escaneo de QR y códigos lineales mediante la cámara del navegador.
- Selección manual permanente como alternativa.

## Escáner web

El botón de cámara abre un visor específico que:

- Explica el uso de la cámara antes de pedir permiso.
- Prioriza la cámara trasera del móvil.
- Procesa la imagen exclusivamente en el dispositivo.
- Usa primero `BarcodeDetector` cuando el navegador lo admite.
- Utiliza ZXing como lector alternativo para QR y códigos lineales.
- Reutiliza el registro de tarjetas de técnico y los mismos flujos de validación de la aplicación.
- Detiene todas las pistas de vídeo al detectar, cancelar, cerrar o abandonar la página.

La cámara no graba ni sube fotografías o vídeos. Los formatos prioritarios incluyen QR, CODE 39, CODE 93, CODE 128, Codabar, EAN, ITF, UPC, Data Matrix, PDF417 y Aztec.

## Persistencia

Hasta incorporar el servidor central, los datos se guardan en `localStorage` dentro del navegador utilizado.

Esto significa que:

- Cada navegador mantiene una copia independiente.
- Cambiar de móvil, navegador o perfil no comparte automáticamente los datos.
- Borrar los datos del navegador puede eliminar la copia local.
- Debe mantenerse una copia JSON periódica durante las pruebas.

La interfaz muestra permanentemente el distintivo **Modo web RC30** y avisa de que la sincronización central está pendiente.

## Funciones nativas en pausa

Las siguientes funciones permanecen reservadas para Android o necesitan una alternativa web:

- SQLite nativo.
- NFC.
- Impresión Android nativa.
- Control físico del botón Atrás.
- ML Kit, que continúa reservado para una futura APK.

## Publicación

El workflow `.github/workflows/deploy-pages.yml`:

1. Instala dependencias.
2. Ejecuta las pruebas.
3. Compila React, TypeScript y Vite.
4. Publica el contenido de `dist` mediante GitHub Pages.

La rama de publicación inicial es `agent/rc31-web-preview`.

## Próximos bloques

1. Validar físicamente QR de herramienta y tarjeta corporativa en Android Chrome.
2. Limpiar workflows heredados que se ejecutan fuera de sus ramas.
3. Diseñar la base central y la cola de sincronización.
4. Añadir autenticación y permisos por técnico.
5. Sustituir los datos aislados del navegador por información compartida.
