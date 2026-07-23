# Hoja de ruta técnica

## Prioridad actual: servidor local gratuito y piloto multiusuario

La aplicación seguirá publicándose en GitHub Pages como vista previa. La implantación real se servirá desde el mini PC mediante HTTPS, con PocketBase como servidor central y SQLite como base de datos. No se utiliza Supabase, Firebase ni ningún servicio mensual.

### Bloque 1 — Publicación web

- [x] Rama web independiente `agent/rc31-web-preview`.
- [x] GitHub Pages mediante Actions y HTTPS.
- [x] Persistencia local sin iniciar SQLite Android.
- [x] Diseño profesional responsive para escritorio y móvil.
- [ ] Piloto completo en móvil, tablet y ordenador.
- [ ] Publicación de producción desde el mini PC bajo una única URL HTTPS.

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
- [ ] Cerrar o archivar PR antiguos sustituidos por RC30–RC41.
- [ ] Archivar migraciones Supabase como diseño histórico no desplegable.
- [ ] Actualizar versión y documentación pública tras integrar la cadena estable.

### Bloque 4 — Servidor central gratuito

- [x] PocketBase fijado y reproducible desde una base vacía.
- [x] SQLite central con usuarios, entidades, movimientos, eventos y dispositivos.
- [x] API autoritativa: los móviles no escriben directamente en las colecciones.
- [x] Movimiento transaccional e idempotente mediante `operationId`.
- [x] Cola offline de operaciones pendientes.
- [x] Descarga incremental mediante cursor.
- [x] Resolución explícita de conflictos.
- [x] Diagnóstico y reintento seguro.
- [x] Prueba real de login, préstamo, reintento duplicado y sincronización.
- [ ] Prueba concurrente con dos usuarios y dos dispositivos.
- [ ] Restauración de una copia validada en un entorno temporal.

### Bloque 5 — Usuarios y gestión central

- [x] Roles Administrador, Almacén, Coordinador y Técnico.
- [x] Permisos locales reales por técnico.
- [x] Identidad técnica vinculada y selección propia.
- [x] Autenticación PocketBase desde la aplicación.
- [x] Centro de cola offline y conflictos.
- [ ] Alta y edición de usuarios desde un panel ISIVOLT simplificado.
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
- [x] Evidencia presencial conservada por PocketBase.
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

### Bloque 8 — Instalación y operación del mini PC

- [x] Instalador Ubuntu para amd64 y arm64.
- [x] Usuario de servicio sin acceso interactivo.
- [x] Servicio `systemd` endurecido.
- [x] Copia diaria automática con retención.
- [x] Despliegue de la web en `pb_public`.
- [x] Proxy HTTPS Caddy preparado.
- [ ] Instalar certificado local de confianza en los móviles del piloto.
- [ ] Probar apagado, reinicio y recuperación automática.
- [ ] Ejecutar y restaurar la primera copia real.
- [ ] Documentar IP, DNS y credenciales en sobre/custodia administrativa.

## Principios conservados

- Coste de software y servicios: 0 € mensuales.
- Uso rápido desde móvil.
- Funcionamiento local cuando no existe conexión.
- El mini PC es la fuente central de verdad.
- Movimientos inmutables, idempotentes y auditables.
- Interfaz móvil clara, rápida y accesible.
- Datos protegidos mediante validaciones, transacciones y copias.
- Presencia física verificable sin depender únicamente de la contraseña Wi‑Fi.
- Ausencia de evidencia no equivale automáticamente a fraude.
- Ninguna clave de administrador se entrega al navegador.

## Evolución de la arquitectura

- RC36: perfiles locales y técnico vinculado.
- RC37: cola, sincronización transaccional y centro de conflictos; su adaptador Supabase queda sustituido.
- RC38: modal de herramienta centrado y barrera de QR firmado.
- RC39: servicio real del mini PC, canje único y evidencia en movimientos.
- RC40: auditoría visual, filtros presenciales y resumen por herramienta.
- RC41: PocketBase y SQLite en el mini PC como arquitectura central definitiva.

## Núcleo profesional ya construido

- [x] React, TypeScript, Vite y Motion.
- [x] Directorio de técnicos.
- [x] Inventario, fotografías y estados.
- [x] Entregas y devoluciones múltiples.
- [x] QR, impresión y escáner web.
- [x] Excel, CSV y copias JSON.
- [x] Persistencia offline y cola local.
- [x] Restricciones, transacciones e idempotencia central.
- [x] Accesorios y mantenimiento.
- [x] Usuarios, roles, PIN y auditoría.
- [x] Historial avanzado, alertas y exportaciones.
- [x] Servicio local independiente para el punto físico.

## Regreso futuro a Android

- [ ] Evaluar primero instalación como PWA.
- [ ] Recuperar APK cuando la web multiusuario esté estable.
- [ ] Persistir evidencia de estación en SQLite Android mediante una migración posterior.
- [ ] Mantener ML Kit, NFC e impresión nativa como mejoras opcionales.
- [ ] Publicar una sola versión estable sin cadenas de RC paralelas.
