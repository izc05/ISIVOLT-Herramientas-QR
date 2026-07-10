# ISIVOLT Herramientas QR

Aplicación profesional para registrar, controlar y auditar la entrega y devolución de herramientas mediante códigos QR.

## Objetivo

- Conocer en todo momento quién tiene cada herramienta.
- Registrar entregas, devoluciones, incidencias y cambios de estado.
- Mantener un historial completo y auditable de movimientos.
- Exportar inventario y movimientos a Excel.
- Funcionar inicialmente sin conexión en un dispositivo Android.
- Preparar la arquitectura para una futura sincronización entre varios dispositivos.

## Experiencia visual

La aplicación incorpora una interfaz industrial premium con animaciones fluidas, microinteracciones, panel operativo, estados diferenciados, QR reales y hojas de etiquetas imprimibles.

## Tecnología

- React.
- TypeScript.
- Vite.
- Motion for React.
- Capacitor 8 para Android.
- Códigos QR SVG.
- SQLite para almacenamiento local en la siguiente fase.
- Exportación XLSX.

## Ejecutar en desarrollo

```bash
npm install
npm run dev
```

## Compilar la web

```bash
npm run build
```

## Preparar Android localmente

Después de instalar las dependencias:

```bash
npm run android:add
npm run android:sync
npm run android:open
```

## Descargar la APK automática

GitHub Actions genera una APK de prueba cuando se actualiza la rama `main`.

1. Abre la pestaña **Actions** del repositorio.
2. Entra en la ejecución **Generar APK Android** más reciente.
3. Baja hasta **Artifacts**.
4. Descarga `ISIVOLT-Herramientas-QR-debug`.
5. Descomprime el ZIP e instala `app-debug.apk` en el móvil Android.

La APK debug sirve para pruebas internas. La versión final necesitará firma privada y se distribuirá como APK firmada o AAB.

## Estado actual

- Directorio de 76 técnicos y 12 secciones.
- Inventario y movimientos persistentes en el navegador.
- Entregas y devoluciones individuales o múltiples.
- QR reales para técnicos y herramientas.
- Impresión individual y por hojas A4.
- Interfaz animada con estética industrial tipo videojuego.
- Publicación web mediante GitHub Pages.
- Generación automática de APK debug.

Consulta `docs/ROADMAP.md` para ver las siguientes fases.
