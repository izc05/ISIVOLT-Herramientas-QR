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

La aplicación incorpora una interfaz industrial premium con animaciones fluidas, escáner QR en vivo, microinteracciones, confirmaciones visuales, panel operativo y estados claramente diferenciados.

## Tecnología

- React.
- TypeScript.
- Vite.
- Motion for React.
- Capacitor para Android.
- SQLite para almacenamiento local en la siguiente fase.
- Exportación XLSX.

## Ejecutar en desarrollo

```bash
npm install
npm run dev
```

## Compilar

```bash
npm run build
```

## Preparar Android

Después de instalar las dependencias:

```bash
npm run android:add
npm run android:sync
npm run android:open
```

## Estado actual

La rama `feature/premium-app-foundation` contiene la primera base visual y técnica: panel animado, navegación móvil, movimientos en vivo, escáner QR simulado y configuración inicial de Capacitor.

Consulta `docs/ROADMAP.md` para ver las siguientes fases.
