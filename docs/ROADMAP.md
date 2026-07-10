# Hoja de ruta técnica

## Principios

- Uso rápido desde un móvil de almacén.
- Funcionamiento local sin conexión.
- Movimientos inmutables y auditables.
- Interfaz móvil clara, rápida y accesible.
- Datos protegidos mediante validaciones, transacciones y copias.
- Arquitectura preparada para sincronización futura.

## 0.6 — Prototipo funcional

- [x] React, TypeScript, Vite y Motion.
- [x] Interfaz responsive y navegación móvil.
- [x] Directorio de técnicos.
- [x] Inventario y estados básicos.
- [x] Entregas y devoluciones múltiples.
- [x] QR reales e impresión A4.
- [x] Cámara Android mediante ML Kit.
- [x] Fotografías de herramientas.
- [x] Excel y copias JSON.
- [x] SQLite como respaldo inicial del estado completo.
- [x] Sonido, vibración y animaciones.
- [x] APK debug automática.

## 0.6.2 — Estabilización

Seguimiento: issue #18.

- [x] Versión centralizada para app, Excel, copias y artefacto Android.
- [x] Entrada manual como respaldo del lector QR.
- [x] Corregir el flujo Android para no bloquear `scan()` por permiso de cámara.
- [x] Validación básica de códigos e identificadores duplicados.
- [x] Limpieza de responsables y estados incoherentes.
- [x] Protección reforzada del reinicio de demostración.
- [x] Registro local de errores y pantalla de diagnóstico.
- [x] Validación estructural reforzada de copias.
- [x] Motor de reglas y servicio único de movimientos creados.
- [x] Pruebas unitarias iniciales del dominio.
- [ ] Conectar todas las pantallas manuales y QR al servicio único.
- [ ] Checklist físico de cámara, fotos, Excel y restauración.

## 0.7 — Núcleo de datos profesional

Seguimiento: issue #14.

- [x] Tablas SQLite reales para herramientas, técnicos y movimientos.
- [x] Categorías, ubicaciones, accesorios, usuarios y ajustes.
- [x] Migraciones versionadas mediante `schema_migrations` y `PRAGMA user_version`.
- [x] Mapeadores y servicios tipados de persistencia.
- [x] Transacciones con commit y rollback.
- [x] Restricciones UNIQUE, CHECK y claves foráneas.
- [x] Servicio único de entrega, devolución e incidencia.
- [x] Movimientos inmutables mediante triggers.
- [x] Nuevas fotografías guardadas mediante Filesystem en Android.
- [x] Identificador estable del dispositivo.
- [x] Copia y restauración compatibles con migraciones y reemplazo transaccional.
- [x] Diagnóstico de salud de SQLite.
- [x] Validación de migraciones sobre SQLite real en CI.
- [ ] Migrar las fotografías antiguas Base64 y hacerlas portables en las copias.
- [ ] Implementar rectificaciones desde la interfaz sin modificar el movimiento original.

## 0.8 — Gestión completa

Seguimiento: issue #15.

- [x] Centro de gestión adaptado a móvil.
- [x] Edición completa y baja lógica de herramientas.
- [x] Edición, activación y baja controlada de técnicos.
- [x] Importación y actualización desde Excel.
- [x] Plantilla Excel e informe de gestión.
- [x] Definición y control de accesorios.
- [x] Alertas de accesorios faltantes o dañados.
- [x] Reservas por técnico.
- [x] Estados de reparación, repuestos, calibración, extravío y fuera de servicio.
- [x] Expedientes de incidencias, inspecciones, reparaciones, repuestos y costes.
- [x] Revisiones y calibraciones programadas.
- [x] Alertas offline por retrasos y vencimientos.
- [x] Indicadores operativos básicos.
- [ ] Checklist de accesorios integrado dentro de cada salida y devolución.
- [ ] Tablero global para editar y cerrar expedientes de mantenimiento.
- [ ] Estadísticas avanzadas por uso, técnico, categoría e incidencias.

## 0.9 — Seguridad y auditoría

Seguimiento: issue #16.

- [ ] Usuarios locales.
- [ ] Roles Administrador, Almacén y Técnico.
- [ ] PIN y opción biométrica.
- [ ] Operador real en cada movimiento.
- [ ] Área de administración protegida.
- [ ] Rectificaciones sin modificar el movimiento original.
- [ ] Registro de auditoría visible.
- [ ] Bloqueo por inactividad.

## 1.0 — Producción

Seguimiento: issue #17.

- [ ] Pruebas unitarias, integración y flujos completos.
- [ ] Pruebas físicas en varios teléfonos Android.
- [ ] APK release firmada.
- [ ] AAB opcional.
- [ ] Icono y splash definitivos.
- [ ] VersionCode y versionName automáticos.
- [ ] Actualizaciones conservando datos.
- [ ] Manual de usuario y administrador.
- [ ] Piloto con inventario reducido.
- [ ] Plan de copias y recuperación.
- [ ] Versión estable 1.0.
