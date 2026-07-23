# Hoja de ruta técnica

## Prioridad actual: web multiusuario con control presencial

La aplicación se valida y evoluciona mediante GitHub Pages. Android se conserva como plataforma futura, pero el flujo principal es web-first hasta completar la sincronización central, el piloto multiusuario y el punto físico del almacén.

### Bloque 1 — Publicación web

- [x] Rama web independiente `agent/rc31-web-preview`.
- [x] GitHub Pages mediante Actions y HTTPS.
- [x] Persistencia local sin iniciar SQLite Android.
- [x] Diseño profesional responsive para escritorio y móvil.
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
- [ ] Cerrar o archivar PR antiguos sustituidos por RC30–RC40.
- [ ] Actualizar versión y documentación pública tras integrar la cadena estable.

### Bloque 4 — Base central y sincronización

- [x] Modelo central de técnicos, herramientas, movimientos y accesorios preparado.
- [ ] Servidor como fuente de verdad validado en Supabase QA.
- [x] Cola offline de operaciones pendientes.
- [x] Idempotencia mediante `operationId`.
- [x] Operación PostgreSQL transaccional preparada.
- [x] Resolución explícita de conflictos preparada.
- [x] Diagnóstico y reintento seguro.
- [ ] Prueba real con dos usuarios y dos dispositivos concurrentes.

### Bloque 5 — Usuarios y panel central

- [x] Acceso Supabase preparado.
- [x] Roles Administrador, Almacén, Coordinador y Técnico.
- [x] Permisos locales reales por técnico.
- [x] Identidad técnica vinculada y selección propia.
- [ ] Inventario global compartido validado con dos sesiones.
- [ ] Alertas y vencimientos centrales.
- [ ] Kits o maletines de herramientas.

### Bloque 6 — Punto de entrega físico

- [x] Ficha de herramienta centrada en escritorio.
- [x] Modo opcional de QR firmado y rotatorio.
- [x] Verificación ECDSA P-256, estación y caducidad.
- [x] Bloqueo central al guardar sin pase presencial.
- [x] Servicio generador de QR en el mini PC.
- [x] Pantalla completa del punto de entrega.
- [x] Consumo único del nonce ligado a `operationId`.
- [x] Auditoría JSONL del mini PC.
- [x] Evidencia presencial incorporada al movimiento y a la cola offline.
- [x] Migración PostgreSQL para conservar estación, nonce y hora.
- [ ] HTTPS reconocido por los móviles para el canje reforzado.
- [ ] Instalación física en el mini PC real.
- [ ] Piloto en la red Wi‑Fi del almacén.
- [ ] Evaluar aprobación adicional desde el puesto fijo.

### Bloque 7 — Auditoría presencial visible

- [x] Clasificación validada, sin evidencia, parcial y no aplicable.
- [x] Filtro presencial en historial avanzado.
- [x] Punto, fecha y nonce visibles por movimiento.
- [x] Evidencia incluida en CSV.
- [x] Resumen presencial dentro de la ficha de herramienta.
- [x] Tratamiento neutral de registros históricos anteriores al sistema.
- [ ] Panel central con tendencias y operaciones que requieren revisión.
- [ ] Reglas configurables de alerta sin acusación automática.

## Principios conservados

- Uso rápido desde móvil.
- Funcionamiento local cuando no existe conexión.
- Movimientos inmutables y auditables.
- Interfaz móvil clara, rápida y accesible.
- Datos protegidos mediante validaciones, transacciones y copias.
- Presencia física verificable sin depender únicamente de la contraseña Wi‑Fi.
- Ausencia de evidencia no equivale automáticamente a fraude.

## RC30 — Recuperación y seguridad operativa

Seguimiento histórico: PR #42.

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

## RC36–RC40 — Ruta multiusuario y presencial

- RC36: perfiles locales y técnico vinculado.
- RC37: sincronización transaccional, acceso Supabase y centro de conflictos.
- RC38: modal de herramienta centrado y barrera de QR firmado.
- RC39: servicio real del mini PC, canje único y evidencia en movimientos.
- RC40: auditoría visual, filtros presenciales y resumen por herramienta.
- Bloqueo actual: validación PostgreSQL en una rama Supabase QA e instalación física del mini PC.

## Núcleo profesional ya construido

- [x] React, TypeScript, Vite y Motion.
- [x] Directorio de técnicos.
- [x] Inventario y estados.
- [x] Entregas y devoluciones múltiples.
- [x] QR e impresión A4.
- [x] Fotografías de herramientas.
- [x] Excel, CSV y copias JSON.
- [x] SQLite normalizado con migraciones.
- [x] Restricciones, claves foráneas y transacciones.
- [x] Movimientos inmutables.
- [x] Accesorios y mantenimiento.
- [x] Usuarios locales, PIN y auditoría.
- [x] Historial avanzado, alertas y exportaciones.
- [x] Servicio local independiente para el punto físico.

## Regreso futuro a Android

- [ ] Evaluar primero instalación como PWA.
- [ ] Recuperar APK cuando la web multiusuario esté estable.
- [ ] Persistir evidencia de estación en SQLite Android mediante una migración posterior.
- [ ] Mantener ML Kit, NFC e impresión nativa como mejoras opcionales.
- [ ] Publicar una sola versión estable sin cadenas de RC paralelas.
