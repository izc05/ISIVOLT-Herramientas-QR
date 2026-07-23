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

- [x] Modelo central de técnicos, herramientas, movimientos y accesorios preparado.
- [ ] Servidor como fuente de verdad validado en Supabase QA.
- [x] Cola offline de operaciones pendientes.
- [x] Idempotencia mediante `operationId`.
- [x] Resolución explícita de conflictos preparada.
- [x] Diagnóstico y reintento seguro.

### Bloque 5 — Usuarios y panel central

- [x] Acceso Supabase preparado.
- [x] Roles Administrador, Almacén, Coordinador y Técnico.
- [x] Permisos locales reales por técnico.
- [ ] Inventario global compartido validado con dos sesiones.
- [ ] Alertas, vencimientos y auditoría central.
- [ ] Kits o maletines de herramientas.

### Bloque 6 — Punto de entrega físico

- [x] Ficha de herramienta centrada en escritorio.
- [x] Modo opcional de QR firmado y rotatorio.
- [x] Verificación ECDSA P-256, estación y caducidad.
- [x] Bloqueo seguro cuando la configuración está incompleta.
- [ ] Servicio generador de QR en el mini PC.
- [ ] Consumo único del nonce en servidor.
- [ ] Piloto físico en la red Wi-Fi del almacén.
- [ ] Evaluar aprobación adicional desde el puesto fijo.

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

## RC36–RC38 — Ruta multiusuario

- RC36: perfiles locales y técnico vinculado.
- RC37: sincronización transaccional, acceso Supabase y centro de conflictos.
- RC38: modal de herramienta centrado y punto de entrega presencial.
- Bloqueo actual: validación PostgreSQL en una rama Supabase QA aislada.

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
