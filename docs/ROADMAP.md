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
- [x] SQLite como respaldo del estado completo.
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
- [ ] Motor único de movimientos utilizado por todos los flujos.
- [ ] Pruebas unitarias iniciales del dominio.
- [ ] Checklist físico de cámara, fotos, Excel y restauración.

## 0.7 — Núcleo de datos profesional

Seguimiento: issue #14.

- [ ] Tablas SQLite reales para herramientas, técnicos y movimientos.
- [ ] Categorías, ubicaciones, accesorios, usuarios y ajustes.
- [ ] Migraciones versionadas.
- [ ] Repositorios tipados.
- [ ] Transacciones atómicas.
- [ ] Restricciones UNIQUE y claves foráneas.
- [ ] Motor único de entrega, devolución, incidencia y rectificación.
- [ ] Movimientos inmutables.
- [ ] Fotografías en Filesystem y miniaturas.
- [ ] Identificador del dispositivo.
- [ ] Copia y restauración migrables.

## 0.8 — Gestión completa

Seguimiento: issue #15.

- [ ] Edición y baja lógica de herramientas.
- [ ] Edición, activación y baja de técnicos.
- [ ] Importación y actualización desde Excel.
- [ ] Accesorios y checklist de salida/entrada.
- [ ] Reservas.
- [ ] Estados de reparación, calibración, extravío y fuera de servicio.
- [ ] Incidencias, reparaciones, repuestos y costes.
- [ ] Revisiones y calibraciones programadas.
- [ ] Alertas por retrasos y vencimientos.
- [ ] Estadísticas operativas.

## 0.9 — Seguridad y auditoría

Seguimiento: issue #16.

- [ ] Usuarios locales.
- [ ] Roles Administrador, Almacén y Técnico.
- [ ] PIN y opción biométrica.
- [ ] Operador real en cada movimiento.
- [ ] Área de administración protegida.
- [ ] Rectificaciones sin modificar el movimiento original.
- [ ] Registro de auditoría.
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
