# Modo web RC30

## Objetivo

Publicar ISIVOLT Herramientas QR en GitHub Pages para validar la interfaz y las operaciones desde móvil, tablet y ordenador sin generar una APK en cada cambio.

## Dirección prevista

`https://izc05.github.io/ISIVOLT-Herramientas-QR/`

## Funcionamiento actual

En navegador la aplicación mantiene disponibles:

- Inventario y fichas de herramientas.
- Técnicos y tarjetas asociadas mediante entrada manual.
- Préstamos, devoluciones e incidencias.
- OT, ubicación y fecha prevista de devolución.
- Comprobación de accesorios.
- Historial, filtros, alertas y auditoría.
- Exportaciones y copias compatibles con las funciones web.

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
- Vibración y control físico del botón Atrás.
- Escáner ML Kit de la APK.

La selección manual de herramientas y técnicos continúa disponible. La cámara web se añadirá como bloque independiente.

## Publicación

El workflow `.github/workflows/deploy-pages.yml`:

1. Instala dependencias.
2. Ejecuta las pruebas.
3. Compila React, TypeScript y Vite.
4. Publica el contenido de `dist` mediante GitHub Pages.

La rama de publicación inicial es `agent/rc31-web-preview`.

## Próximos bloques

1. Validar el despliegue y la experiencia responsive.
2. Incorporar escaneo QR y código de barras mediante cámara web.
3. Diseñar la base central y la cola de sincronización.
4. Añadir autenticación y permisos por técnico.
5. Sustituir los datos aislados del navegador por información compartida.
