# ISIVOLT Herramientas QR

Aplicación Android offline para registrar, controlar y auditar la entrega y devolución de herramientas mediante códigos QR.

## Objetivo

- Conocer quién tiene cada herramienta.
- Registrar entregas, devoluciones, incidencias y cambios de estado.
- Mantener un historial completo y auditable.
- Exportar inventario y movimientos a Excel.
- Trabajar inicialmente sin conexión desde un móvil de almacén.
- Preparar una futura sincronización entre dispositivos.

## Estado actual — 0.6.2

La aplicación es un prototipo funcional avanzado. Ya incluye:

- Directorio de 76 técnicos y 12 secciones.
- Inventario con fotografía, QR y ficha móvil.
- Entregas y devoluciones individuales o múltiples.
- Cámara QR mediante Google ML Kit y entrada manual de respaldo.
- Historial de movimientos.
- Excel operativo con seis hojas.
- Copias de seguridad JSON restaurables.
- SQLite local como respaldo del estado actual.
- Sonidos, vibración y animaciones configurables.
- Impresión y compartición de QR.
- Generación automática de APK debug.
- Validación de códigos únicos e integridad básica.
- Diagnóstico y registro de errores local.

> La versión actual sirve para pruebas controladas. Antes de utilizarla como única fuente oficial del inventario se completarán las fases 0.7, 0.8, 0.9 y 1.0.

## Tecnología

- React 19 y TypeScript.
- Vite.
- Motion for React.
- Capacitor 8.
- Google ML Kit Barcode Scanning.
- Capacitor Community SQLite.
- Capacitor Camera, Filesystem, Share, Preferences y Haptics.
- XLSX.

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

```bash
npm run android:add
npm run android:sync
npm run android:open
```

## APK automática

GitHub Actions genera una APK de prueba con el número de versión obtenido de `package.json`.

1. Abre **Actions**.
2. Entra en la ejecución **Generar APK Android** más reciente.
3. Descarga el artefacto `ISIVOLT-Herramientas-QR-vX.Y.Z-debug`.
4. Descomprime el ZIP e instala `app-debug.apk`.

La APK debug es solo para pruebas internas. La versión 1.0 tendrá firma privada y un flujo de actualización controlado.

## Plan de producción

- [Issue #18](https://github.com/izc05/ISIVOLT-Herramientas-QR/issues/18): estabilización 0.6.2.
- [Issue #14](https://github.com/izc05/ISIVOLT-Herramientas-QR/issues/14): SQLite profesional y motor transaccional 0.7.
- [Issue #15](https://github.com/izc05/ISIVOLT-Herramientas-QR/issues/15): gestión completa, accesorios y mantenimiento 0.8.
- [Issue #16](https://github.com/izc05/ISIVOLT-Herramientas-QR/issues/16): usuarios, roles y auditoría 0.9.
- [Issue #17](https://github.com/izc05/ISIVOLT-Herramientas-QR/issues/17): firma, pruebas y puesta en servicio 1.0.

Consulta `docs/ROADMAP.md` para el desglose técnico.
