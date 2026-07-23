# Hoja de ruta técnica

## Prioridad actual: RC30 web-first

La aplicación se valida y evoluciona mediante GitHub Pages. Android se conserva como plataforma futura, pero deja de ser el flujo principal hasta completar la sincronización multiusuario.

### Bloque 1 — Publicación web

- [x] Rama web independiente `agent/rc31-web-preview`.
- [x] GitHub Pages mediante Actions y HTTPS.
- [x] Distintivo visible **Modo web RC30**.
- [x] Persistencia local sin iniciar SQLite Android.
- [ ] Piloto completo en móvil, tablet y ordenador.

### Bloque 2 — Cámara web

- [x] Permiso solicitado mediante acción expresa.
- [x] Preferencia por cámara trasera.
- [x] Visor responsive y cancelación segura.
- [x] `BarcodeDetector` como primera opción.
- [x] ZXing como alternativa para QR y códigos lineales.
- [x] Integración con técnico, herramienta y registro de tarjetas.
- [x] Selección manual permanente.
- [x] Liberación del stream al detectar, cancelar o salir.
- [x] Pruebas de permisos, cámara ausente y cámara ocupada.
- [ ] QR de herramienta validado físicamente en Android Chrome.
- [ ] Tarjeta corporativa horizontal validada.
- [ ] Tarjeta corporativa vertical validada.

### Bloque 3 — Higiene del repositorio

- [ ] Limitar workflows históricos a sus ramas originales.
- [ ] Evitar automatizaciones Android durante la ruta web.
- [ ] Cerrar o archivar PR antiguos sustituidos por RC30.

### Bloque 4 — Base central y sincronización

- [ ] Modelo central de técnicos, herramientas, movimientos y accesorios.
- [ ] Servidor como fuente de verdad.
- [ ] Cola offline de operaciones pendientes.
- [ ] Idempotencia mediante `operationId`.
- [ ] Resolución de conflictos de préstamo y devolución.
- [ ] Diagnóstico y reintento seguro.

### Bloque 5 — Usuarios y panel central

- [ ] Autenticación.
- [ ] Roles Administrador, Almacén y Técnico.
- [ ] Permisos reales por técnico.
- [ ] Inventario global compartido.
- [ ] Alertas, vencimientos y auditoría central.
- [ ] Kits o maletines de herramientas.

## Principios históricos conservados

- Uso rápido desde móvil.
- Funcionamiento local cuando no existe conexión.
- Movimientos inmutables y auditables.
- Interfaz móvil clara, rápida y accesible.
- Datos protegidos mediante validaciones, transacciones y copias.
- Arquitectura preparada para sincronización.

## RC30 — Recuperación y seguridad operativa

Seguimiento: PR #42.

- [x] Motor único de movimientos para QR, NFC y selección manual.
- [x] `operationId` compartido por lote.
- [x] Bloqueo de confirmaciones dobles.
- [x] Persistencia de `operationId` mediante SQLite v4.
- [x] Cola secuencial de escrituras SQLite.
- [x] Recuperación del estado local tras cierre durante un guardado.
- [x] Confirmación persistente antes de mostrar éxito.
- [x] Revisión final del lote.
- [x] Estado individual por herramienta en devoluciones múltiples.
- [x] Identificación empezando por técnico o herramienta.
- [x] Confirmación al cancelar una operación preparada.
- [x] RC30 Android paralela conservada para una fase posterior.

## Núcleo profesional ya construido

- [x] React, TypeScript, Vite y Motion.
- [x] Directorio de técnicos.
- [x] Inventario y estados.
- [x] Entregas y devoluciones múltiples.
- [x] QR e impresión A4.
- [x] Fotografías de herramientas.
- [x] Excel y copias JSON.
- [x] SQLite normalizado con migraciones.
- [x] Restricciones, claves foráneas y transacciones.
- [x] Movimientos inmutables.
- [x] Accesorios y mantenimiento.
- [x] Usuarios locales, PIN y auditoría.
- [x] Historial avanzado, alertas y exportaciones.

## Regreso futuro a Android

- [ ] Evaluar primero instalación como PWA.
- [ ] Recuperar APK cuando la web multiusuario esté estable.
- [ ] Mantener ML Kit, NFC, SQLite e impresión nativa como mejoras opcionales.
- [ ] Publicar una sola versión estable sin cadenas de RC paralelas.
