# Hoja de ruta técnica

## Principios

- Uso rápido desde un móvil de almacén.
- Funcionamiento local sin conexión.
- Movimientos inmutables y auditables.
- Interfaz móvil clara, rápida y accesible.
- Datos protegidos mediante validaciones, transacciones y copias.
- Arquitectura preparada para sincronización futura.

## RC24 — Recuperación y seguridad operativa

Seguimiento: PR #42.

- [x] Recuperar un motor único de movimientos para QR, NFC y selección manual.
- [x] Añadir `operationId` compartido por lote.
- [x] Impedir confirmaciones dobles y operaciones repetidas.
- [x] Persistir `operationId` mediante migración SQLite v4.
- [x] Cola secuencial de escrituras SQLite.
- [x] Recuperar el estado local si la aplicación se cierra durante un guardado.
- [x] Esperar la confirmación persistente antes de mostrar la operación como completada.
- [x] Revisión final del lote antes de guardar.
- [x] Estado individual por herramienta en devoluciones múltiples.
- [x] Identificación empezando por técnico o por herramienta.
- [x] Confirmación al cancelar una operación preparada.
- [x] APK paralela con identificador independiente para probar junto a RC23.
- [ ] Prueba física completa en Android.
- [ ] Verificar cierre inmediato tras guardar y recuperación al abrir.
- [ ] Verificar actualización conservando datos.
- [ ] Confirmar equivalencia visual y funcional con todos los módulos de RC23.

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
- [x] Conectar las operaciones QR, NFC y manuales al motor único en RC24.
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
- [x] Identificador de lote persistente en SQLite v4.
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

- [x] Usuarios locales.
- [x] Roles Administrador, Almacén y Técnico.
- [x] PIN local.
- [x] Operador real en cada movimiento.
- [x] Área de administración protegida.
- [x] Rectificaciones sin modificar el movimiento original.
- [x] Registro de auditoría visible.
- [x] Bloqueo por inactividad.
- [ ] Opción biométrica.
- [ ] Exportación completa y unificada de auditoría.

## 1.0 — Producción

Seguimiento: issue #17.

- [x] Pruebas unitarias, integración y flujos principales automatizados.
- [ ] Pruebas físicas en varios teléfonos Android.
- [ ] APK release firmada con clave privada.
- [ ] AAB opcional.
- [x] Icono y splash definidos.
- [x] VersionCode y versionName automáticos.
- [ ] Actualizaciones conservando datos verificadas físicamente.
- [x] Manual de usuario y administrador inicial.
- [ ] Piloto con inventario reducido.
- [ ] Plan de copias y recuperación completo.
- [ ] Versión estable 1.0.

## Siguiente fase funcional

- Fecha prevista de devolución.
- OT y ubicación de destino.
- Checklist de accesorios por salida y entrada.
- Transferencia directa entre técnicos.
- Inventario físico por escaneo.
- Kits de herramientas.
- Estadísticas de uso, retrasos, incidencias y costes.
