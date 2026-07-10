# Hoja de ruta técnica

## Principios del proyecto

- Uso rápido desde un único móvil de almacén.
- Funcionamiento local sin conexión.
- Historial de movimientos auditable.
- Interfaz premium con animaciones útiles y no decorativas.
- Arquitectura preparada para sincronización futura.
- Generación de APK Android mediante Capacitor.

## Fase 1 — Base visual y técnica

- [x] React, TypeScript y Vite.
- [x] Sistema visual responsive.
- [x] Animaciones con Motion.
- [x] Panel operativo inicial.
- [x] Escáner QR simulado.
- [x] Configuración de Capacitor.
- [x] Validación automática con GitHub Actions.

## Fase 2 — Dominio e inventario

- [ ] Modelo de herramientas.
- [ ] Modelo de técnicos.
- [ ] Categorías y ubicaciones.
- [ ] Fotografías y accesorios.
- [ ] Estados operativos.
- [ ] Alta, edición y baja lógica.
- [ ] Importación inicial desde Excel.

## Fase 3 — Entregas y devoluciones

- [ ] Lectura QR real mediante cámara.
- [ ] Identificación de técnico por QR o PIN.
- [ ] Entrega individual y múltiple.
- [ ] Devolución individual y múltiple.
- [ ] Registro de estado y accesorios.
- [ ] Fotografías y observaciones.
- [ ] Firma opcional.

## Fase 4 — Persistencia local

- [ ] Base de datos SQLite.
- [ ] Migraciones versionadas.
- [ ] Transacciones para movimientos.
- [ ] Copia de seguridad y restauración.
- [ ] Registro de auditoría no destructivo.

## Fase 5 — Informes

- [ ] Excel de movimientos.
- [ ] Excel de inventario.
- [ ] Herramientas prestadas por técnico.
- [ ] Incidencias y averías.
- [ ] Resumen por fechas y categorías.

## Fase 6 — Android

- [ ] Crear proyecto Android de Capacitor.
- [ ] Permisos de cámara y almacenamiento.
- [ ] Vibración y sonido opcionales.
- [ ] Icono, splash y nombre final.
- [ ] APK de pruebas.
- [ ] APK firmada.
- [ ] Compilación automática desde GitHub Actions.

## Modelo de datos inicial

### Tool

- `id`: UUID interno.
- `code`: código visible único.
- `qrValue`: contenido del QR.
- `name`, `brand`, `model`, `serialNumber`.
- `categoryId`, `homeLocationId`.
- `status`: disponible, prestada, reservada, revisión, averiada, reparación, calibración, fuera de servicio o baja.
- `currentTechnicianId`: técnico responsable actual.
- `photoUri`, `notes`.
- `createdAt`, `updatedAt`.

### Technician

- `id`: UUID interno.
- `employeeCode`: código de empleado.
- `qrValue`: QR personal.
- `name`, `department`, `phone`.
- `active`.
- `createdAt`, `updatedAt`.

### Movement

- `id`: UUID inmutable.
- `sequence`: número correlativo local.
- `type`: entrega, devolución, traslado, incidencia, reparación, baja o rectificación.
- `toolId`, `technicianId`, `operatorId`.
- `previousStatus`, `newStatus`.
- `condition`, `notes`.
- `createdAt`, `deviceId`.
- `syncStatus`: preparado para futura sincronización.

Los movimientos no se eliminan. Los errores se corrigen mediante un nuevo movimiento de rectificación para mantener la trazabilidad.
