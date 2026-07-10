# ISIVOLT Herramientas QR

Aplicación Android offline para registrar, controlar y auditar la entrega y devolución de herramientas mediante códigos QR.

## Objetivo

- Conocer quién tiene cada herramienta.
- Registrar entregas, devoluciones, incidencias y cambios de estado.
- Mantener un historial completo y auditable.
- Gestionar accesorios, revisiones, calibraciones y reparaciones.
- Exportar inventario, movimientos y gestión a Excel.
- Trabajar inicialmente sin conexión desde un móvil de almacén.
- Preparar una futura sincronización entre dispositivos.

## Estado actual — 0.8.0

La aplicación incluye:

- Directorio de 76 técnicos y 12 secciones.
- Inventario con fotografía, QR y ficha móvil.
- Entregas y devoluciones individuales o múltiples.
- Cámara QR mediante Google ML Kit y entrada manual de respaldo.
- SQLite relacional con migraciones, transacciones, claves únicas y auditoría.
- Movimientos protegidos contra modificación y borrado.
- Identificador estable del dispositivo.
- Centro móvil de gestión administrativa.
- Edición completa de herramientas y técnicos.
- Compra, proveedor, coste, número de serie y ubicación.
- Reservas por técnico.
- Reparación, repuestos, calibración, fuera de servicio y extravío.
- Accesorios con estado y archivado lógico.
- Expedientes de mantenimiento.
- Alertas offline por retrasos, vencimientos, averías, fotografía o QR.
- Importación y actualización desde Excel.
- Informe Excel de gestión y plantilla de importación.
- Copias de seguridad JSON restaurables.
- Sonidos, vibración y animaciones configurables.
- Impresión y compartición de QR.
- Diagnóstico de SQLite y registro local de errores.
- Pruebas de dominio y validación del SQL sobre SQLite real.
- Generación automática de APK debug.

> La versión 0.8 continúa siendo una versión de pruebas internas. Antes del uso oficial se completarán usuarios, roles, auditoría avanzada, firma release y un piloto controlado.

## Tecnología

- React 19 y TypeScript.
- Vite y Vitest.
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

## Pruebas y compilación

```bash
npm test
npm run build
python3 scripts/validate_sqlite_schema.py
```

## Preparar Android localmente

```bash
npm run android:add
npm run android:sync
npm run android:open
```

## APK automática

GitHub Actions ejecuta pruebas, compila la web, sincroniza Capacitor y genera una APK con la versión obtenida de `package.json`.

1. Abre **Actions**.
2. Entra en **Generar APK Android**.
3. Descarga `ISIVOLT-Herramientas-QR-vX.Y.Z-debug`.
4. Descomprime el ZIP e instala `app-debug.apk`.

La APK debug es solo para pruebas internas. La versión 1.0 tendrá firma privada y actualización controlada.

## Plan de producción

- [Issue #18](https://github.com/izc05/ISIVOLT-Herramientas-QR/issues/18): estabilización 0.6.2.
- [Issue #14](https://github.com/izc05/ISIVOLT-Herramientas-QR/issues/14): SQLite profesional y motor transaccional 0.7.
- [Issue #15](https://github.com/izc05/ISIVOLT-Herramientas-QR/issues/15): gestión completa, accesorios y mantenimiento 0.8.
- [Issue #16](https://github.com/izc05/ISIVOLT-Herramientas-QR/issues/16): usuarios, roles y auditoría 0.9.
- [Issue #17](https://github.com/izc05/ISIVOLT-Herramientas-QR/issues/17): firma, pruebas y puesta en servicio 1.0.

Consulta `docs/ROADMAP.md` para el desglose técnico.
